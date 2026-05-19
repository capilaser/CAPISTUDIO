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

import type {
  LayerBlendMode,
  LayerBoundsMm,
  LayerColorLabel,
  LayerLocks,
  LayerMeta,
  MachineCode,
  PatternRole,
  ProcessType,
  VisualLayerMeta,
} from '@/data/schema';
import { pxToMm } from './units';
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

// ─── Onda 33 — Pattern classification helpers ────────────────────────────────

/**
 * Define o papel da camada na spec de templates inteligentes. No-op se
 * `id` não existe.
 *
 * `role === undefined` remove a classificação (volta a ser "não classificada").
 *
 * Para converter um vetor real em TEXT_AREA / LOGO_AREA (que substitui as
 * curvas por um placeholder de bounds), use `convertToArea` — esta função
 * só anota metadata, sem mexer no Fabric object.
 */
export function setPatternRole(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  role: PatternRole | undefined
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;
  if (role === undefined) {
    delete meta.patternRole;
  } else {
    meta.patternRole = role;
  }
  fireLayerMetaChanged(canvas, id, meta.kind);
}

/**
 * Define processo + máquinas-alvo da camada. Validação leve:
 *  - `machineTargets` é deduplicado e truncado para 3.
 *  - `processType === undefined` E `machineTargets === undefined` zera ambos.
 *
 * Não rejeita array vazio aqui — Onda 33 grava o que veio; validação
 * "≥1 máquina obrigatória" entra na Onda 40 (export).
 */
