/**
 * engine-layers.ts — funções puras de manipulação de camadas (Onda 30.B).
 *
 * Extraído de canvas-engine.ts. Contém CRUD do LayerMeta, locks, opacity,
 * cor de label, blend mode, hierarquia, reorder e duplicação.
 *
 * Convenções:
 * - Toda função recebe `canvas` + `layerMeta` (e helpers extras quando preciso).
 * - O evento `layer-meta-changed` é emitido pelo helper `fireLayerMetaChanged`
 *   (centralizado aqui pra evitar cast `(canvas as { fire })` repetido).
 * - `findByCapiId` é passada como dependência porque resolve dual-path
 *   `obj.id ↔ capiSlot.id` que vive na classe Engine.
 */
import * as fabric from 'fabric';

import type { LayerBlendMode, LayerColorLabel, LayerMeta, VisualLayerMeta } from '@/data/schema';
import { CAPI_CUSTOM_PROPS, generateObjectId } from './engine-serialization';

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
      /** Onda 26 — 0..1. 1 quando o LayerMeta não traz opacity (retrocompat). */
      opacity: number;
      /** Onda 26 Fase 5 — sempre presente; 'none' quando meta.colorLabel undefined. */
      colorLabel: LayerColorLabel;
      /** Onda 26 Fase 5 — sempre presente; 'normal' quando meta.blendMode undefined. */
      blendMode: LayerBlendMode;
      children: LayerNode[];
    }
  | {
      kind: 'visual';
      id: string;
      name: string;
      visible: boolean;
      locked: boolean;
      opacity: number;
      colorLabel: LayerColorLabel;
      blendMode: LayerBlendMode;
      parentId: string | null;
    }
  | {
      kind: 'operation';
      id: string;
      name: string;
      visible: boolean;
      locked: boolean;
      opacity: number;
      colorLabel: LayerColorLabel;
      blendMode: LayerBlendMode;
      parentId: string | null;
      /** Onda 15 — operação do banco (corte, gravacao, marcacao, …). */
      operation: string;
      /** Onda 15 — ids de máquinas (MB/FB/DL). 1–3 elementos. */
      machines: string[];
    };

/**
 * Emit `layer-meta-changed` synthetic event on the canvas. Fabric 6 não
 * tipa eventos customizados; o cast `as { fire }` está centralizado aqui
 * pra evitar duplicação em N callsites.
 */
export function fireLayerMetaChanged(
  canvas: fabric.Canvas,
  layerId: string,
  kind: LayerMeta['kind']
): void {
  (canvas as unknown as { fire: (n: string, o: unknown) => void }).fire('layer-meta-changed', {
    layerId,
    kind,
  });
}

// ─── Read API ─────────────────────────────────────────────────────────────────

/** Returns a copy of the LayerMeta for the given capi id, or null. */
export function getLayerMeta(layerMeta: Map<string, LayerMeta>, id: string): LayerMeta | null {
  const m = layerMeta.get(id);
  return m ? { ...m } : null;
}

/**
 * Onda 15 — encontra o layerId de um aplique principal pelo seu appliqueId
 * (string opaca passada em addAppliqueSvg, tipicamente `board-item:<itemId>`).
 * Usado pelo PatternBar pra parentar slots do pattern ao broche correto.
 */
export function findPrincipalByAppliqueId(
  layerMeta: Map<string, LayerMeta>,
  appliqueId: string
): string | null {
  for (const [id, meta] of layerMeta) {
    if (meta.kind === 'principal' && meta.appliqueId === appliqueId) {
      return id;
    }
  }
  return null;
}

// ─── Visibility ───────────────────────────────────────────────────────────────

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
 * `docs/IDEAS/onda-9-export-respeita-layer-visible.md`.
 *
 * Por que não `excludeFromExport: true`? Esse flag faz o `serialize`
 * pular o objeto do canvasJson, então salvar padrão → reabrir =
 * camada desaparece. Bug grave pego em flight na calibração da Onda 7.
 */
