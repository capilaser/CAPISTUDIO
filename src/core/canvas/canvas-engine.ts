/**
 * CanvasEngine — wrapper enxuto do Fabric.js para o Capi Studio.
 *
 * Responsabilidades:
 *   - montar/desmontar o canvas Fabric num elemento <canvas>
 *   - manter unidade interna em mm (conversão para pixel via MM_TO_PX)
 *   - aplicar viewport do produto (px size = mm × MM_TO_PX)
 *   - carregar a base do produto (SVG) como objeto travado na camada "Base"
 *   - inserir formas básicas (rect, circle, line, text)
 *   - manter `capiId` e `layerId` estáveis em cada objeto Fabric
 *   - emitir eventos selection/object:added/object:modified para a UI
 *   - serializar / deserializar para o formato ProjectFile (toJSON/fromJSON)
 *
 * Princípios:
 *   - **Fidelidade de mm** (PROJECT_VISION §0.2): base importada NÃO sofre snap,
 *     toda coordenada em mm; conversão para px só ao render.
 *   - **Sem regra de negócio aqui** — exporters, validação, classificação ficam
 *     em outros módulos. Este é só o motor de canvas.
 */

import * as fabric from 'fabric';

import { mmToPx } from '@/core/canvas/units';
import { newObjectId } from '@/core/canvas/capi-id';
import type { CanvasObject, ProjectFile, ProjectViewport } from '@/core/project/project-file';

// ── Augmentação de tipo: Fabric Object com nossos metadados ─────────────────

declare module 'fabric' {
  interface FabricObject {
    capiId?: string;
    layerId?: string;
    /** True se foi importado de DXF/SVG — não passa por snap. */
    capiImported?: boolean;
  }
}

const SNAP_MM = 1;

export interface CanvasEngineEvents {
  /** Disparado depois de qualquer mudança que afete o ProjectFile. */
  onDirty?: () => void;
  /** Disparado quando a seleção muda. Recebe os capiIds selecionados. */
  onSelection?: (capiIds: string[]) => void;
}

export interface AddShapeOptions {
  layerId: string;
}

export class CanvasEngine {
  readonly fabric: fabric.Canvas;
  readonly viewport: ProjectViewport;
  private events: CanvasEngineEvents;
  private disposed = false;

  constructor(args: {
    canvasEl: HTMLCanvasElement;
    viewport: ProjectViewport;
    events?: CanvasEngineEvents;
  }) {
    this.viewport = args.viewport;
    this.events = args.events ?? {};

    const widthPx = mmToPx(args.viewport.widthMm);
    const heightPx = mmToPx(args.viewport.heightMm);
    this.fabric = new fabric.Canvas(args.canvasEl, {
      width: widthPx,
      height: heightPx,
      backgroundColor: '#0e1014',
      selection: true,
      preserveObjectStacking: true,
      uniformScaling: false,
      enableRetinaScaling: true,
    });

    this.bindEvents();
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.fabric.off();
    this.fabric.dispose();
  }

  // ── Viewport / dimensões ────────────────────────────────────────────────
  /** Reaplica o tamanho do canvas com base no viewport (após troca de produto). */
  syncViewport(): void {
    this.fabric.setDimensions({
      width: mmToPx(this.viewport.widthMm),
      height: mmToPx(this.viewport.heightMm),
    });
    this.fabric.requestRenderAll();
  }

  // ── Base do produto ────────────────────────────────────────────────────
  /**
   * Carrega a base SVG do produto como objeto Fabric e atribui à camada
   * Base (que o caller já criou no LayerService). O objeto fica travado
   * (selecionável pelo painel de camadas, mas não arrastável no canvas).
   *
   * O SVG deve estar em mm (viewBox em unidades de mm). Internamente
   * convertemos para px (× MM_TO_PX) UMA vez no carregamento. Geometria
   * exata é preservada — sem snap, sem rounding.
   */
  async loadBaseSvg(svg: string, layerId: string): Promise<void> {
    const result = await fabric.loadSVGFromString(svg);
    const group = fabric.util.groupSVGElements(result.objects.filter(Boolean) as fabric.Object[], {
      ...result.options,
    });

    // Escala mm → px (1 unidade do viewBox = 1 mm, e cada mm = MM_TO_PX px).
    group.scaleX = mmToPx(1);
    group.scaleY = mmToPx(1);
    group.left = 0;
    group.top = 0;
    group.selectable = true;
    group.evented = true;
    group.hasControls = false;
    group.hasBorders = true;
    group.lockMovementX = true;
    group.lockMovementY = true;
    group.lockScalingX = true;
    group.lockScalingY = true;
    group.lockRotation = true;
    group.capiId = newObjectId();
    group.layerId = layerId;
    group.capiImported = true;

    this.fabric.add(group);
    this.fabric.requestRenderAll();
    this.markDirty();
  }