export function setProcessRouting(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  processType: ProcessType | undefined,
  machineTargets: MachineCode[] | undefined
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;

  if (processType === undefined) {
    delete meta.processType;
  } else {
    meta.processType = processType;
  }

  if (machineTargets === undefined) {
    delete meta.machineTargets;
  } else {
    const unique = Array.from(new Set(machineTargets));
    meta.machineTargets = unique.slice(0, 3);
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
}

/**
 * Define locks granulares (Onda 33). Substitui o boolean `locked` legacy
 * via patch parcial:
 *   - patch = { position: true } → preserva os outros campos atuais
 *   - patch = null              → remove `lockGranular` (cai no `locked` legacy)
 *
 * Não mexe nas flags Fabric (`lockMovementX`, etc.) — Onda 34 unifica esse
 * caminho com o `setLayerLocked` legacy. Nesta onda, `lockGranular` é
 * apenas metadata persistida.
 */
export function setLayerLocks(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  id: string,
  patch: Partial<LayerLocks> | null
): void {
  const meta = layerMeta.get(id);
  if (!meta) return;

  if (patch === null) {
    delete meta.lockGranular;
  } else {
    const current = meta.lockGranular ?? {};
    meta.lockGranular = { ...current, ...patch };
  }

  fireLayerMetaChanged(canvas, id, meta.kind);
}

/**
 * Converte uma camada de vetor real em ÁREA (TEXT_AREA ou LOGO_AREA).
 *
 * Etapas:
 *  1. Lê bounds em mm do objeto Fabric atual (left+width*scaleX, etc).
 *  2. Captura `parentLayerId` do LayerMeta atual (mantido).
 *  3. Remove o Fabric object original.
 *  4. Cria um placeholder `fabric.Rect` semi-transparente com stroke
 *     tracejado roxo (`#a78bfa`, dashArray [4,3]) nas mesmas coords.
 *  5. Define `body.id = id` (preserva o ID original — invariante Onda 31).
 *  6. Substitui o LayerMeta por VisualLayerMeta novo com:
 *       kind: 'visual', patternRole: role, boundsMm: {x,y,width,height},
 *       parentLayerId (preservado), e fitMode: 'contain' p/ LOGO_AREA.
 *
 * Restrições:
 *  - `role` precisa ser TEXT_AREA ou LOGO_AREA. Retorna false caso contrário.
 *  - Não converte camada principal com FILHOS (slot vazaria do aplique).
 *    Caller que cheque com `hasChildren` ou trate o false retornado.
 *  - Não converte se o objeto Fabric não existir (id sem objeto vivo).
 *
 * Retorna true se a conversão foi feita, false em qualquer rejeição.
 *
 * Operação destrutiva: o vetor original some. Caller responsável por
 * confirmação de UX antes de chamar.
 */
export function convertToArea(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  id: string,
  role: 'TEXT_AREA' | 'LOGO_AREA'
): boolean {
  if (role !== 'TEXT_AREA' && role !== 'LOGO_AREA') return false;

  const meta = layerMeta.get(id);
  if (!meta) return false;

  // Principal com filhos: rejeitar (slot vazaria para fora do aplique).
  if (meta.kind === 'principal') {
    const hasChildren = Array.from(layerMeta.values()).some((m) => m.parentLayerId === id);
    if (hasChildren) return false;
  }

  const obj = findByCapiId(id);
  if (!obj) return false;

  // 1. Captura bounds em mm do objeto atual (considerando scale).
  const leftPx = obj.left ?? 0;
  const topPx = obj.top ?? 0;
  const widthPx = (obj.width ?? 0) * (obj.scaleX ?? 1);
  const heightPx = (obj.height ?? 0) * (obj.scaleY ?? 1);
  const boundsMm: LayerBoundsMm = {
    x: pxToMm(leftPx),
    y: pxToMm(topPx),
    width: pxToMm(widthPx),
    height: pxToMm(heightPx),
  };

  // 2. Preserva parentLayerId. Principal sem filhos: vira visual top-level.
  const parentLayerId = meta.kind === 'principal' ? null : (meta.parentLayerId ?? null);
  const name = meta.name; // preserva nome editado pelo operador

  // 3. Remove objeto antigo do canvas.
  canvas.remove(obj);

  // 4. Cria placeholder tracejado roxo (alinhado com style das proximity
  //    lines da engine — operador reconhece como "área inteligente, não
  //    é geometria real").
  const placeholder = new fabric.Rect({
    left: leftPx,
    top: topPx,
    width: widthPx,
    height: heightPx,
    originX: 'left',
    originY: 'top',
    fill: 'rgba(167, 139, 250, 0.06)', // violet-400 a 6%
    stroke: '#a78bfa',
    strokeWidth: 1.5,
    strokeUniform: true,
    strokeDashArray: [4, 3],
    scaleX: 1,
    scaleY: 1,
    cornerColor: '#a78bfa',
    cornerStrokeColor: '#a78bfa',
    borderColor: '#a78bfa',
    transparentCorners: false,
    cornerSize: 8,
    objectCaching: false, // mesmas razões do slot overlay (ver slot-manager)
  });
  // 5. Invariante Onda 31: body.id = layerId. NÃO setamos `capiSlot` —
  //    áreas da Onda 33 NÃO são slots do SlotManager; loadSlotsFromCanvas
  //    ignora rects sem capiSlot.
  (placeholder as unknown as Record<string, unknown>).id = id;
  canvas.add(placeholder);

  // 6. LayerMeta novo. Sempre visual (mesmo se origem foi principal).
  const newMeta: VisualLayerMeta = {
    kind: 'visual',
    id,
    parentLayerId,
    name,
    zIndex: canvas.getObjects().length - 1,
    visible: meta.visible,
    locked: meta.locked,
    opacity: meta.opacity,
    colorLabel: meta.colorLabel,
    blendMode: meta.blendMode,
    materialId: null,
    // Onda 33 — campos novos
    patternRole: role,
    boundsMm,
    processType: meta.processType,
    machineTargets: meta.machineTargets,
    lockGranular: meta.lockGranular,
    ...(role === 'LOGO_AREA' ? { fitMode: 'contain' as const } : {}),
  };
  layerMeta.set(id, newMeta);

  canvas.setActiveObject(placeholder);
  fireLayerMetaChanged(canvas, id, 'visual');
  canvas.requestRenderAll();
  return true;
}

/**
 * Verifica se um layer principal tem filhos diretos. Helper para UI
 * decidir se "Converter em AREA" deve aparecer disabled ou bloqueado.
 *
 * Usa `mmToPx`-free — só itera `layerMeta`. O(n).
 */
export function hasChildren(layerMeta: Map<string, LayerMeta>, id: string): boolean {
  for (const m of layerMeta.values()) {
    if (m.parentLayerId === id) return true;
  }
  return false;
}