export function setLayerVisibility(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  visible: boolean
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  meta.visible = visible;

  const obj = findByCapiId(id);
  if (obj) {
    obj.set({ visible });
    obj.setCoords();
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

/**
 * Onda 26 Fase 4 — aplica visibilidade em lote. Útil pra multi-seleção
 * do painel. Mais eficiente que loop externo: 1 requestRenderAll no fim.
 * Cada id inválido é silenciosamente ignorado.
 */
export function setMultipleVisibility(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  ids: string[],
  visible: boolean
): void {
  let changed = false;
  for (const id of ids) {
    const meta = layerMeta.get(id);
    if (!meta || meta.visible === visible) continue;
    meta.visible = visible;
    const obj = findByCapiId(id);
    if (obj) {
      obj.set({ visible });
      obj.setCoords();
    }
    changed = true;
    fireLayerMetaChanged(canvas, id, meta.kind);
  }
  if (changed) canvas.requestRenderAll();
}

/**
 * Onda 26 Fase 3 — esconde todas as camadas exceto a passada (Photoshop
 * Alt+click no olho). Útil pra isolar uma peça visualmente. Reversível:
 * chamar com null restaura tudo pra visible=true.
 */
export function soloLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string | null
): void {
  for (const meta of layerMeta.values()) {
    const shouldBeVisible = id === null ? true : meta.id === id;
    if (meta.visible !== shouldBeVisible) {
      setLayerVisibility(canvas, layerMeta, findByCapiId, meta.id, shouldBeVisible);
    }
  }
}

// ─── Lock ─────────────────────────────────────────────────────────────────────

/**
 * Alterna trava da camada.
 *
 * Decisão (Onda 7): camada travada **pode** ser selecionada mas **não
 * pode** ser movida, escalada ou rotacionada.
 *
 * Detalhe técnico: slot-manager seta `lockRotation: true` no body de
 * todo slot por padrão (invariante do sistema — slots nunca rotacionam).
 * No destravar, este método NÃO mexe em `lockRotation` pra slots/visuais
 * — mantém o invariante intacto. Para layers principais (apliques) o
 * `lockRotation` é alternado normalmente.
 */
export function setLayerLocked(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  locked: boolean
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  meta.locked = locked;

  const obj = findByCapiId(id);
  if (obj) {
    const isPrincipal = meta.kind === 'principal';
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      ...(isPrincipal ? { lockRotation: locked } : {}),
      selectable: true,
      evented: true,
    });
    obj.setCoords();
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

/**
 * Onda 26 Fase 4 — aplica lock em lote. Espelha setLayerLocked pra
 * cada id (não otimiza pra preservar contrato com lockRotation por kind).
 */
export function setMultipleLocked(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  ids: string[],
  locked: boolean
): void {
  for (const id of ids) setLayerLocked(canvas, layerMeta, findByCapiId, id, locked);
}

// ─── Opacity / color label / blend mode ───────────────────────────────────────

/**
 * Onda 26 — define opacidade (0..1) de uma camada. Valores fora do
 * intervalo são clampeados. Persiste em LayerMeta.opacity e propaga
 * pro fabric obj.opacity.
 */
export function setLayerOpacity(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  opacity: number
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  const clamped = Math.max(0, Math.min(1, opacity));
  meta.opacity = clamped;

  const obj = findByCapiId(id);
  if (obj) {
    obj.set({ opacity: clamped });
    obj.setCoords();
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

export function setMultipleOpacity(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  ids: string[],
  opacity: number
): void {
  for (const id of ids) setLayerOpacity(canvas, layerMeta, findByCapiId, id, opacity);
}

/**
 * Onda 26 Fase 5 — define cor de label (organização visual no painel).
 * 'none' apaga a marcação. Não afeta canvas nem export.
 */
export function setLayerColorLabel(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  label: LayerColorLabel
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  if (label === 'none') {
    delete meta.colorLabel;
  } else {
    meta.colorLabel = label;
  }
  fireLayerMetaChanged(canvas, id, meta.kind);
}

/**
 * Onda 26 Fase 5 — define blend mode. Aplica via fabric obj.globalCompositeOperation.
 */
export function setLayerBlendMode(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  mode: LayerBlendMode
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  if (mode === 'normal') {
    delete meta.blendMode;
  } else {
    meta.blendMode = mode;
  }

  const obj = findByCapiId(id);
  if (obj) {
    const composite = mode === 'normal' ? 'source-over' : mode;
    (obj as unknown as { globalCompositeOperation: string }).globalCompositeOperation = composite;
    obj.setCoords();
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

// ─── Rename / delete ──────────────────────────────────────────────────────────

/**
 * Renomeia uma camada. No-op se newName for vazio.
 */
export function renameLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  newName: string
): void {
  const trimmed = newName.trim();
  if (!trimmed) return;
  const meta = layerMeta.get(id);
  if (!meta) return;
  meta.name = trimmed;
  fireLayerMetaChanged(canvas, id, meta.kind);
}

/**
 * Deleta uma camada. Para `kind === 'principal'`, deleta também todos
 * os filhos (`parentLayerId === id`) em cascata — invariante de
 * hierarquia do MVP.
 */
export function deleteLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string
): { deletedIds: string[] } {
  const meta = layerMeta.get(id);
  if (!meta) return { deletedIds: [] };

  const deletedIds: string[] = [];

  if (meta.kind === 'principal') {
    for (const [childId, childMeta] of layerMeta.entries()) {
      if (childMeta.parentLayerId === id) {
        const childObj = findByCapiId(childId);
        if (childObj) canvas.remove(childObj);
        layerMeta.delete(childId);
        deletedIds.push(childId);
      }
    }
  }

  const obj = findByCapiId(id);
  if (obj) canvas.remove(obj);
  layerMeta.delete(id);
  deletedIds.push(id);

  canvas.discardActiveObject();
  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
  return { deletedIds };
}

/**
 * Onda 26 Fase 4 — deleta várias camadas. Resolve cascata.
 */
export function deleteMultipleLayers(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  ids: string[]
): { deletedIds: string[] } {
  const all: string[] = [];
  for (const id of ids) {
    if (!layerMeta.has(id)) continue;
    const r = deleteLayer(canvas, layerMeta, findByCapiId, id);
    if (r) all.push(...r.deletedIds);
  }
  return { deletedIds: all };
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

/**
 * Onda 26 Fase 3 — duplica uma camada visual/operation. Não suporta
 * principal nesta fase (clonar aplique é fluxo mais complexo: cloning
 * de SVG, parent ids etc. — deferred).
 */
export async function duplicateLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string
): Promise<string | null> {
  const sourceMeta = layerMeta.get(id);
  if (!sourceMeta) return null;
  if (sourceMeta.kind === 'principal') return null;

  const sourceObj = findByCapiId(id);
  if (!sourceObj) return null;

  const cloned = await sourceObj.clone(CAPI_CUSTOM_PROPS as unknown as string[]);
  const newId = generateObjectId();
  (cloned as unknown as Record<string, unknown>).id = newId;

  cloned.set({
    left: (cloned.left ?? 0) + 10,
    top: (cloned.top ?? 0) + 10,
  });
  cloned.setCoords();

  canvas.add(cloned);

  const newMeta: LayerMeta = {
    ...sourceMeta,
    id: newId,
    zIndex: canvas.getObjects().indexOf(cloned),
    name: `${sourceMeta.name} (cópia)`,
  };
  layerMeta.set(newId, newMeta);

  fireLayerMetaChanged(canvas, newId, newMeta.kind);
  canvas.requestRenderAll();
  return newId;
}

// ─── Z-order / reparent ──────────────────────────────────────────────────────

/**
 * Sobe ou desce a camada na z-order do canvas.
 */
export function moveLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  direction: 'up' | 'down'
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  const obj = findByCapiId(id);
  if (!obj) return;

  if (direction === 'up') {
    canvas.bringObjectForward(obj);
  } else {
    canvas.sendObjectBackwards(obj);
  }

  const newIdx = canvas.getObjects().indexOf(obj);
  if (newIdx >= 0) meta.zIndex = newIdx;

  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

/**
 * Onda 26 (Fase 2) — move camada pra índice arbitrário no z-stack.
 * Usado pelo drag-and-drop do painel.
 */
export function moveLayerToIndex(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  newCanvasIdx: number
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  const obj = findByCapiId(id);
  if (!obj) return;

  const objs = canvas.getObjects();
  const max = objs.length - 1;
  const target = Math.max(0, Math.min(max, newCanvasIdx));

  (
    canvas as unknown as {
      moveObjectTo: (o: fabric.FabricObject, idx: number) => void;
    }
  ).moveObjectTo(obj, target);

  meta.zIndex = target;
  fireLayerMetaChanged(canvas, id, meta.kind);
  canvas.requestRenderAll();
}

/**
 * Muda o `parentLayerId` de uma camada.
 *
 * Restrições mínimas:
 *   - Camadas principais não aceitam pai (parentLayerId sempre null).
 *   - Tentar usar id inexistente como pai é silenciosamente ignorada.
 *   - Permitido reparent para null.
 */
export function reparentLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  newParentId: string | null
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;

  if (meta.kind === 'principal') return;

  if (newParentId !== null) {
    const parentMeta = layerMeta.get(newParentId);
    if (!parentMeta || parentMeta.kind !== 'principal') return;
  }

  meta.parentLayerId = newParentId;
  fireLayerMetaChanged(canvas, id, meta.kind);
}

// ─── Hierarchy (tree pro painel) ─────────────────────────────────────────────

/**
 * Constrói a estrutura hierárquica das camadas pra renderização no
 * painel. Apliques (`kind === 'principal'`) viram nós raiz com seus
 * filhos. Visuais/operações com `parentLayerId === null` viram nós
 * raiz "soltos".
 *
 * Ordenação:
 *  - Principals (broches) em ordem ASCENDENTE de z (broche 1 em cima da lista).
 *  - Children e órfãos em ordem DESCENDENTE (topo do canvas = topo do painel).
 */
export function getLayersHierarchy(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined
): LayerNode[] {
  const canvasObjects = canvas.getObjects();
  const indexOf = (id: string): number => {
    const obj = findByCapiId(id);
    return obj ? canvasObjects.indexOf(obj) : -1;
  };

  type PrincipalNode = Extract<LayerNode, { kind: 'principal' }>;
  type LeafNode = Extract<LayerNode, { kind: 'visual' | 'operation' }>;

  const principals: PrincipalNode[] = [];
  const orphans: LeafNode[] = [];

  for (const meta of layerMeta.values()) {
    if (meta.kind === 'principal') {
      principals.push({
        kind: 'principal',
        id: meta.id,
        name: meta.name,
        visible: meta.visible,
        locked: meta.locked,
        opacity: meta.opacity ?? 1,
        colorLabel: meta.colorLabel ?? 'none',
        blendMode: meta.blendMode ?? 'normal',
        children: [],
      });
    }
  }
  const principalById = new Map<string, PrincipalNode>(principals.map((p) => [p.id, p]));

  for (const meta of layerMeta.values()) {
    if (meta.kind === 'principal') continue;
    const node: LeafNode =
      meta.kind === 'operation'
        ? {
            kind: 'operation',
            id: meta.id,
            name: meta.name,
            visible: meta.visible,
            locked: meta.locked,
            opacity: meta.opacity ?? 1,
            colorLabel: meta.colorLabel ?? 'none',
            blendMode: meta.blendMode ?? 'normal',
            parentId: meta.parentLayerId ?? null,
            operation: meta.operation,
            machines: meta.machines,
          }
        : {
            kind: 'visual',
            id: meta.id,
            name: meta.name,
            visible: meta.visible,
            locked: meta.locked,
            opacity: meta.opacity ?? 1,
            colorLabel: meta.colorLabel ?? 'none',
            blendMode: meta.blendMode ?? 'normal',
            parentId: meta.parentLayerId ?? null,
          };
    const parent = meta.parentLayerId ? principalById.get(meta.parentLayerId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      orphans.push(node);
    }
  }

  const byZ = (a: LayerNode, b: LayerNode): number => indexOf(b.id) - indexOf(a.id);
  // Onda 15 — principals (broches) usam ordem INVERSA: broche 1 em cima,
  // broche N embaixo. Operador associa ordem do painel com a ordem da
  // sidebar esquerda. Children e órfãos mantêm z-order natural (Photoshop).
  const byZAsc = (a: LayerNode, b: LayerNode): number => indexOf(a.id) - indexOf(b.id);
  principals.sort(byZAsc);
  for (const p of principals) p.children.sort(byZ);
  orphans.sort(byZ);

  return [...principals, ...orphans];
}

// ─── Internal: register default meta for new objects ─────────────────────────

/**
 * Registra LayerMeta default para um novo objeto. Chamado por
 * addRectangle/createSlot/addAppliqueSvg/etc na hora de criar objetos.
 *
 * @param parentLayerId  capi id of the parent layer (e.g. aplique) when the
 *                       new layer lives inside another. null = root-level.
 */
export function registerLayerMeta(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  parentLayerId: string | null = null
): void {
  if (layerMeta.has(id)) return; // idempotent
  const meta: VisualLayerMeta = {
    id,
    parentLayerId,
    name: `Camada ${layerMeta.size + 1}`,
    zIndex: canvas.getObjects().length - 1,
    visible: true,
    locked: false,
    kind: 'visual',
    materialId: null,
  };
  layerMeta.set(id, meta);
}