  // ── Inserção de formas ──────────────────────────────────────────────────
  /**
   * Insere um retângulo centralizado no viewport com dimensões em mm.
   * Cores do stroke ficam pretas; a operação/máquina vem da camada.
   */
  addRectangle(opts: AddShapeOptions, widthMm = 20, heightMm = 10): string {
    const rect = new fabric.Rect({
      left: mmToPx(this.viewport.widthMm / 2 - widthMm / 2),
      top: mmToPx(this.viewport.heightMm / 2 - heightMm / 2),
      width: mmToPx(widthMm),
      height: mmToPx(heightMm),
      fill: 'transparent',
      stroke: '#e6e8eb',
      strokeWidth: 1,
      strokeUniform: true,
    });
    this.attachMeta(rect, opts.layerId);
    this.fabric.add(rect);
    this.fabric.setActiveObject(rect);
    this.fabric.requestRenderAll();
    this.markDirty();
    return rect.capiId ?? '';
  }

  addCircle(opts: AddShapeOptions, radiusMm = 8): string {
    const circle = new fabric.Circle({
      left: mmToPx(this.viewport.widthMm / 2 - radiusMm),
      top: mmToPx(this.viewport.heightMm / 2 - radiusMm),
      radius: mmToPx(radiusMm),
      fill: 'transparent',
      stroke: '#e6e8eb',
      strokeWidth: 1,
      strokeUniform: true,
    });
    this.attachMeta(circle, opts.layerId);
    this.fabric.add(circle);
    this.fabric.setActiveObject(circle);
    this.fabric.requestRenderAll();
    this.markDirty();
    return circle.capiId ?? '';
  }

  addLine(opts: AddShapeOptions, lengthMm = 30): string {
    const cx = mmToPx(this.viewport.widthMm / 2);
    const cy = mmToPx(this.viewport.heightMm / 2);
    const half = mmToPx(lengthMm / 2);
    const line = new fabric.Line([cx - half, cy, cx + half, cy], {
      stroke: '#e6e8eb',
      strokeWidth: 1,
      strokeUniform: true,
    });
    this.attachMeta(line, opts.layerId);
    this.fabric.add(line);
    this.fabric.setActiveObject(line);
    this.fabric.requestRenderAll();
    this.markDirty();
    return line.capiId ?? '';
  }

  addText(opts: AddShapeOptions, value = 'Texto', fontSizeMm = 6): string {
    const t = new fabric.IText(value, {
      left: mmToPx(this.viewport.widthMm / 2 - 10),
      top: mmToPx(this.viewport.heightMm / 2 - fontSizeMm / 2),
      fontFamily: 'Montserrat',
      fontSize: mmToPx(fontSizeMm),
      fill: '#e6e8eb',
    });
    this.attachMeta(t, opts.layerId);
    this.fabric.add(t);
    this.fabric.setActiveObject(t);
    this.fabric.requestRenderAll();
    this.markDirty();
    return t.capiId ?? '';
  }

  // ── Seleção e remoção ──────────────────────────────────────────────────
  removeSelected(): number {
    const objs = this.fabric.getActiveObjects().slice();
    if (objs.length === 0) return 0;
    let removed = 0;
    for (const o of objs) {
      // Não permite apagar objetos importados (base do produto).
      if (o.capiImported) continue;
      this.fabric.remove(o);
      removed++;
    }
    this.fabric.discardActiveObject();
    this.fabric.requestRenderAll();
    if (removed > 0) this.markDirty();
    return removed;
  }

  selectByCapiId(capiId: string): void {
    const target = this.fabric.getObjects().find((o) => o.capiId === capiId);
    if (target) {
      this.fabric.setActiveObject(target);
      this.fabric.requestRenderAll();
    }
  }

  discardSelection(): void {
    this.fabric.discardActiveObject();
    this.fabric.requestRenderAll();
  }

