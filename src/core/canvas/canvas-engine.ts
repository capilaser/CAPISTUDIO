import * as fabric from 'fabric';

import type { LayerMeta, PrincipalLayerMeta, VisualLayerMeta } from '@/data/schema';
import { buildMaterialPattern, loadImage } from './material-applier';
import type { CorelSvgMeta } from './corel-svg-parser';
import { isOperationLayer } from './layer-meta';
import { extractClipShapes, parseAndStripRootDimensions, type ParsedViewBox } from './svg-utils';
import { SlotManager } from './slot-manager';
import type { SlotMeta, SlotType } from './types';
import { mmToPx, pxToMm } from './units';
import { computeSnapCandidates, applySnapResult } from './alignment/snap-engine';
import type { RectMm, SnapCandidate, SnapResult, SnapTarget } from './alignment/snap-targets';
import { guidesShouldChange } from './alignment/guides-diff';
import type { ProximityResult } from './alignment/proximity-calculator';
import { getCapiId } from './capi-id';

export interface EngineConfig {
  productWidthMm: number;
  productHeightMm: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
}

/**
 * Custom Capi properties that must be carried through Fabric serialization.
 * Fabric's toObject only persists these if explicitly listed (Risco 3).
 *
 *  - id        : stable per-object UUID, generated on first serialize
 *  - capiSlot  : SlotMeta (Onda 4+) — type/maxArea/auto* for slot-typed objects
 *
 * Add to this list when introducing new Capi-specific object metadata.
 * NOTE: materialId is NOT listed here — it lives in capi.layers (LayerMeta),
 * not as a per-Fabric-object property (ADR 008).
 */
export const CAPI_CUSTOM_PROPS = ['id', 'capiSlot'] as const;

/**
 * Nó da árvore exibida no painel de camadas (Onda 7).
 * - 'principal' = aplique/base, sempre raiz, com `children` (slots/operations/visuais).
 * - 'visual' | 'operation' = nó folha (Onda 7 não permite filhos de filhos).
 */
export type LayerNode =
  | {
      kind: 'principal';
      id: string;
      name: string;
      visible: boolean;
      locked: boolean;
      children: LayerNode[];
    }
  | {
      kind: 'visual' | 'operation';
      id: string;
      name: string;
      visible: boolean;
      locked: boolean;
      parentId: string | null;
    };

export interface SerializedCanvas {
  version: string;
  objects: Array<Record<string, unknown>>;
  capi: {
    productId: string;
    units: 'mm';
    /**
     * Schema version for LayerMeta format (mirrors FabricCanvasJson.capi.schemaVersion).
     *   2 = discriminated union (ADR 010 §1, Fase C+). Absent/1 = flat (pre-Fase C).
     */
    schemaVersion: number;
    /** LayerMeta array — one entry per user object. Onda 5+. */
    layers: LayerMeta[];
  };
}

const BASE_OBJECT_FLAG = '__capiBase';
const ASPECT_TOLERANCE = 1e-3;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
/** Default fill restored when a material is removed from a visual layer. */
const DEFAULT_LAYER_FILL = 'rgba(122, 162, 247, 0.18)';
/**
 * Default stroke applied to base-layer paths after cleanCorelSvg strips fills.
 * ADR 010 §3: contorno da peça = ink-700. Canvas engine is authoritative for colour.
 * Matches tailwind token ink-700 (#2a2c2e) — do NOT use CSS var() here (Fabric doesn't resolve them).
 */
const SVG_BASE_STROKE = '#2a2c2e';