  // ── Visibilidade / lock de camada ───────────────────────────────────────
  setLayerVisibility(layerId: string, visible: boolean): void {
    let changed = 0;
    for (const o of this.fabric.getObjects()) {
      if (o.layerId === layerId && o.visible !== visible) {
        o.visible = visible;
        changed++;
      }
    }
    if (changed > 0) {
      this.fabric.requestRenderAll();
      this.markDirty();
    }
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    let changed = 0;
    for (const o of this.fabric.getObjects()) {
      if (o.layerId === layerId) {
        if (o.capiImported && !locked) {
          // Imported objects stay locked sempre — invariante de fidelidade.
          continue;
        }
        o.selectable = !locked;
        o.evented = !locked;
        if (!o.capiImported) {
          o.lockMovementX = locked;
          o.lockMovementY = locked;
          o.lockScalingX = locked;
          o.lockScalingY = locked;
          o.lockRotation = locked;
        }
        changed++;
      }
    }
    if (changed > 0) {
      this.fabric.requestRenderAll();
      this.markDirty();
    }
  }

  // ── Serialização ───────────────────────────────────────────────────────
  /**
   * Serializa todos os objetos para a forma `CanvasObject[]` do ProjectFile.
   *
   * Preserva `capiId`, `layerId`, `capiImported` como propriedades
   * adicionais via `toJSON([...extra fields])`. O reader do projeto
   * (loadFromProject) reaplica.
   */
  serializeObjects(): CanvasObject[] {
    const objs: CanvasObject[] = [];
    for (const o of this.fabric.getObjects()) {
      const dump = o.toObject(['capiId', 'layerId', 'capiImported']) as Record<string, unknown>;
      const capiId = (dump.capiId as string | undefined) ?? '';
      const layerId = (dump.layerId as string | undefined) ?? '';
      objs.push({ ...dump, capiId, layerId, type: o.type } as CanvasObject);
    }
    return objs;
  }

  /**
   * Carrega objetos a partir do array `objects` do ProjectFile.
   * Usado no abrir-projeto. Limpa o canvas antes.
   */
  async loadFromProject(file: ProjectFile): Promise<void> {
    this.fabric.remove(...this.fabric.getObjects());
    if (file.objects.length === 0) {
      this.fabric.requestRenderAll();
      return;
    }
    const enlivened = await fabric.util.enlivenObjects(
      file.objects as unknown as Record<string, unknown>[]
    );
    for (const o of enlivened as fabric.Object[]) {
      // capiId/layerId vêm como propriedades nos data
      this.fabric.add(o);
    }
    this.fabric.requestRenderAll();
  }

  // ── Internas ───────────────────────────────────────────────────────────
  private attachMeta(obj: fabric.Object, layerId: string): void {
    obj.capiId = newObjectId();
    obj.layerId = layerId;
    obj.capiImported = false;
    // Snap em grade de 1mm SOMENTE para objetos novos (não-importados),
    // conforme PROJECT_VISION §0.2.
    obj.strokeUniform = true;
    obj.hasControls = true;
    obj.hasBorders = true;
  }

  private bindEvents(): void {
    this.fabric.on('object:added', () => this.markDirty());
    this.fabric.on('object:modified', (e) => {
      // Snap apenas objetos não-importados ao final do drag/resize.
      const o = e.target as fabric.Object | undefined;
      if (o && !o.capiImported) {
        this.snapToGrid(o);
      }
      this.markDirty();
    });
    this.fabric.on('object:removed', () => this.markDirty());
    this.fabric.on('selection:created', () => this.emitSelection());
    this.fabric.on('selection:updated', () => this.emitSelection());
    this.fabric.on('selection:cleared', () => this.emitSelection());
  }

  private snapToGrid(o: fabric.Object): void {
    if (o.capiImported) return;
    const snapPx = mmToPx(SNAP_MM);
    const nx = Math.round((o.left ?? 0) / snapPx) * snapPx;
    const ny = Math.round((o.top ?? 0) / snapPx) * snapPx;
    if (nx !== o.left || ny !== o.top) {
      o.left = nx;
      o.top = ny;
      o.setCoords();
      this.fabric.requestRenderAll();
    }
  }

  private emitSelection(): void {
    const ids = this.fabric
      .getActiveObjects()
      .map((o) => o.capiId)
      .filter((id): id is string => !!id);
    this.events.onSelection?.(ids);
  }

  private markDirty(): void {
    this.events.onDirty?.();
  }
}