function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Helper: find a user (non-base) object by its capi id. */
function findById(canvas: fabric.Canvas, id: string): fabric.FabricObject | undefined {
  return canvas
    .getObjects()
    .find((o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === id);
}

export class CanvasEngine {
  readonly canvas: fabric.Canvas;
  readonly config: EngineConfig;

  private isPanModeActive = false;
  private isDragging = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private readonly slotManager: SlotManager;

  /**
   * Per-layer metadata map. Key = capi object id.
   * Populated on addRectangle / createSlot and restored on deserialize.
   * Serialized into capi.layers[] by serialize().
   */
  private readonly layerMeta = new Map<string, LayerMeta>();

  /**
   * Path `d` strings extracted from the loaded product SVG (SVG user units).
   * Set by loadProductSvg; empty when no product is loaded.
   * Used by applyMaterialToLayer to build a clipped Pattern (Checkpoint C).
   */
  private productPaths: string[] = [];

  /**
   * Coordinate space of the loaded product SVG (width/height in user units).
   * Null when no product is loaded.
   */
  private productSvgViewBox: { width: number; height: number } | null = null;

  /**
   * Per-session HTMLImageElement cache, keyed by materialId.
   * Avoids repeated network / IPC round-trips when the same material is
   * applied to multiple layers or re-applied after removal.
   */
  private readonly materialImageCache = new Map<string, HTMLImageElement>();

  /**
   * Runtime snap options supplied by useSnapToCanvas hook.
   * Null = snap desabilitado (hook não conectado ainda).
   * O campo `isAltDown` é lido a cada evento de moving — não precisa de re-set.
   */
  private snapOptions: {
    /** Retorna true quando Alt está pressionado (lido via ref do hook). */
    isAltDown: () => boolean;
  } | null = null;

  // ─── Snap visual guides (Onda 7b, Fase C) ──────────────────────────────────
  // Guias visuais cyan tracejadas exibidas durante drag quando snap está ativo.
  // Estado e renderização vivem no engine porque dependem de `this.canvas`.
  // ADR 014: motor matemático é função pura — guias visuais só consomem SnapResult.

  /** Linhas-guia atualmente no canvas, uma por eixo (null quando não há snap nesse eixo). */
  private currentGuides: { x: fabric.Line | null; y: fabric.Line | null } = {
    x: null,
    y: null,
  };

  /** Último SnapResult aplicado — usado pelo diff em `guidesShouldChange`. */
  private lastSnapResult: SnapResult | null = null;

  /**
   * Animações de fade-out em curso, uma por eixo.
   * Cancellers (referência da `ValueAnimation` para chamar `.abort()`).
   * Limpos quando a animação completa OU quando um novo drag começa.
   */
  private fadeAnimations: {
    x: { abort: () => void } | null;
    y: { abort: () => void } | null;
  } = { x: null, y: null };

  // ─── Measurement lines (Onda 7b, Fase E) ───────────────────────────────────
  // 2 fabric.Line tracejadas formando um "L" entre os centros de 2 objetos
  // selecionados quando measurementMode está ligado. Cor #7dd3fc (sky-300) —
  // diferente do snap (#00d4ff) pra não confundir os 2 sistemas visualmente.
  // Caixinhas de texto vivem no DOM (MeasurementOverlay.tsx) — só as linhas
  // ficam dentro do Fabric pra acompanhar zoom/pan automaticamente.

  /** Linhas de medição atualmente no canvas, uma por eixo (null quando ausente). */
  private measurementLines: { v: fabric.Line | null; h: fabric.Line | null } = {
    v: null,
    h: null,
  };

  // ─── Proximity lines (Onda 7b, Fase E2) ────────────────────────────────────
  // 4 fabric.Line tracejadas violeta (#a78bfa) ligando o target às coisas mais
  // próximas em cada uma das 4 direções (acima, abaixo, esquerda, direita).
  // Caixinhas DOM com texto vivem em ProximityOverlay.tsx.

  /** Linhas de proximidade atualmente no canvas, uma por direção. */
  private proximityLines: {
    top: fabric.Line | null;
    bottom: fabric.Line | null;
    left: fabric.Line | null;
    right: fabric.Line | null;
  } = { top: null, bottom: null, left: null, right: null };

  // ─── Grid dots (Onda 7b, Fase F) ───────────────────────────────────────────
  // 1 fabric.Rect cobrindo a área útil do produto, preenchido com fabric.Pattern
  // (canvas off-screen 4×4px com 1 dot ink-600). Decisão de design no ADR 015:
  //   - Pattern fixo no espaço de coordenadas — em zoom alto os pontos engordam
  //     mas não ficam mais densos (comportamento CAD desejado).
  //   - 1 objeto Fabric (não 27.000 dots individuais) — performance preservada.
  /** Rect de pontos da grade. Null quando grade está oculta. */
  private gridDotsRect: fabric.Rect | null = null;

  /** Optional callback — set from outside to receive slot selection changes. */
  onSlotSelectionChange?: (id: string | null) => void;

  /**
   * Optional callback — fires whenever the active Fabric selection changes.
   * id   = capi object id of the newly selected object, or null on deselect.
   * meta = current LayerMeta for that id, or null.
   */
  onLayerSelectionChange?: (id: string | null, meta: LayerMeta | null) => void;

  constructor(canvasEl: HTMLCanvasElement, config: EngineConfig) {
    this.config = config;
    this.canvas = new fabric.Canvas(canvasEl, {
      width: config.viewportWidthPx,
      height: config.viewportHeightPx,
      backgroundColor: '#0d1117',
      preserveObjectStacking: true,
      selection: true,
    });

    // Snap handlers must be registered BEFORE SlotManager so that when
    // object:moving fires, snap corrects left/top first, then SlotManager
    // reads the already-snapped coordinates to sync the overlay.
    this.attachSnapHandlers();

    this.slotManager = new SlotManager(
      this.canvas,
      { productWidthMm: config.productWidthMm, productHeightMm: config.productHeightMm },
      { onSelectionChange: (id) => this.onSlotSelectionChange?.(id) }
    );

    this.centerProductInViewport();
    this.attachPanHandlers();
    this.attachSelectionHandlers();
    this.attachPrincipalBoundsUpdater();
  }

  /**
   * Translates the viewport so the product origin (0,0 mm) lands at the
   * top-left of the centered product area. Resets zoom to 1.
   */
  private centerProductInViewport(): void {
    const productPxW = mmToPx(this.config.productWidthMm);
    const productPxH = mmToPx(this.config.productHeightMm);
    const tx = (this.config.viewportWidthPx - productPxW) / 2;
    const ty = (this.config.viewportHeightPx - productPxH) / 2;
    this.canvas.setViewportTransform([1, 0, 0, 1, tx, ty]);
  }

  /**
   * Wires fabric mouse events; the handlers are gated on `isPanModeActive`
   * so they only act while pan mode is on (Risco 4 mitigation: no conflict
   * with selection drag).
   */
  private attachPanHandlers(): void {
    this.canvas.on('mouse:down', (opt) => {
      if (!this.isPanModeActive) return;
      const evt = opt.e as MouseEvent;
      this.isDragging = true;
      this.lastPanX = evt.clientX;
      this.lastPanY = evt.clientY;
      this.canvas.setCursor('grabbing');
    });

    this.canvas.on('mouse:move', (opt) => {
      if (!this.isPanModeActive || !this.isDragging) return;
      const evt = opt.e as MouseEvent;
      const vpt = this.canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += evt.clientX - this.lastPanX;
      vpt[5] += evt.clientY - this.lastPanY;
      this.canvas.setViewportTransform(vpt);
      this.lastPanX = evt.clientX;
      this.lastPanY = evt.clientY;
    });

    this.canvas.on('mouse:up', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.isPanModeActive) {
        this.canvas.setCursor('grab');
      }
    });
  }

  /**
   * Wires selection:created / selection:updated / selection:cleared to
   * onLayerSelectionChange. Only fires for user objects (non-base).
   */
  private attachSelectionHandlers(): void {
    const notify = (obj: fabric.FabricObject | undefined): void => {
      if (!obj || isBaseObject(obj)) {
        this.onLayerSelectionChange?.(null, null);
        return;
      }
      const id = (obj as unknown as Record<string, unknown>).id as string | undefined;
      if (!id) {
        this.onLayerSelectionChange?.(null, null);
        return;
      }
      const meta = this.layerMeta.get(id) ?? null;
      this.onLayerSelectionChange?.(id, meta);
    };

    this.canvas.on('selection:created', (e) => {
      notify((e as unknown as { selected?: fabric.FabricObject[] }).selected?.[0]);
    });
    this.canvas.on('selection:updated', (e) => {
      notify((e as unknown as { selected?: fabric.FabricObject[] }).selected?.[0]);
    });
    this.canvas.on('selection:cleared', () => {
      this.onLayerSelectionChange?.(null, null);
    });
  }

  /**
   * Mini-Onda 8.6 — atualiza PrincipalLayerMeta.originalBounds após o usuário
   * mover/redimensionar um aplique. Sem isso, originalBounds (setado em
   * addAppliqueSvg com os bounds do viewBox SVG) fica defasado e
   * getParentBoundsForObject volta a retornar valores incorretos pós-drag.
   *
   * Detalhe: aqui usamos `obj.width × scaleX` (que tem o erro de margem do
   * fabric.util.groupSVGElements). É intencional — após interação do usuário,
   * a fonte de verdade é o estado Fabric atual (o que está visualmente no
   * canvas). O erro de margem fica congelado mas não cresce.
   *
   * NÃO ENTRA EM CONFLITO com o handler do slot-manager (que também escuta
   * object:modified) — slot-manager filtra por findEntryByBody (slots), aqui
   * filtramos por meta.kind === 'principal' (apliques). Universos disjuntos.
   */
  private attachPrincipalBoundsUpdater(): void {
    this.canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (!obj || isBaseObject(obj)) return;
      const id = getCapiId(obj as unknown as Record<string, unknown>);
      if (!id) return;
      const meta = this.layerMeta.get(id);
      if (!meta || meta.kind !== 'principal') return;

      const widthPx = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const heightPx = (obj.height ?? 0) * (obj.scaleY ?? 1);
      meta.originalBounds = {
        left: pxToMm(obj.left ?? 0),
        top: pxToMm(obj.top ?? 0),
        width: pxToMm(widthPx),
        height: pxToMm(heightPx),
      };
    });
  }

  // ─── Snap ─────────────────────────────────────────────────────────────────

  /**
   * Connects the snap system to the canvas. Called by useSnapToCanvas hook.
   *
   * `isAltDown` is a stable getter (reads a ref) — no re-registration needed
   * when Alt state changes.
   *
   * Scope: only object:moving and selection:moving are intercepted.
   * object:scaling / object:rotating are intentionally excluded (Fase B scope).
   */
  setSnapOptions(opts: { isAltDown: () => boolean } | null): void {
    this.snapOptions = opts;
  }

  /**
   * Returns the bounding box (in mm) of the parent of the given object.
   *
   * Parent is resolved via LayerMeta.parentLayerId:
   *   - null / missing  → parent is the product canvas (returns null)
   *   - valid id        → bounding box of that Fabric object in mm
   *
   * Called by attachSnapHandlers before each computeSnapCandidates call.
   */
  getParentBoundsForObject(objectId: string): RectMm | null {
    const meta = this.layerMeta.get(objectId);
    if (!meta || !meta.parentLayerId) return null;

    // Mini-Onda 8.6: caminho autoritativo via PrincipalLayerMeta.originalBounds.
    // Evita o erro de margem do fabric.util.groupSVGElements (que usa bbox dos
    // shapes em vez do viewBox declarado). Detalhes: schema.ts JSDoc.
    const parentMeta = this.layerMeta.get(meta.parentLayerId);
    if (parentMeta?.kind === 'principal' && parentMeta.originalBounds) {
      return { ...parentMeta.originalBounds };
    }

    // Fallback (migração lazy): padrões salvos antes da Mini-Onda 8.6 não têm
    // originalBounds populado. Mantém o cálculo antigo (com erro de margem
    // de ~0.1-0.4mm dependendo do SVG). Próxima vez que o usuário arrastar
    // o aplique, object:modified popula originalBounds e a partir daí fica
    // preciso. Sem regressão pra cenários existentes.
    const parentObj = findById(this.canvas, meta.parentLayerId);
    if (!parentObj) return null;

    const w = (parentObj.width ?? 0) * (parentObj.scaleX ?? 1);
    const h = (parentObj.height ?? 0) * (parentObj.scaleY ?? 1);
    return {
      left: pxToMm(parentObj.left ?? 0),
      top: pxToMm(parentObj.top ?? 0),
      width: pxToMm(w),
      height: pxToMm(h),
    };
  }

  /**
   * Registers object:moving and selection:moving handlers that apply snap.
   * Called in the constructor BEFORE SlotManager is instantiated so that
   * snap corrects left/top before SlotManager reads it to sync the overlay.
   *
   * Guards:
   *   - snapOptions null  → hook not connected yet, pass-through
   *   - __capiBase        → product base SVG, never snaps
   *   - isPanModeActive   → pan mode, drag is pan not object move
   *   - altKeyDown        → user suppressed snap
   */
  private attachSnapHandlers(): void {
    const canvasDims = () => ({
      width: this.config.productWidthMm,
      height: this.config.productHeightMm,
    });

    /**
     * Builds the SnapCandidate list: all user objects except the moving one,
     * base SVG, invisible objects, and slot overlays (excludeFromExport + no id).
     *
     * Slot overlays are decorative Rects with no capi id — they should not act
     * as snap targets. Slot bodies DO have a capi id and are valid targets.
     */
    const buildCandidates = (excludeId: string | undefined): SnapCandidate[] => {
      const result: SnapCandidate[] = [];
      for (const obj of this.canvas.getObjects()) {
        if (isBaseObject(obj)) continue;
        if (!obj.visible) continue;
        const rec = obj as unknown as Record<string, unknown>;
        const id = typeof rec.id === 'string' ? rec.id : undefined;
        // Slot overlays: excludeFromExport=true AND no capi id → skip
        if (!id) continue;
        if (id === excludeId) continue;

        const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
        const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
        result.push({
          id,
          rect: {
            left: pxToMm(obj.left ?? 0),
            top: pxToMm(obj.top ?? 0),
            width: pxToMm(w),
            height: pxToMm(h),
          },
        });
      }
      return result;
    };

    // ── object:moving — handles both single objects and ActiveSelection ───────
    //
    // In Fabric 6, `selection:moving` does not exist. When the user drags a
    // multi-selection, Fabric emits `object:moving` with e.target being an
    // ActiveSelection. We branch on instanceof to compute the correct bbox.
    //
    // Multi-selection (ActiveSelection):
    //   set({left, top}) on the ActiveSelection moves all children together.
    //   If children drift or the group shifts unexpectedly, STOP and report to
    //   Gabriell — do not attempt to fix independently (Condição 2).
    this.canvas.on('object:moving', (e) => {
      if (!this.snapOptions) return;
      if (this.isPanModeActive) return;

      const obj = e.target;
      // Condição 3: base SVG must never snap even if somehow movable.
      if (isBaseObject(obj)) return;

      let movingRect: RectMm;
      let objectId: string | undefined;
      let parentBounds: RectMm | null;
      let candidates: SnapCandidate[];

      if (obj instanceof fabric.ActiveSelection) {
        // Multi-selection: use group bounding box, no single parent.
        const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
        const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
        movingRect = {
          left: pxToMm(obj.left ?? 0),
          top: pxToMm(obj.top ?? 0),
          width: pxToMm(w),
          height: pxToMm(h),
        };
        parentBounds = null;
        // Exclude all objects that are part of the active selection.
        const selectedIds = new Set(
          obj
            .getObjects()
            .map((o) => (o as unknown as Record<string, unknown>).id as string | undefined)
            .filter((id): id is string => typeof id === 'string')
        );
        candidates = buildCandidates(undefined).filter((c) => !selectedIds.has(c.id));
      } else {
        // Single object.
        const rec = obj as unknown as Record<string, unknown>;
        objectId = typeof rec.id === 'string' ? rec.id : undefined;

        const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
        const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
        movingRect = {
          left: pxToMm(obj.left ?? 0),
          top: pxToMm(obj.top ?? 0),
          width: pxToMm(w),
          height: pxToMm(h),
        };
        parentBounds = objectId ? this.getParentBoundsForObject(objectId) : null;
        candidates = buildCandidates(objectId);
      }

      const result = computeSnapCandidates(movingRect, candidates, canvasDims(), {
        toleranceMm: 1,
        gridMm: 1,
        altKeyDown: this.snapOptions.isAltDown(),
        parentBounds,
      });

      const applied = applySnapResult(movingRect, result);
      const newLeftPx = mmToPx(applied.left);
      const newTopPx = mmToPx(applied.top);

      // ADR 011 / ADR 005: always use obj.set() — never direct assignment.
      obj.set({ left: newLeftPx, top: newTopPx });
      obj.setCoords();

      // Fase C: novo drag tem prioridade total sobre fade em curso.
      // Cancelamos qualquer fade pendente ANTES de renderizar a nova guia,
      // senão o onComplete do fade pode remover a linha que acabamos de criar.
      this.cancelFadeAnimations();
      this.renderGuides(result);
    });

    // mouse:up — dispara fade-out das guias atualmente visíveis.
    // Não checa isPanModeActive: em pan mode, currentGuides já está vazio
    // (object:moving nem chega ao bloco de render), então fadeOutGuides é no-op.
    this.canvas.on('mouse:up', () => {
      this.fadeOutGuides();
    });
  }

  // ─── Snap visual guides — render & fade (Fase C) ──────────────────────────

  /** Cor das guias. Decisão travada (ADR 015 — Fase G). */
  private static readonly GUIDE_STROKE = '#00d4ff';
  private static readonly GUIDE_DASH: [number, number] = [8, 4];
  private static readonly FADE_DURATION_MS = 200;

  /**
   * Aplica o resultado do snap às guias visuais.
   *
   * Para cada eixo, decide via `guidesShouldChange`:
   *   create → desenha nova fabric.Line e adiciona ao canvas
   *   update → move a Line existente (set({x1,x2,y1,y2})) — sem recriar
   *   remove → remove instantaneamente (sem fade — fade é só no mouse:up)
   *   noop   → não toca
   *
   * Atualiza `lastSnapResult` ao final.
   */
  private renderGuides(next: SnapResult): void {
    const diff = guidesShouldChange(this.lastSnapResult, next);

    this.applyGuideAction('x', diff.x, next.x);
    this.applyGuideAction('y', diff.y, next.y);

    this.lastSnapResult = next;

    // Render explícito após criar/mover linhas — object:moving não dispara
    // re-render automático para objetos adicionados depois do início do gesto.
    this.canvas.requestRenderAll();
  }

  private applyGuideAction(
    axis: 'x' | 'y',
    action: 'create' | 'update' | 'remove' | 'noop',
    target: SnapTarget | null
  ): void {
    if (action === 'noop') return;

    if (action === 'remove') {
      const existing = this.currentGuides[axis];
      if (existing) {
        this.canvas.remove(existing);
        this.currentGuides[axis] = null;
      }
      return;
    }

    // create / update precisam de target.
    if (!target) return;

    if (action === 'update') {
      const existing = this.currentGuides[axis];
      if (existing) {
        const coords = this.guideCoordsPx(target);
        existing.set({ ...coords, opacity: 1 });
        return;
      }
      // Defensivo: caso `update` chegue sem linha existente (estado dessincronizado),
      // tratamos como create — mais robusto que crashar.
    }

    // action === 'create'
    const line = this.createGuideLine(target);
    this.currentGuides[axis] = line;
    this.canvas.add(line);
  }

  /** Converte guideStart/guideEnd (mm) para coordenadas px do canvas Fabric. */
  private guideCoordsPx(target: SnapTarget): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } {
    return {
      x1: mmToPx(target.guideStart.x),
      y1: mmToPx(target.guideStart.y),
      x2: mmToPx(target.guideEnd.x),
      y2: mmToPx(target.guideEnd.y),
    };
  }

  /** Cria uma fabric.Line cyan tracejada para o target informado. */
  private createGuideLine(target: SnapTarget): fabric.Line {
    const { x1, y1, x2, y2 } = this.guideCoordsPx(target);
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: CanvasEngine.GUIDE_STROKE,
      strokeWidth: 1,
      strokeDashArray: [...CanvasEngine.GUIDE_DASH],
      // strokeUniform: 1px visual constante mesmo com zoom alto/baixo.
      strokeUniform: true,
      // Não interativa, não exportada, não selecionável.
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
      // Garante que sai do toJSON() normal — não persiste em canvasJson.
      // (excludeFromExport já cobre toObject; duplicamos por clareza.)
      objectCaching: false,
      opacity: 1,
    });
    return line;
  }

  /**
   * Fade-out 200ms das guias atualmente visíveis (chamado em mouse:up).
   * Anima opacity 1→0 e remove do canvas no onComplete.
   *
   * Se um novo drag começar antes do término do fade, `cancelFadeAnimations`
   * (chamado no início de `object:moving`) aborta a animação e limpa estado
   * antes que o `onComplete` rode — evita "linha-fantasma" e race com
   * renderGuides.
   */
  private fadeOutGuides(): void {
    (['x', 'y'] as const).forEach((axis) => {
      const line = this.currentGuides[axis];
      if (!line) return;

      const animation = fabric.util.animate({
        startValue: 1,
        endValue: 0,
        duration: CanvasEngine.FADE_DURATION_MS,
        onChange: (v: number) => {
          line.set({ opacity: v });
          // Doc Fabric: dentro de animate.onChange usar renderAll, não requestRenderAll.
          this.canvas.renderAll();
        },
        onComplete: () => {
          // Pode ter sido cancelado e currentGuides já zerado pelo cancelFadeAnimations.
          if (this.currentGuides[axis] === line) {
            this.canvas.remove(line);
            this.currentGuides[axis] = null;
          }
          this.fadeAnimations[axis] = null;
          this.canvas.requestRenderAll();
        },
      });
      this.fadeAnimations[axis] = animation;
    });

    // Após disparar o fade, lastSnapResult deixa de refletir guia visível —
    // o próximo object:moving deve tratar como "sem guia anterior".
    this.lastSnapResult = null;
  }

  /**
   * Cancela qualquer fade-out em curso (chamado no início de cada object:moving).
   * Importante: a guia animada continua no canvas com a opacity em que estava —
   * `renderGuides` em seguida vai sobrescrever opacity=1 (no caso update) ou
   * remover/recriar (caso remove/create).
   */
  private cancelFadeAnimations(): void {
    (['x', 'y'] as const).forEach((axis) => {
      const anim = this.fadeAnimations[axis];
      if (anim) {
        anim.abort();
        this.fadeAnimations[axis] = null;
      }
    });
  }

  // ─── Layer metadata ───────────────────────────────────────────────────────

  /** Returns a copy of the LayerMeta for the given capi id, or null. */
  getLayerMeta(id: string): LayerMeta | null {
    const m = this.layerMeta.get(id);
    return m ? { ...m } : null;
  }

  /** Returns a snapshot of all LayerMeta entries (for restore after deserialize). */
  getAllLayerMetas(): Map<string, LayerMeta> {
    return new Map(this.layerMeta);
  }

  // ─── Layer operations (Onda 7 — painel de camadas) ────────────────────────

  /**
   * Encontra o objeto Fabric correspondente a um capi id. Diferente do
   * `findById` interno (que só lê `obj.id`), este helper usa `getCapiId`
   * pra resolver slots (cujo id mora em `capiSlot.id`, não em `obj.id`).
   *
   * Mesmo padrão do Fix #1 da Fase D — mantém coerência entre os helpers
   * que precisam achar qualquer tipo de user object.
   */
  private findByCapiId(id: string): fabric.FabricObject | undefined {
    return this.canvas
      .getObjects()
      .find((o) => !isBaseObject(o) && getCapiId(o as unknown as Record<string, unknown>) === id);
  }

  /**
   * Alterna visibilidade de uma camada no canvas.
   *
   * **Contrato com a Onda 9 (export):** este método NÃO mexe em
   * `excludeFromExport`. Apenas seta `obj.visible` no Fabric e
   * `LayerMeta.visible` no Map. A camada continua **persistindo no
   * canvasJson** mesmo invisível — abrir o padrão depois mantém o
   * estado de invisibilidade carregado.
   *
   * A Onda 9 (exportação SVG/PNG) é que vai LER `LayerMeta.visible` no
   * momento do export e PULAR as invisíveis. Ver
   * `docs/IDEAS/onda-9-export-respeita-layer-visible.md` — nota técnica
   * crítica que documenta esse contrato.
   *
   * Por que não `excludeFromExport: true`? Esse flag faz o `serialize`
   * pular o objeto do canvasJson, então salvar padrão → reabrir =
   * camada desaparece. Bug grave pego em flight na calibração da Onda 7.
   */
  setLayerVisibility(id: string, visible: boolean): void {
    const meta = this.layerMeta.get(id);
    if (!meta) return;
    meta.visible = visible;

    const obj = this.findByCapiId(id);
    if (obj) {
      obj.set({ visible });
      obj.setCoords();
    }

    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
    this.canvas.requestRenderAll();
  }

  /**
   * Alterna trava da camada.
   *
   * Decisão (Onda 7): camada travada **pode** ser selecionada mas **não
   * pode** ser movida, escalada ou rotacionada. Útil pra "fixar uma
   * referência" mas ainda poder clicar pra ver dados.
   *
   * Detalhe técnico: slot-manager seta `lockRotation: true` no body de
   * todo slot por padrão (invariante do sistema — slots nunca rotacionam).
   * No destravar, este método NÃO mexe em `lockRotation` pra slots/visuais
   * — mantém o invariante intacto. Para layers principais (apliques) o
   * `lockRotation` é alternado normalmente.
   */
  setLayerLocked(id: string, locked: boolean): void {
    const meta = this.layerMeta.get(id);
    if (!meta) return;
    meta.locked = locked;

    const obj = this.findByCapiId(id);
    if (obj) {
      const isPrincipal = meta.kind === 'principal';
      obj.set({
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        // Slots/visuais preservam lockRotation=true (invariante do slot-manager).
        // Apenas para principais alternamos rotation lock junto com os outros.
        ...(isPrincipal ? { lockRotation: locked } : {}),
        selectable: true,
        evented: true,
      });
      obj.setCoords();
    }

    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
    this.canvas.requestRenderAll();
  }

  /**
   * Renomeia uma camada. No-op se newName for vazio (validação no caller
   * via RenameInput, mas garantia também aqui).
   */
  renameLayer(id: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const meta = this.layerMeta.get(id);
    if (!meta) return;
    meta.name = trimmed;
    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
  }

  /**
   * Deleta uma camada. Para `kind === 'principal'`, deleta também todos
   * os filhos (`parentLayerId === id`) em cascata — invariante de
   * hierarquia do MVP: slot órfão dentro de aplique deletado é estado
   * quebrado.
   *
   * Retorna a lista de ids deletados (pro caller mostrar em toast/log).
   *
   * Rejeita: tentativa de deletar a base do produto (sem efeito, retorna
   * `{ deletedIds: [] }`).
   */
  deleteLayer(id: string): { deletedIds: string[] } {
    const meta = this.layerMeta.get(id);
    if (!meta) return { deletedIds: [] };

    const deletedIds: string[] = [];

    // Cascade: se principal, descobre filhos primeiro.
    if (meta.kind === 'principal') {
      for (const [childId, childMeta] of this.layerMeta.entries()) {
        if (childMeta.parentLayerId === id) {
          const childObj = this.findByCapiId(childId);
          if (childObj) this.canvas.remove(childObj);
          this.layerMeta.delete(childId);
          deletedIds.push(childId);
        }
      }
    }

    // Remove o objeto principal/visual.
    const obj = this.findByCapiId(id);
    if (obj) this.canvas.remove(obj);
    this.layerMeta.delete(id);
    deletedIds.push(id);

    this.canvas.discardActiveObject();
    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
    this.canvas.requestRenderAll();
    return { deletedIds };
  }

  /**
   * Sobe ou desce a camada na z-order do canvas. Atualiza
   * `LayerMeta.zIndex` lendo o índice pós-mudança do canvas, mantendo
   * canvasJson + Fabric sincronizados.
   *
   * No-op quando a camada já está no topo (para 'up') ou no fundo
   * (para 'down') — Fabric simplesmente não faz nada nesse caso.
   */
  moveLayer(id: string, direction: 'up' | 'down'): void {
    const meta = this.layerMeta.get(id);
    if (!meta) return;
    const obj = this.findByCapiId(id);
    if (!obj) return;

    if (direction === 'up') {
      this.canvas.bringObjectForward(obj);
    } else {
      this.canvas.sendObjectBackwards(obj);
    }

    // Sincroniza zIndex do LayerMeta com a nova posição do objeto no canvas.
    const newIdx = this.canvas.getObjects().indexOf(obj);
    if (newIdx >= 0) meta.zIndex = newIdx;

    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
    this.canvas.requestRenderAll();
  }

  /**
   * Muda o `parentLayerId` de uma camada. Usado pelo dropdown "Mover
   * pra..." no painel — operação puramente de metadata (não muda a
   * posição visual do objeto no canvas).
   *
   * Após a mudança, snap e alignment automaticamente respeitam o novo
   * pai via `getParentBoundsForObject` (Fix #1 + Fix #2 da Fase D).
   *
   * Restrições mínimas:
   *   - Camadas principais (`kind === 'principal'`) não aceitam pai
   *     (parentLayerId sempre null). Tentativa é silenciosamente ignorada.
   *   - Tentar usar id inexistente como pai é silenciosamente ignorada.
   *   - Permitido reparent para null (solto / sem aplique pai).
   */
  reparentLayer(id: string, newParentId: string | null): void {
    const meta = this.layerMeta.get(id);
    if (!meta) return;

    // Invariante ADR 010 §1: principais sempre têm parentLayerId=null.
    if (meta.kind === 'principal') return;

    // Valida que o novo pai existe e é principal (quando não-null).
    if (newParentId !== null) {
      const parentMeta = this.layerMeta.get(newParentId);
      if (!parentMeta || parentMeta.kind !== 'principal') return;
    }

    meta.parentLayerId = newParentId;
    // Fabric 6 não tem 'layer-meta-changed' no tipo CanvasEvents; uso `fire`
    // com cast (mesmo padrão usado em outras fases pra eventos sintéticos
    // que UI componentes consomem). Listener no painel também faz cast no on().
    (this.canvas as unknown as { fire: (n: string, o: unknown) => void }).fire(
      'layer-meta-changed',
      { layerId: id, kind: meta.kind }
    );
  }

  /**
   * Constrói a estrutura hierárquica das camadas pra renderização no
   * painel. Apliques (`kind === 'principal'`) viram nós raiz com seus
   * filhos. Visuais/operações com `parentLayerId === null` viram nós
   * raiz "soltos" (sem aplique pai).
   *
   * Ordenação: respeita a z-order do canvas (objetos no fundo vêm
   * primeiro no array — usuário verá os de cima no canvas listados
   * no topo do painel via reverse no caller).
   */
  getLayersHierarchy(): LayerNode[] {
    const canvasObjects = this.canvas.getObjects();
    const indexOf = (id: string): number => {
      const obj = this.findByCapiId(id);
      return obj ? canvasObjects.indexOf(obj) : -1;
    };

    // Tipos locais pra evitar narrowing pain — separamos principal e leaf.
    type PrincipalNode = Extract<LayerNode, { kind: 'principal' }>;
    type LeafNode = Extract<LayerNode, { kind: 'visual' | 'operation' }>;

    const principals: PrincipalNode[] = [];
    const orphans: LeafNode[] = [];

    // Primeiro passe: monta os principais.
    for (const meta of this.layerMeta.values()) {
      if (meta.kind === 'principal') {
        principals.push({
          kind: 'principal',
          id: meta.id,
          name: meta.name,
          visible: meta.visible,
          locked: meta.locked,
          children: [],
        });
      }
    }
    const principalById = new Map<string, PrincipalNode>(principals.map((p) => [p.id, p]));

    // Segundo passe: distribui filhos pros pais ou pra órfãos.
    for (const meta of this.layerMeta.values()) {
      if (meta.kind === 'principal') continue;
      const node: LeafNode = {
        kind: meta.kind,
        id: meta.id,
        name: meta.name,
        visible: meta.visible,
        locked: meta.locked,
        parentId: meta.parentLayerId ?? null,
      };
      const parent = meta.parentLayerId ? principalById.get(meta.parentLayerId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        orphans.push(node);
      }
    }

    // Ordena por z-index do canvas (topo do array = z mais alto).
    const byZ = (a: LayerNode, b: LayerNode): number => indexOf(b.id) - indexOf(a.id);
    principals.sort(byZ);
    for (const p of principals) p.children.sort(byZ);
    orphans.sort(byZ);

    return [...principals, ...orphans];
  }

  // ─── Material API ─────────────────────────────────────────────────────────

  /**
   * Applies a PNG material to a visual layer.
   *
   * - Sets a `fabric.Pattern` fill on the Fabric object (Checkpoint B).
   * - When a product SVG has been loaded, also applies an `absolutePositioned`
   *   `fabric.Path` clip matching the product's contour (Checkpoint C, Cenário 1).
   *   The clip is a fixed canvas-space window: only the portion of the layer
   *   that overlaps the product silhouette is rendered.
   *
   * @param layerId    capi object id
   * @param materialId id from the materials table (persisted in LayerMeta)
   * @param assetUrl   WebView-accessible URL (from resolveAssetUrl)
   */
  async applyMaterialToLayer(layerId: string, materialId: string, assetUrl: string): Promise<void> {
    const obj = findById(this.canvas, layerId);
    if (!obj) return;

    const w = obj.width ?? 0;
    const h = obj.height ?? 0;

    // Cached loader: reuse the HTMLImageElement for the same materialId
    // across calls within a session (avoids repeated IPC / network round-trips).
    // Cache key is materialId — stable across Tauri asset-URL regeneration.
    const cachedLoader = async (url: string): Promise<HTMLImageElement> => {
      const hit = this.materialImageCache.get(materialId);
      if (hit) return hit;
      const img = await loadImage(url);
      this.materialImageCache.set(materialId, img);
      return img;
    };

    const pattern = await buildMaterialPattern(assetUrl, w, h, cachedLoader);

    // Single set() call — avoids any intermediate render on the animation frame
    // between setting fill and clipPath (Fabric Q3 recommendation).
    const clipPath = this.buildProductClipPath();
    obj.set(clipPath !== null ? { fill: pattern, clipPath } : { fill: pattern });

    // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
    const meta = this.layerMeta.get(layerId);
    if (meta && !isOperationLayer(meta)) meta.materialId = materialId;

    this.canvas.requestRenderAll();
  }

  /**
   * Applies a PNG material to the product base (Onda 12 F4.3 — front rework).
   *
   * Diferença pra applyMaterialToLayer:
   *  - Atua no objeto marcado com BASE_OBJECT_FLAG (a base do produto, carregada
   *    em loadProductSvgFromMeta) — não em uma camada visual qualquer.
   *  - NÃO precisa de clipPath: a base JÁ é o próprio shape do produto.
   *    O pattern preenche o group todo, que é o silhouette do broche/placa.
   *  - A base é `excludeFromExport: true` — o material aplicado aqui aparece
   *    no canvas (UX) e no export PNG (mockup pro cliente), mas NÃO entra no
   *    SVG production (o laser não corta material, só contornos).
   *
   * Sem efeito se nenhum produto foi carregado ainda.
   *
   * @param materialId id da tabela materials (referência semântica, não persistido em LayerMeta)
   * @param assetUrl   URL acessível pela WebView (de resolveAssetUrl)
   */
  async applyMaterialToBase(materialId: string, assetUrl: string): Promise<void> {
    const baseObj = this.canvas.getObjects().find((o) => isBaseObject(o));
    if (!baseObj) {
      if (import.meta.env.DEV) {
        console.warn('[canvas-engine] applyMaterialToBase: no base object loaded.');
      }
      return;
    }

    const w = baseObj.width ?? 0;
    const h = baseObj.height ?? 0;

    // Mesmo padrão de cache da applyMaterialToLayer.
    const cachedLoader = async (url: string): Promise<HTMLImageElement> => {
      const hit = this.materialImageCache.get(materialId);
      if (hit) return hit;
      const img = await loadImage(url);
      this.materialImageCache.set(materialId, img);
      return img;
    };

    const pattern = await buildMaterialPattern(assetUrl, w, h, cachedLoader);

    // fill da base = pattern. Não toca em stroke (mantém o contorno preto do
    // produto pra continuar visível como linha de corte).
    baseObj.set({ fill: pattern });

    this.canvas.requestRenderAll();
  }

  /**
   * Builds a `fabric.Path` representing the product's SVG contour for use as
   * an `absolutePositioned` clipPath (Checkpoint C, Cenário 1 — ADR 008).
   *
   * Returns null when no product SVG has been loaded yet.
   *
   * Coordinate mapping:
   *   Path data is in SVG user units (mm). `scaleX`/`scaleY` map those units
   *   to canvas pixels so the clip aligns with the product group, which is
   *   always placed at canvas (0, 0) with the same scale factors.
   *
   * Multiple shapes are concatenated into a single compound path string to
   * avoid `fabric.Group` — which has known `absolutePositioned` issues in
   * Fabric 6 (GitHub #7742).
   */
  private buildProductClipPath(): fabric.Path | null {
    if (this.productPaths.length === 0 || !this.productSvgViewBox) return null;

    const sx = mmToPx(this.config.productWidthMm) / this.productSvgViewBox.width;
    const sy = mmToPx(this.config.productHeightMm) / this.productSvgViewBox.height;

    // Resolve the product group's canvas position so the clip aligns precisely.
    // With absolutePositioned: true, left/top are in canvas absolute space — they
    // must match the product group's origin. originX/originY: 'left'/'top' forces
    // Fabric to skip auto-centering (which would offset the path to its bbox center).
    const productGroup = this.canvas.getObjects().find((o) => isBaseObject(o));
    const pgLeft = productGroup?.left ?? 0;
    const pgTop = productGroup?.top ?? 0;

    const clipPath = new fabric.Path(this.productPaths.join(' '), {
      left: pgLeft,
      top: pgTop,
      originX: 'left',
      originY: 'top',
      scaleX: sx,
      scaleY: sy,
      absolutePositioned: true,
    });

    return clipPath;
  }

  /**
   * Clears the per-session HTMLImageElement cache.
   * After calling this, the next applyMaterialToLayer call for any materialId
   * will reload the image from the asset URL.
   * Exposed for tests and for scenarios where asset URLs are regenerated.
   */
  clearMaterialCache(): void {
    this.materialImageCache.clear();
  }

  /**
   * Pre-loads HTMLImageElement instances into the cache so that subsequent
   * applyMaterialToLayer calls for the same materialId are instant.
   *
   * Call this from the UI layer after deserialize() — pass the materialIds
   * found in capi.layers together with their resolved Tauri asset URLs.
   *
   * @param entries  Array of { id: materialId, url: resolved asset URL }
   */
  async preloadMaterials(entries: Array<{ id: string; url: string }>): Promise<void> {
    await Promise.all(
      entries.map(async ({ id, url }) => {
        if (this.materialImageCache.has(id)) return; // already cached
        try {
          const img = await loadImage(url);
          this.materialImageCache.set(id, img);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn(`[canvas-engine] preloadMaterials: failed to load "${id}":`, err);
          }
        }
      })
    );
  }

  /**
   * Removes the material from a layer, restoring the default layer fill
   * and clearing the product-contour clipPath if one was applied.
   */
  removeMaterialFromLayer(layerId: string): void {
    const obj = findById(this.canvas, layerId);
    if (!obj) return;

    obj.set({ fill: DEFAULT_LAYER_FILL, clipPath: undefined });

    // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
    const meta = this.layerMeta.get(layerId);
    if (meta && !isOperationLayer(meta)) meta.materialId = null;

    this.canvas.requestRenderAll();
  }

  // ─── Product SVG ─────────────────────────────────────────────────────────

  /**
   * Loads the product base SVG as a locked background group.
   *
   * Scale comes from the authoritative viewBox + canvasMm (NOT from
   * `group.width`), and the SVG's root width/height are stripped first
   * so Fabric treats viewBox user units as 1:1.
   *
   * @deprecated Prefer `loadProductSvgFromMeta` when the SVG comes from a
   * user upload — it reuses the already-parsed `CorelSvgMeta` and avoids
   * double-parsing.
   */
  async loadProductSvg(svgString: string, viewBox: ParsedViewBox): Promise<void> {
    const stripped = parseAndStripRootDimensions(svgString);
    const { objects } = await fabric.loadSVGFromString(stripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) return;

    // ADR 010 §3: canvas engine is authoritative for base-layer colour.
    // fill: '' = no fill in Fabric/Canvas2D. Do NOT use 'none' here — Canvas2D
    // does not recognise 'none' as a valid fillStyle and falls back to black.
    // (SVG fill="none" is injected by cleanCorelSvg step 9 for the SVG parser,
    // but Fabric's Canvas2D renderer needs the empty-string sentinel instead.)
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = mmToPx(this.config.productWidthMm) / viewBox.width;
    const scaleY = mmToPx(this.config.productHeightMm) / viewBox.height;

    if (import.meta.env.DEV && Math.abs(scaleX - scaleY) > ASPECT_TOLERANCE) {
      console.warn(
        `[canvas-engine] Non-uniform product scale: ` +
          `canvasMm=${this.config.productWidthMm}×${this.config.productHeightMm}, ` +
          `viewBox=${viewBox.width}×${viewBox.height} → scale ${scaleX.toFixed(4)} vs ${scaleY.toFixed(4)}. ` +
          `Product viewBox and canvasMm should agree on aspect ratio.`
      );
    }

    group.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX,
      scaleY,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
    });
    (group as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;

    // Extract clip shapes AFTER confirming valid Fabric objects were found.
    // Coordinates are in SVG user units (mm); scale is applied at clip time.
    this.productPaths = extractClipShapes(svgString);
    this.productSvgViewBox = { width: viewBox.width, height: viewBox.height };

    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    this.canvas.requestRenderAll();
  }

  /**
   * Loads the product base SVG from already-parsed `CorelSvgMeta`.
   *
   * Preferred over `loadProductSvg` for user-uploaded SVGs: the SVG has
   * already passed the 6 validation gates in `parseCorelSvg`, and
   * `meta.svgStripped` is ready for Fabric without further processing.
   *
   * Scale is derived from `meta.scaleFactor` (width axis), with the height
   * axis computed independently. Both axes are guaranteed to agree within
   * 0.1% by gate 2 of `parseCorelSvg`, so the product always renders at
   * its exact physical size.
   *
   * In DEV mode, logs a warning when the SVG's physical dimensions diverge
   * from the engine's `EngineConfig.productWidthMm` by more than 0.5% —
   * which would indicate a mismatch between the DB product record and the
   * file on disk.
   */
  async loadProductSvgFromMeta(meta: CorelSvgMeta): Promise<void> {
    const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) return;

    // ADR 010 §3: canvas engine is authoritative for base-layer colour.
    // fill: '' = no fill in Fabric/Canvas2D. Do NOT use 'none' here — Canvas2D
    // does not recognise 'none' as a valid fillStyle and falls back to black.
    // (SVG fill="none" is injected by cleanCorelSvg step 9 for the SVG parser,
    // but Fabric's Canvas2D renderer needs the empty-string sentinel instead.)
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = meta.scaleFactor; // (MM_TO_PX × widthMm) / viewBoxW
    const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH; // independent axis for symmetry

    if (import.meta.env.DEV) {
      const configW = this.config.productWidthMm;
      const drift = Math.abs(meta.widthMm - configW) / configW;
      if (drift > 0.005) {
        console.warn(
          `[canvas-engine] SVG widthMm (${meta.widthMm.toFixed(3)}) differs from ` +
            `EngineConfig.productWidthMm (${configW}) by ${(drift * 100).toFixed(2)}%. ` +
            `Check that the product DB record matches the file.`
        );
      }
    }

    group.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX,
      scaleY,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
    });
    (group as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;

    // svgStripped has root width/height removed but all path data intact —
    // extractClipShapes only reads <path d="…"> elements, which are preserved.
    this.productPaths = extractClipShapes(meta.svgStripped);
    this.productSvgViewBox = { width: meta.viewBoxW, height: meta.viewBoxH };

    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    this.canvas.requestRenderAll();
  }

  /**
   * Loads an applique SVG onto the canvas as a new principal layer.
   *
   * Positioning is literal + centred relative to the product viewBox (R3):
   *   left = mmToPx((productWidthMm  − meta.widthMm)  / 2)
   *   top  = mmToPx((productHeightMm − meta.heightMm) / 2)
   * If the applique is larger than the product, left/top go negative — this is
   * intentional (applique extravasates the product boundary by design).
   *
   * @param meta       Parsed CorelSvgMeta (from parseCorelSvg)
   * @param name       Human-readable layer name shown in the layers panel
   * @param appliqueId FK → appliques.id in the local database
   * @returns          Stable capi id of the created layer
   */
  async addAppliqueSvg(meta: CorelSvgMeta, name: string, appliqueId: string): Promise<string> {
    const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) {
      throw new Error(
        `[canvas-engine] addAppliqueSvg: no drawable shapes in SVG for applique "${appliqueId}".`
      );
    }

    // ADR 011: fill: '' = transparent in Fabric/Canvas2D. Do NOT use 'none'.
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = meta.scaleFactor;
    const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

    // R3: literal centering — applique may extravasate when larger than product.
    const left = mmToPx((this.config.productWidthMm - meta.widthMm) / 2);
    const top = mmToPx((this.config.productHeightMm - meta.heightMm) / 2);

    group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

    const id = generateObjectId();
    (group as unknown as Record<string, unknown>).id = id;

    this.canvas.add(group);
    this.canvas.requestRenderAll();

    const principalMeta: PrincipalLayerMeta = {
      id,
      parentLayerId: null,
      name,
      zIndex: this.canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'principal',
      materialId: null,
      appliqueId,
      // Mini-Onda 8.6: bounds autoritativos do viewBox SVG (ADR 005).
      // left/top vêm do cálculo de centragem (em mm, sem passar pelo Fabric).
      // width/height vêm direto de meta.widthMm/heightMm do parseCorelSvg
      // (que lê do header width="Xmm" do SVG). Sem erro de margem.
      originalBounds: {
        left: (this.config.productWidthMm - meta.widthMm) / 2,
        top: (this.config.productHeightMm - meta.heightMm) / 2,
        width: meta.widthMm,
        height: meta.heightMm,
      },
    };
    this.layerMeta.set(id, principalMeta);

    return id;
  }

  /**
   * Adiciona uma gravação do banco como camada visual no canvas (Onda 8.5).
   *
   * Diferenças vs `addAppliqueSvg`:
   *   - Cria `VisualLayerMeta` (kind: 'visual'), não principal — gravação é
   *     filha de aplique, não peça física.
   *   - Aceita `parentLayerId` opcional do caller (resolvido via
   *     `resolveParentAppliqueId` no painel). Quando há aplique pai válido,
   *     posiciona no centro do APLIQUE (não do canvas); senão, centro do canvas.
   *   - Persiste `engravingId` em `VisualLayerMeta.engravingId` — Onda 9 lê
   *     isso pra rotear pra máquina/operação correta via `engraving.metadata`.
   *     Padrão idêntico ao `appliqueId` em `PrincipalLayerMeta`.
   *   - Seleciona o grupo recém-criado (setActiveObject + selection:created).
   *
   * Retorna o capi id do grupo (novo VisualLayer).
   */
  async addEngravingSvg(
    meta: CorelSvgMeta,
    name: string,
    engravingId: string,
    parentLayerId: string | null
  ): Promise<string> {
    const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) {
      throw new Error(
        `[canvas-engine] addEngravingSvg: no drawable shapes in SVG for engraving "${engravingId}".`
      );
    }

    // ADR 011: fill: '' = transparent. Stroke padrão da peça.
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = meta.scaleFactor;
    const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

    // Posição inicial: centro do aplique pai quando há parentLayerId válido,
    // senão centro do canvas. parentBounds vem em mm, convertemos pra px.
    const parentBounds = parentLayerId ? this.getParentBoundsForObject(parentLayerId) : null;
    const cxMm = parentBounds
      ? parentBounds.left + parentBounds.width / 2
      : this.config.productWidthMm / 2;
    const cyMm = parentBounds
      ? parentBounds.top + parentBounds.height / 2
      : this.config.productHeightMm / 2;
    const left = mmToPx(cxMm - meta.widthMm / 2);
    const top = mmToPx(cyMm - meta.heightMm / 2);

    group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

    const id = generateObjectId();
    (group as unknown as Record<string, unknown>).id = id;

    this.canvas.add(group);

    const visualMeta: VisualLayerMeta = {
      id,
      parentLayerId,
      name,
      zIndex: this.canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'visual',
      materialId: null,
      engravingId,
    };
    this.layerMeta.set(id, visualMeta);

    // Seleciona o grupo recém-criado — feedback imediato + atalho pra
    // alignment/proximity overlay reagir na sequência.
    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();

    return id;
  }

  /**
   * Adiciona uma marcação do banco como camada visual no canvas (Onda 9).
   *
   * Espelha `addEngravingSvg`: cria `VisualLayerMeta` filha do aplique
   * selecionado (ou solta), com `markingId` persistido pra Onda 9 rotear
   * pra máquina/operação correta no export. A única diferença frente à
   * gravação é o campo de FK em si — engravingId vs markingId.
   *
   * Retorna o capi id do grupo (novo VisualLayer).
   */
  async addMarkingSvg(
    meta: CorelSvgMeta,
    name: string,
    markingId: string,
    parentLayerId: string | null
  ): Promise<string> {
    const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) {
      throw new Error(
        `[canvas-engine] addMarkingSvg: no drawable shapes in SVG for marking "${markingId}".`
      );
    }

    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = meta.scaleFactor;
    const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

    const parentBounds = parentLayerId ? this.getParentBoundsForObject(parentLayerId) : null;
    const cxMm = parentBounds
      ? parentBounds.left + parentBounds.width / 2
      : this.config.productWidthMm / 2;
    const cyMm = parentBounds
      ? parentBounds.top + parentBounds.height / 2
      : this.config.productHeightMm / 2;
    const left = mmToPx(cxMm - meta.widthMm / 2);
    const top = mmToPx(cyMm - meta.heightMm / 2);

    group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

    const id = generateObjectId();
    (group as unknown as Record<string, unknown>).id = id;

    this.canvas.add(group);

    const visualMeta: VisualLayerMeta = {
      id,
      parentLayerId,
      name,
      zIndex: this.canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'visual',
      materialId: null,
      markingId,
    };
    this.layerMeta.set(id, visualMeta);

    this.canvas.setActiveObject(group);
    this.canvas.requestRenderAll();

    return id;
  }

  /**
   * Adds a user-editable rectangle in product mm coordinates.
   * Top-left positioning, dimensions in mm.
   * Automatically registers a LayerMeta entry (kind='visual').
   */
  addRectangle(xMm: number, yMm: number, wMm: number, hMm: number): fabric.Rect {
    const rect = new fabric.Rect({
      left: mmToPx(xMm),
      top: mmToPx(yMm),
      width: mmToPx(wMm),
      height: mmToPx(hMm),
      originX: 'left',
      originY: 'top',
      fill: DEFAULT_LAYER_FILL,
      stroke: '#7aa2f7',
      strokeWidth: 1,
      strokeUniform: true,
      cornerColor: '#7aa2f7',
      cornerStrokeColor: '#7aa2f7',
      borderColor: '#7aa2f7',
      transparentCorners: false,
      cornerSize: 8,
    });
    this.canvas.add(rect);

    // Assign a stable id immediately so layerMeta can be keyed by it.
    const rec = rect as unknown as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id) {
      rec.id = generateObjectId();
    }
    this.registerLayerMeta(rec.id as string);

    this.canvas.setActiveObject(rect);
    this.canvas.requestRenderAll();
    return rect;
  }

  /**
   * Removes every object that wasn't tagged as base (product SVG).
   * Also clears the SlotManager's internal map and all LayerMeta entries.
   */
  clearUserObjects(): void {
    // Fase C: cancela fade em curso e zera referências às guias visuais —
    // elas serão removidas junto com os outros user objects, mas o estado
    // interno (`currentGuides`, `lastSnapResult`) precisa ser resetado para
    // não apontar para fabric.Lines fora do canvas.
    this.cancelFadeAnimations();
    this.currentGuides = { x: null, y: null };
    this.lastSnapResult = null;
    // Fase E: idem para as linhas de medição. Reset das refs aqui evita
    // o filter abaixo deixar refs apontando pra fabric.Lines descartadas.
    this.measurementLines = { v: null, h: null };
    // Fase E2: idem pras linhas de proximidade.
    this.proximityLines = { top: null, bottom: null, left: null, right: null };
    // Fase F: pontinhos da grade NÃO são removidos por clearUserObjects — não
    // são "user objects". Skip explícito no filter abaixo (o Rect deles não
    // tem __capiBase, então a filtragem padrão removeria por engano).
    const gridRect = this.gridDotsRect;

    const toRemove = this.canvas.getObjects().filter((o) => !isBaseObject(o) && o !== gridRect);
    toRemove.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.slotManager.clear();
    this.layerMeta.clear();
    this.canvas.requestRenderAll();
  }

  // ─── Slot API ─────────────────────────────────────────────────────────────

  /**
   * Creates a new slot at the centre of the product area and returns its metadata.
   * Automatically registers a LayerMeta entry for the slot (kind='visual').
   *
   * @param parentLayerId  Optional. capi id of an existing principal layer (aplique).
   *                       When provided, the slot's LayerMeta will reference it as
   *                       parent — this is what lets `getParentBoundsForObject`
   *                       resolve a slot inside an aplique to its parent's bounds
   *                       (ADR 014 §6, used by snap and Onda 7b alignment toolbar).
   *                       null/undefined → slot lives directly on the product canvas.
   */
  createSlot(type: SlotType, parentLayerId?: string | null): SlotMeta {
    const meta = this.slotManager.createSlot(type);
    this.registerLayerMeta(meta.id, parentLayerId ?? null);
    return meta;
  }

  /**
   * Switches between Designer and Operator modes.
   * Designer = slot overlays visible. Operator = overlays hidden, content only.
   */
  setMode(mode: 'designer' | 'operator'): void {
    this.slotManager.setMode(mode);
  }

  /**
   * Rebuilds the SlotManager state from objects currently on the canvas.
   * Call this after `deserialize()` to restore slot overlays and internal map.
   */
  loadSlotsFromCanvas(): void {
    this.slotManager.loadSlotsFromCanvas();
  }

  /** Returns all SlotMeta objects of the given type (read-only snapshot). */
  getSlotsByType(type: SlotType): SlotMeta[] {
    return this.slotManager.getSlotsByType(type);
  }

  /**
   * Lê texto atual de um slot. Delegação pro SlotManager.getSlotText.
   * Onda 9.F (auto-fill dialog export PNG) + reuso futuro pela Onda 11.
   */
  getSlotText(slotId: string): string | null {
    return this.slotManager.getSlotText(slotId);
  }

  /**
   * Applies fitText and renders the text inside the first slot of the given type.
   * No-op if no slot of that type exists.
   */
  fillTextSlot(type: 'nome' | 'profissao', text: string, fontFamily: string): void {
    const slots = this.slotManager.getSlotsByType(type);
    if (slots.length === 0) return;
    this.slotManager.addText(slots[0].id, text, fontFamily);
  }

  /**
   * Loads an SVG string into the first logo slot, scaled and centred.
   * No-op if no logo slot exists.
   */
  async fillLogoSlot(svgString: string): Promise<void> {
    const slots = this.slotManager.getSlotsByType('logo');
    if (slots.length === 0) return;
    await this.slotManager.addLogo(slots[0].id, svgString);
  }

  /**
   * Removes text or logo content from the first slot of the given type.
   * No-op if no slot of that type exists.
   */
  clearSlotContent(type: SlotType): void {
    const slots = this.slotManager.getSlotsByType(type);
    if (slots.length === 0) return;
    this.slotManager.clearSlotContent(slots[0].id);
  }

  // ─── Zoom / Pan ───────────────────────────────────────────────────────────

  /** Multiplies current zoom by `factor`, clamped, centered on viewport center. */
  zoomBy(factor: number): void {
    const current = this.canvas.getZoom();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
    if (next === current) return;
    const center = new fabric.Point(
      this.config.viewportWidthPx / 2,
      this.config.viewportHeightPx / 2
    );
    this.canvas.zoomToPoint(center, next);
    this.canvas.requestRenderAll();
  }

  /** Resets zoom to 1 and re-centers the product. */
  resetView(): void {
    this.centerProductInViewport();
    this.canvas.requestRenderAll();
  }

  /**
   * Toggles pan mode. While active: selection disabled, all user objects
   * un-selectable/un-evented, cursor becomes grab/grabbing during drag.
   * Disabling restores selectability.
   */
  setPanMode(active: boolean): void {
    if (this.isPanModeActive === active) return;
    this.isPanModeActive = active;

    if (active) {
      this.canvas.discardActiveObject();
      this.canvas.selection = false;
      this.canvas.forEachObject((o) => {
        if (!isBaseObject(o)) {
          o.selectable = false;
          o.evented = false;
        }
      });
      this.canvas.defaultCursor = 'grab';
      this.canvas.hoverCursor = 'grab';
      this.canvas.setCursor('grab');
    } else {
      this.isDragging = false;
      this.canvas.selection = true;
      this.canvas.forEachObject((o) => {
        if (!isBaseObject(o)) {
          o.selectable = true;
          o.evented = true;
        }
      });
      this.canvas.defaultCursor = 'default';
      this.canvas.hoverCursor = 'move';
    }
    this.canvas.requestRenderAll();
  }

  // ─── Measurement (Onda 7b, Fase E) ────────────────────────────────────────

  /**
   * Renderiza/atualiza as 2 linhas de medição em formato "L" entre os centros
   * de 2 objetos. Idempotente — chame sempre que a posição mudar (drag,
   * mudança de seleção). Cria as linhas na primeira chamada e reusa nas
   * próximas via `set({...})` (ADR 011 — nunca atribuição direta).
   *
   *   centerA ──── L horizontal ──── (centerXB, centerYA)
   *                                          │
   *                                       L vertical
   *                                          │
   *                                       centerB
   *
   * Coordenadas em mm; converte pra px com mmToPx no momento de aplicar.
   */
  renderMeasurementLines(rectA: RectMm, rectB: RectMm): void {
    const cxA = mmToPx(rectA.left + rectA.width / 2);
    const cyA = mmToPx(rectA.top + rectA.height / 2);
    const cxB = mmToPx(rectB.left + rectB.width / 2);
    const cyB = mmToPx(rectB.top + rectB.height / 2);

    // Linha H: horizontal, do centerA até a coluna de B no Y de A.
    const hCoords: [number, number, number, number] = [cxA, cyA, cxB, cyA];
    // Linha V: vertical, da coluna de B no Y de A até o centerB.
    const vCoords: [number, number, number, number] = [cxB, cyA, cxB, cyB];

    if (!this.measurementLines.h) {
      this.measurementLines.h = new fabric.Line(hCoords, {
        stroke: '#7dd3fc',
        strokeWidth: 1,
        strokeDashArray: [6, 3],
        strokeUniform: true,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
      });
      this.canvas.add(this.measurementLines.h);
    } else {
      this.measurementLines.h.set({
        x1: hCoords[0],
        y1: hCoords[1],
        x2: hCoords[2],
        y2: hCoords[3],
      });
      this.measurementLines.h.setCoords();
    }

    if (!this.measurementLines.v) {
      this.measurementLines.v = new fabric.Line(vCoords, {
        stroke: '#7dd3fc',
        strokeWidth: 1,
        strokeDashArray: [6, 3],
        strokeUniform: true,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
      });
      this.canvas.add(this.measurementLines.v);
    } else {
      this.measurementLines.v.set({
        x1: vCoords[0],
        y1: vCoords[1],
        x2: vCoords[2],
        y2: vCoords[3],
      });
      this.measurementLines.v.setCoords();
    }

    // Sobe as linhas pro topo da z-order pra não ficarem atrás de objetos.
    if (this.measurementLines.h) this.canvas.bringObjectToFront(this.measurementLines.h);
    if (this.measurementLines.v) this.canvas.bringObjectToFront(this.measurementLines.v);
    this.canvas.requestRenderAll();
  }

  /** Remove as linhas de medição do canvas, se existirem. Idempotente. */
  clearMeasurementLines(): void {
    if (this.measurementLines.h) {
      this.canvas.remove(this.measurementLines.h);
      this.measurementLines.h = null;
    }
    if (this.measurementLines.v) {
      this.canvas.remove(this.measurementLines.v);
      this.measurementLines.v = null;
    }
    this.canvas.requestRenderAll();
  }

  // ─── Proximity / Measurable objects (Onda 7b, Fase E2) ────────────────────

  /**
   * Lista os objetos do canvas que podem ser obstáculos pra cálculo de
   * proximidade — i.e. todos com capi id, em coordenadas mm. Usa getCapiId
   * (Fix #1 da Fase D) pra resolver slots (capiSlot.id) e demais objetos
   * (obj.id direto) num critério único. Filtra:
   *
   *   - base SVG (__capiBase)
   *   - objetos sem capi id (slot overlay, placeholder de logo, snap guides,
   *     measurement lines, proximity lines)
   *   - objetos invisíveis
   *
   * Caller (ProximityOverlay) é responsável por excluir o próprio target
   * via `id !== targetId`.
   */
  getMeasurableObjects(): Array<{ id: string; rect: RectMm }> {
    const result: Array<{ id: string; rect: RectMm }> = [];
    for (const obj of this.canvas.getObjects()) {
      if (isBaseObject(obj)) continue;
      if (!obj.visible) continue;
      const id = getCapiId(obj as unknown as Record<string, unknown>);
      if (!id) continue;

      const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
      result.push({
        id,
        rect: {
          left: pxToMm(obj.left ?? 0),
          top: pxToMm(obj.top ?? 0),
          width: pxToMm(w),
          height: pxToMm(h),
        },
      });
    }
    return result;
  }

  /**
   * Renderiza/atualiza as 4 linhas tracejadas violeta ligando o target às
   * coisas mais próximas (ou às bordas da placa). Idempotente — chame
   * sempre que posição mudar (drag, mudança de seleção). Cria as linhas
   * na primeira chamada e reusa nas próximas via `set({...})` (ADR 011).
   *
   * Cada linha sai do meio da borda correspondente do target em direção
   * perpendicular ao obstáculo:
   *   - top:    do meio da borda superior do target, sobe `result.top` mm
   *   - bottom: do meio da borda inferior, desce `result.bottom` mm
   *   - left:   do meio da borda esquerda, vai à esquerda `result.left` mm
   *   - right:  do meio da borda direita, vai à direita `result.right` mm
   */
  renderProximityLines(target: RectMm, result: ProximityResult): void {
    const cx = mmToPx(target.left + target.width / 2);
    const cy = mmToPx(target.top + target.height / 2);
    const tLeft = mmToPx(target.left);
    const tRight = mmToPx(target.left + target.width);
    const tTop = mmToPx(target.top);
    const tBottom = mmToPx(target.top + target.height);

    // Coordenadas das 4 linhas (do meio da borda do target até o ponto-alvo).
    const coords = {
      top: [cx, tTop, cx, tTop - mmToPx(result.top)] as [number, number, number, number],
      bottom: [cx, tBottom, cx, tBottom + mmToPx(result.bottom)] as [
        number,
        number,
        number,
        number,
      ],
      left: [tLeft, cy, tLeft - mmToPx(result.left), cy] as [number, number, number, number],
      right: [tRight, cy, tRight + mmToPx(result.right), cy] as [number, number, number, number],
    };

    // Sem `as const`: strokeDashArray precisa ser `number[]` mutável
    // pelo tipo do Fabric. Cada `new fabric.Line` recebe seu próprio array
    // (cópia rasa via spread no objeto literal abaixo) — não há
    // compartilhamento de mutação entre linhas.
    const lineOpts = {
      stroke: '#a78bfa',
      strokeWidth: 1,
      strokeDashArray: [6, 3],
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
    };

    const upsert = (key: keyof typeof coords): void => {
      const c = coords[key];
      const existing = this.proximityLines[key];
      if (!existing) {
        const line = new fabric.Line(c, lineOpts);
        this.proximityLines[key] = line;
        this.canvas.add(line);
      } else {
        existing.set({ x1: c[0], y1: c[1], x2: c[2], y2: c[3] });
        existing.setCoords();
      }
      const live = this.proximityLines[key];
      if (live) this.canvas.bringObjectToFront(live);
    };

    upsert('top');
    upsert('bottom');
    upsert('left');
    upsert('right');
    this.canvas.requestRenderAll();
  }

  /** Remove as 4 linhas de proximidade do canvas, se existirem. Idempotente. */
  clearProximityLines(): void {
    (['top', 'bottom', 'left', 'right'] as const).forEach((key) => {
      const line = this.proximityLines[key];
      if (line) {
        this.canvas.remove(line);
        this.proximityLines[key] = null;
      }
    });
    this.canvas.requestRenderAll();
  }

  // ─── Grid dots (Onda 7b, Fase F) ──────────────────────────────────────────

  /**
   * Renderiza pontinhos da grade de 1mm dentro da área útil do produto via
   * fabric.Pattern. Idempotente — chame quantas vezes quiser, só cria 1 vez.
   *
   * Implementação: 1 fabric.Rect cobrindo `(0,0) — (productWidthMm, productHeightMm)`,
   * preenchido com Pattern de tile 4×4px (= 1mm × 1mm em DPI=4) contendo
   * 1 dot 1×1px no canto. `repeat: 'repeat'` cobre toda a área via tiling.
   *
   * Decisão (ADR 015): mil cliques < 27000 fabric.Circle individuais. Pattern
   * é GPU-accelerated por padrão e só ocupa 1 slot na lista de objects.
   *
   * Cor `ink-600` (#3a3d3f) — distingue da borda do produto (ink-700 #2a2c2e)
   * sem virar ruído visual.
   */
  renderGridDots(): void {
    if (this.gridDotsRect) {
      // Já renderizado — só garante visibilidade caso clear → render rápido.
      this.gridDotsRect.set({ visible: true });
      this.canvas.requestRenderAll();
      return;
    }

    // Tile 4×4px = 1mm × 1mm. Dot 1×1px no canto superior-esquerdo.
    const tileSizePx = mmToPx(1);
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = tileSizePx;
    patternCanvas.height = tileSizePx;
    const patternCtx = patternCanvas.getContext('2d');
    if (!patternCtx) {
      // Sem 2D context (caso raro em ambiente headless) — silenciosamente desiste.
      return;
    }
    // imageSmoothingEnabled=false mantém o dot como pixel cru, sem antialias
    // borrar a borda quando o Pattern repete em zoom > 1.
    patternCtx.imageSmoothingEnabled = false;
    patternCtx.fillStyle = '#3a3d3f'; // ink-600
    patternCtx.fillRect(0, 0, 1, 1);

    const pattern = new fabric.Pattern({
      source: patternCanvas,
      repeat: 'repeat',
    });

    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      width: mmToPx(this.config.productWidthMm),
      height: mmToPx(this.config.productHeightMm),
      fill: pattern,
      stroke: undefined,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      objectCaching: false,
      hoverCursor: 'default',
    });
    this.gridDotsRect = rect;
    this.canvas.add(rect);
    // Pontinhos vão ATRÁS dos user objects mas À FRENTE da base SVG (o
    // contorno da peça precisa permanecer visível). bringObjectToFront
    // resolveria errado; sendObjectToBack iria atrás da base. Fabric 6
    // não tem método "send to position" — usamos reorder via index do array.
    //
    // Estratégia simples: pontos viram penúltimo (logo após a base). Como
    // a base é o object[0], chamamos sendObjectToBack + bringObjectForward
    // 1 vez pra ir pra index=1.
    this.canvas.sendObjectToBack(rect);
    this.canvas.bringObjectForward(rect);
    this.canvas.requestRenderAll();
  }

  /** Esconde os pontinhos da grade. Idempotente. */
  clearGridDots(): void {
    if (!this.gridDotsRect) return;
    this.canvas.remove(this.gridDotsRect);
    this.gridDotsRect = null;
    this.canvas.requestRenderAll();
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Serializes user objects (excludeFromExport=true on the base SVG keeps it
   * out of the output). Each object gets a stable `id` if it didn't already
   * have one.
   *
   * STRIP-BEFORE-SERIALIZE (symmetric): before `canvas.toObject()` we temporarily
   * remove two transient state values that must NOT be baked into the JSON:
   *   1. `fill` Pattern — references Tauri asset URLs that may become stale.
   *      Replaced with 'transparent'; restored from capi.layers on deserialize.
   *   2. `clipPath` — derived deterministically from `productPaths` at runtime.
   *      Re-applied by `applyMaterialToLayer` → `buildProductClipPath` on deserialize.
   * Both are restored on the live canvas immediately after the snapshot, so
   * `serialize()` has zero side-effects on the visible canvas state.
   */
  serialize(productId: string): SerializedCanvas {
    // Ensure user objects have ids.
    // Fase C: pula `excludeFromExport: true` (snap guides, slot overlays sem id)
    // — eles não vão pro toJSON e não devem receber id parasita aqui.
    this.canvas.forEachObject((o) => {
      if (isBaseObject(o)) return;
      if (o.excludeFromExport) return;
      const rec = o as unknown as Record<string, unknown>;
      if (typeof rec.id !== 'string' || !rec.id) {
        rec.id = generateObjectId();
      }
    });

    // STRIP — remove Pattern fills and clipPaths before snapshot.
    // Rationale: Pattern fills reference Tauri asset URLs that may become stale
    // across app installs; clipPaths are derived from productPaths (engine state)
    // and must be rebuilt deterministically on deserialize — not baked in JSON.
    // The canonical materialId is preserved in capi.layers instead.
    const savedFills = new Map<string, fabric.Pattern>();
    const savedClipPaths = new Map<string, fabric.FabricObject>();
    this.canvas.forEachObject((o) => {
      if (isBaseObject(o)) return;
      const id = (o as unknown as Record<string, unknown>).id as string;
      if (o.fill instanceof fabric.Pattern) {
        savedFills.set(id, o.fill as fabric.Pattern);
        o.set({ fill: 'transparent' });
      }
      if (o.clipPath) {
        savedClipPaths.set(id, o.clipPath as fabric.FabricObject);
        o.set({ clipPath: undefined });
      }
    });

    const json = this.canvas.toObject([...CAPI_CUSTOM_PROPS]) as {
      version: string;
      objects: Array<Record<string, unknown>>;
    };

    // RESTORE — symmetric: live canvas state must not be permanently mutated.
    savedFills.forEach((pattern, id) => {
      const obj = findById(this.canvas, id);
      obj?.set({ fill: pattern });
    });
    savedClipPaths.forEach((clipPath, id) => {
      const obj = findById(this.canvas, id);
      obj?.set({ clipPath });
    });

    // Build layers array, computing current zIndex from canvas order.
    const allObjects = this.canvas.getObjects();
    const layers: LayerMeta[] = Array.from(this.layerMeta.values()).map((m) => ({
      ...m,
      zIndex: allObjects.findIndex(
        (o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === m.id
      ),
    }));

    return {
      version: json.version,
      objects: json.objects,
      capi: {
        productId,
        units: 'mm',
        schemaVersion: 2,
        layers,
      },
    };
  }

  /**
   * Replaces user objects with the ones described in `data`. The base SVG is
   * preserved (clearUserObjects only removes non-base objects, then enliven +
   * add re-creates the user objects). Idempotent: deserialize(serialize()) is
   * a no-op visually.
   *
   * @param resolveUrl  Optional async resolver: materialId → WebView URL.
   *                    When provided, material Patterns are re-applied for every
   *                    layer with a non-null materialId after enlivening objects.
   *                    The engine itself has no knowledge of Tauri APIs — the
   *                    caller supplies resolution (CanvasTest, tests, etc.).
   */
  async deserialize(
    data: SerializedCanvas,
    resolveUrl?: (materialId: string) => Promise<string>
  ): Promise<void> {
    this.clearUserObjects();

    // Restore layerMeta from the persisted array.
    for (const layer of data.capi?.layers ?? []) {
      this.layerMeta.set(layer.id, { ...layer });
    }

    if (!data.objects || data.objects.length === 0) {
      this.canvas.requestRenderAll();
      return;
    }

    const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(data.objects);
    for (const obj of enlivened) {
      this.canvas.add(obj);
    }
    this.slotManager.loadSlotsFromCanvas();

    // Re-apply material Patterns for all layers that had a materialId.
    // OperationLayerMeta has no materialId field — filter it out before accessing.
    if (resolveUrl) {
      await Promise.all(
        Array.from(this.layerMeta.entries())
          .filter(
            ([, meta]) => !isOperationLayer(meta) && (meta as VisualLayerMeta).materialId !== null
          )
          .map(async ([id, meta]) => {
            // Safe: filter above guarantees meta is PrincipalLayerMeta | VisualLayerMeta.
            const materialId = (meta as VisualLayerMeta).materialId!;
            try {
              const url = await resolveUrl(materialId);
              await this.applyMaterialToLayer(id, materialId, url);
            } catch (err) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[canvas-engine] Failed to re-apply material ${materialId} on layer ${id}:`,
                  err
                );
              }
            }
          })
      );
    }

    this.canvas.requestRenderAll();
  }

  dispose(): void {
    // Fase C: cancelar fade-outs em curso antes de descartar o canvas.
    // Sem isso, animation frames pendentes podem disparar callbacks em um canvas
    // já disposed (acessando this.canvas.remove / renderAll com state inválido).
    this.cancelFadeAnimations();
    void this.canvas.dispose();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Registers a new LayerMeta entry with default values for a visual layer.
   * Called after every user-object creation (addRectangle, createSlot).
   *
   * @param parentLayerId  capi id of the parent layer (e.g. aplique) when the
   *                       new layer lives inside another. null = root-level
   *                       (parent is the product canvas).
   */
  private registerLayerMeta(id: string, parentLayerId: string | null = null): void {
    if (this.layerMeta.has(id)) return; // idempotent
    // Emit VisualLayerMeta (ADR 010 §1). Principal layers are created explicitly
    // by addAppliqueSvg (Onda 6.5 Fase A+). Operation layers are deferred to Onda 7+.
    const meta: VisualLayerMeta = {
      id,
      parentLayerId,
      name: `Camada ${this.layerMeta.size + 1}`,
      zIndex: this.canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'visual',
      materialId: null,
    };
    this.layerMeta.set(id, meta);
  }
}

export function isBaseObject(obj: fabric.FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] === true;
}

export { BASE_OBJECT_FLAG };
