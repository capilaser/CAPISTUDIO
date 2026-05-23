/**
 * engine-serialization.ts — funções puras de serialização do canvas (Onda 30.A).
 *
 * Extraído de canvas-engine.ts. A engine continua sendo a fachada pública;
 * estas funções recebem `canvas` + `layerMeta` + `slotManager` por parâmetro
 * para serem testáveis sem instanciar a classe inteira.
 *
 * CAPI_CUSTOM_PROPS e `generateObjectId` ficam aqui (uso exclusivo destas
 * funções fora do construtor). `isBaseObject` continua exportado de
 * `canvas-engine.ts` por compatibilidade — re-exportamos sem mudar caller.
 *
 * STRIP-RESTORE (serialize): patterns/clipPaths são removidos antes de
 * `canvas.toObject()` e re-aplicados em seguida. Frágil a ordem. Não retornar
 * cedo entre os dois loops.
 */
import * as fabric from 'fabric';

import type { CanvasItem, LayerMeta, VisualLayerMeta } from '@/data/schema';
import { isOperationLayer } from './layer-meta';
import { bridgePatternAreasToSlots } from './pattern-area-bridge';
import { SlotManager, getCapiSlot, setCapiSlot } from './slot-manager';
import type { SlotMeta } from './types';
import { mmToPx, pxToMm } from './units';

/**
 * Custom Capi properties that must be carried through Fabric serialization.
 * Fabric's toObject only persists these if explicitly listed.
 *
 *  - id        : stable per-object UUID, generated on first serialize
 *  - capiSlot  : SlotMeta (Onda 4+) — type/maxArea/auto* for slot-typed objects
 *
 * Add to this list when introducing new Capi-specific object metadata.
 *
 * NOT listed here (intentional):
 *  - materialId        : lives in capi.layers (LayerMeta), not per-object (ADR 008).
 *  - __capiBase        : base do produto. Sempre tem `excludeFromExport: true`,
 *                        então o OBJETO INTEIRO não vai pro toJSON — flag não
 *                        precisa sobreviver porque o objeto é recriado pelo
 *                        boot (addAppliqueSvg) e não pelo deserialize.
 *  - __capiMaterialRect: rect de textura aplicado em applyMaterialToBase. Mesma
 *                        razão — `excludeFromExport: true`. Pra multi-broche
 *                        (Onda 13+), material vai DIRETO no aplique como fill,
 *                        sem __capiMaterialRect.
 *  - __capiOverlay     : slot overlay tracejado vermelho + board item highlight
 *                        azul. Mesma razão — `excludeFromExport: true`,
 *                        decoração do editor, recriada quando necessário.
 *
 * Investigação Onda 18: o "débito CAPI_CUSTOM_PROPS incompleto" anotado no
 * STATUS-ONDA-17 estava mal-diagnosticado. As flags somem do canvasJson
 * porque o objeto inteiro não é serializado (intencional via excludeFromExport),
 * não porque a lista de custom-props está incompleta. Adicionar essas flags
 * aqui seria no-op: Fabric filtra `_objects.filter(t => !t.excludeFromExport)`
 * ANTES de aplicar CAPI_CUSTOM_PROPS. Débito retirado.
 */
export const CAPI_CUSTOM_PROPS = ['id', 'capiSlot'] as const;

export interface SerializedCanvas {
  version: string;
  objects: Array<Record<string, unknown>>;
  capi: {
    /**
     * Onda 13 (schemaVersion=3): items da prancha. Pelo menos 1 item.
     * Padrão master sempre tem 1 item, offsets zerados.
     */
    items: CanvasItem[];
    units: 'mm';
    /**
     * Schema version for the envelope.
     *   2 = pre-Onda 13 (envelope tinha capi.productId direto, ADR 010 §1)
     *   3 = Onda 13 multi-broche (envelope troca productId por items[])
     */
    schemaVersion: number;
    /** LayerMeta array — one entry per user object. Onda 5+. */
    layers: LayerMeta[];
  };
}

export function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Helper: find a user (non-base) object by its `obj.id`. */
export function findById(
  canvas: fabric.Canvas,
  isBaseObject: (o: fabric.FabricObject) => boolean,
  id: string
): fabric.FabricObject | undefined {
  return canvas
    .getObjects()
    .find((o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === id);
}

// ─── serialize ────────────────────────────────────────────────────────────────

/**
 * Snapshots the canvas + LayerMeta to a JSON-serializable structure.
 *
 * Objects flagged as base (product SVG) are not user data — they're filtered
 * out of the output. Each object gets a stable `id` if it didn't already
 * have one.
 *
 * STRIP-BEFORE-SERIALIZE (symmetric): before `canvas.toObject()` we temporarily
 * remove two transient state values that must NOT be baked into the JSON:
 *   1. `fill` Pattern — references Tauri asset URLs that may become stale.
 *      Replaced with 'transparent'; restored from capi.layers on deserialize.
 *   2. `clipPath` — derived deterministically from `productPaths` at runtime.
 *      Re-applied by `applyMaterialToLayer` → `buildProductClipPath` on deserialize.
 * Both are restored on the live canvas immediately after the snapshot, so
 * `serializeCanvas()` has zero side-effects on the visible canvas state.
 *
 * Onda 13: assinatura mudou de `serialize(productId)` para `serialize(items)`.
 * Caller passa o array completo de items da prancha (cada um com productId +
 * offsetX/offsetY). Padrão (master) sempre passa 1 item com offsets zerados.
 */
export function serializeCanvas(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  isBaseObject: (o: fabric.FabricObject) => boolean,
  items: CanvasItem[]
): SerializedCanvas {
  // Ensure user objects have ids.
  // Fase C: pula `excludeFromExport: true` (snap guides, slot overlays sem id)
  // — eles não vão pro toJSON e não devem receber id parasita aqui.
  canvas.forEachObject((o) => {
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
  canvas.forEachObject((o) => {
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

  const json = canvas.toObject([...CAPI_CUSTOM_PROPS]) as {
    version: string;
    objects: Array<Record<string, unknown>>;
  };

  // RESTORE — symmetric: live canvas state must not be permanently mutated.
  savedFills.forEach((pattern, id) => {
    const obj = findById(canvas, isBaseObject, id);
    obj?.set({ fill: pattern });
  });
  savedClipPaths.forEach((clipPath, id) => {
    const obj = findById(canvas, isBaseObject, id);
    obj?.set({ clipPath });
  });

  // Build layers array, computing current zIndex from canvas order.
  const allObjects = canvas.getObjects();
  const layers: LayerMeta[] = Array.from(layerMeta.values()).map((m) => ({
    ...m,
    zIndex: allObjects.findIndex(
      (o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === m.id
    ),
  }));

  return {
    version: json.version,
    objects: json.objects,
    capi: {
      items,
      units: 'mm',
      schemaVersion: 3,
      layers,
    },
  };
}

// ─── removeItemContents ───────────────────────────────────────────────────────

/**
 * Onda 14 — remove todos os objetos dentro da região de um broche, EXCETO o
 * próprio aplique base (board-item:*). Usado pra "limpar o broche" antes de
 * aplicar um pattern novo (caso contrário o novo pattern empilharia sobre o
 * antigo).
 *
 * Critério de inclusão: o centro do objeto Fabric cai dentro do retângulo
 * (offsetX, offsetY, offsetX + sizeWidth, offsetY + sizeHeight) em mm.
 *
 * @param keepAppliqueId  appliqueId do aplique base do broche que NÃO deve
 *                        ser removido (tipicamente `board-item:<itemId>`).
 * @param offsetMm        canto superior-esquerdo do broche na prancha (mm)
 * @param sizeMm          tamanho do broche (mm)
 * @returns               quantidade de objetos removidos
 */
export function removeItemContents(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  slotManager: SlotManager,
  isBaseObject: (o: fabric.FabricObject) => boolean,
  keepAppliqueId: string,
  offsetMm: { leftMm: number; topMm: number },
  sizeMm: { widthMm: number; heightMm: number }
): number {
  const left = mmToPx(offsetMm.leftMm);
  const top = mmToPx(offsetMm.topMm);
  const right = mmToPx(offsetMm.leftMm + sizeMm.widthMm);
  const bottom = mmToPx(offsetMm.topMm + sizeMm.heightMm);

  const toRemove: fabric.FabricObject[] = [];
  const idsToRemove: string[] = [];

  for (const obj of canvas.getObjects()) {
    if (isBaseObject(obj)) continue;
    const rec = obj as unknown as Record<string, unknown>;
    const objId = typeof rec.id === 'string' ? rec.id : null;

    // Não remove o aplique base do broche. (só checado quando o objeto tem id)
    if (objId) {
      const meta = layerMeta.get(objId);
      if (meta && meta.kind === 'principal' && meta.appliqueId === keepAppliqueId) continue;
    }

    // Centro do objeto em px (left+width/2, top+height/2 já em coords absolutas).
    // Objetos sem id (slot content de texto/logo criado pelo SlotManager) também
    // são removidos — eles ficam órfãos quando o slot pai é apagado.
    const objLeft = Number(obj.left ?? 0);
    const objTop = Number(obj.top ?? 0);
    const objW = Number(obj.width ?? 0) * Number(obj.scaleX ?? 1);
    const objH = Number(obj.height ?? 0) * Number(obj.scaleY ?? 1);
    const cx = objLeft + objW / 2;
    const cy = objTop + objH / 2;

    if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
      toRemove.push(obj);
      if (objId) idsToRemove.push(objId);
    }
  }

  for (const obj of toRemove) canvas.remove(obj);
  for (const id of idsToRemove) layerMeta.delete(id);

  // Slot manager precisa atualizar sua estrutura interna (slots removidos).
  slotManager.loadSlotsFromCanvas();
  canvas.requestRenderAll();
  return toRemove.length;
}

// ─── applyPatternObjects ──────────────────────────────────────────────────────

/**
 * Onda 13.9 — aplica o conteúdo de um Pattern em cima de um broche da prancha.
 *
 * Diferente de `deserialize`, NÃO limpa o canvas. Pega os objetos do pattern
 * (serializado como um canvas single-product) e ADICIONA ao canvas atual,
 * deslocados por `offsetMm` (em mm) — coordenadas locais do pattern viram
 * absolutas na prancha.
 *
 * IDs dos objetos são regenerados pra evitar colisão com layers existentes.
 * LayerMeta correspondente também é registrado.
 *
 * Materiais aplicados aos objetos do pattern são re-aplicados via resolveUrl
 * (mesmo contrato de `deserialize`).
 *
 * @param data       Pattern canvasJson parseado (`{version, objects, capi}`)
 * @param offsetMm   Deslocamento (em mm) aplicado a cada objeto enlivenado.
 *                   Tipicamente o offset do broche ativo na prancha.
 * @param resolveUrl Async resolver materialId → URL (igual ao de deserialize).
 * @param parentLayerId  Onda 15 — quando informado, layers do pattern que
 *                   vinham com parentLayerId=null serão re-parented pra este
 *                   id. Tipicamente o layerId do aplique base do broche
 *                   (board-item:<id>) — agrupa os slots dentro do broche
 *                   no painel de camadas, em vez de deixá-los soltos.
 * @param clampToRegion  Onda 16 — quando informado, **filtra fora** objetos
 *                   cujo centro cai fora deste retângulo (mm) e clampa
 *                   coords dos que entraram. Anti-vazamento em multi-broche:
 *                   garante que slots do pattern nunca apareçam no broche
 *                   vizinho por bug de offset/coordenada.
 * @returns          Array de ids capi dos objetos adicionados.
 */
export async function applyPatternObjects(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  slotManager: SlotManager,
  applyMaterialToLayer: (layerId: string, materialId: string, assetUrl: string) => Promise<void>,
  data: SerializedCanvas,
  offsetMm: { leftMm: number; topMm: number },
  resolveUrl?: (materialId: string) => Promise<string>,
  parentLayerId?: string,
  clampToRegion?: { leftMm: number; topMm: number; widthMm: number; heightMm: number }
): Promise<string[]> {
  if (!data.objects || data.objects.length === 0) return [];

  // Onda 34 — bridge AREA → capiSlot. Patterns criados a partir da Onda 33
  // podem ter layers patternRole='TEXT_AREA'|'LOGO_AREA' que precisam virar
  // slots no destino para a sidebar (TextoItem/LogoSlotItem) operar. Aditiva
  // e idempotente: patterns antigos sem AREA passam intactos.
  //
  // Bridge muta `data.objects` injetando capiSlot. O caller (PatternBar)
  // já trata `data` como entrada de uso único — é o canvasJson lido do
  // banco, não compartilhado entre callers.
  bridgePatternAreasToSlots({ objects: data.objects, capi: data.capi });

  const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(data.objects);
  const offsetLeftPx = mmToPx(offsetMm.leftMm);
  const offsetTopPx = mmToPx(offsetMm.topMm);

  // Onda 15.fix — pré-mapeia layerId → LayerMeta do pattern, ignorando principal
  // (esse é o "broche" do editor de padrões; no destino o broche real já existe).
  // Tudo que NÃO está nesse mapa é considerado "órfão" — vamos criar LayerMeta
  // default visual pra cada um, garantindo que toda peça seja gerenciável no
  // painel de camadas (princípio: nada existe no canvas sem entry em layerMeta).
  const patternLayerById = new Map<string, LayerMeta>();
  // Onda 16.fix — também rastreamos os IDs dos layers principal do pattern
  // que foram pulados. Slots cujo parentLayerId original aponta pra um
  // desses precisam ser RE-PARENTED pro parentLayerId externo (broche-alvo),
  // não pro newId mapeado (que não tem LayerMeta correspondente → órfão).
  const patternPrincipalIds = new Set<string>();
  for (const layer of data.capi?.layers ?? []) {
    if (layer.kind === 'principal') {
      patternPrincipalIds.add(layer.id);
      continue;
    }
    patternLayerById.set(layer.id, layer);
  }

  // Mapa oldId → newId pra restaurar LayerMeta com referência correta.
  const idMap = new Map<string, string>();
  const newIds: string[] = [];

  // Onda 16 — região-alvo em PX absolutas pra clamping.
  // Se clampToRegion informado: objetos com centro fora da região são
  // DESCARTADOS (não adicionados ao canvas). Anti-vazamento em multi-broche.
  const region = clampToRegion
    ? {
        left: mmToPx(clampToRegion.leftMm),
        top: mmToPx(clampToRegion.topMm),
        right: mmToPx(clampToRegion.leftMm + clampToRegion.widthMm),
        bottom: mmToPx(clampToRegion.topMm + clampToRegion.heightMm),
      }
    : null;

  let droppedCount = 0;
  for (let i = 0; i < enlivened.length; i++) {
    const obj = enlivened[i];
    const rec = obj as unknown as Record<string, unknown>;
    const oldId = typeof rec.id === 'string' ? rec.id : null;

    // Onda 16.fix — pula objeto cujo id corresponde a um PRINCIPAL do pattern.
    // Esse "objeto principal" é o aplique base do broche dentro do editor de
    // padrões. No destino (broche da prancha), já existe um aplique base
    // próprio — adicionar mais um seria duplicação visual + órfão no painel.
    if (oldId && patternPrincipalIds.has(oldId)) {
      continue;
    }

    const newId = generateObjectId();
    rec.id = newId;

    // Calcula posição final em px (com offset aplicado).
    const finalLeft = (obj.left ?? 0) + offsetLeftPx;
    const finalTop = (obj.top ?? 0) + offsetTopPx;

    // Onda 16 — Filtro de região: se centro do objeto não cai dentro da
    // região-alvo, **descarta** o objeto (não adiciona ao canvas, não
    // cria LayerMeta, não conta como newId). Evita slots vazarem pro
    // broche vizinho quando o pattern tem objetos extrapolando 60×25.
    if (region) {
      const objW = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const objH = (obj.height ?? 0) * (obj.scaleY ?? 1);
      const cx = finalLeft + objW / 2;
      const cy = finalTop + objH / 2;
      const outOfRegion =
        cx < region.left || cx > region.right || cy < region.top || cy > region.bottom;
      if (outOfRegion) {
        droppedCount++;
        if (import.meta.env.DEV) {
          console.warn(
            `[canvas-engine] applyPatternObjects: objeto descartado (fora da região-alvo)`,
            {
              oldId,
              cx,
              cy,
              region,
            }
          );
        }
        continue;
      }
    }

    if (oldId) idMap.set(oldId, newId);
    newIds.push(newId);

    obj.set({ left: finalLeft, top: finalTop });

    // Onda 16.fix — CRÍTICO: se o objeto carrega capiSlot, atualizar x/y
    // pra refletir a posição absoluta (em mm) após o offset.
    // Sem isso, o overlay tracejado criado depois por loadSlotsFromCanvas
    // usa meta.x/y antigas (coord local do pattern) e fica no broche errado
    // — caso clássico de "slot apareceu no broche 1 mesmo aplicando no 2".
    const slotMeta = getCapiSlot(obj);
    if (slotMeta) {
      const updatedMeta: SlotMeta = {
        ...slotMeta,
        // ⚠️ ID precisa também ser atualizado pra o newId (capiSlot.id é
        // usado por loadSlotsFromCanvas pra mapear body → slot interno).
        id: newId,
        x: pxToMm(finalLeft),
        y: pxToMm(finalTop),
        maxWidth: pxToMm((obj.width ?? 0) * (obj.scaleX ?? 1)),
        maxHeight: pxToMm((obj.height ?? 0) * (obj.scaleY ?? 1)),
      };
      setCapiSlot(obj, updatedMeta);
    }

    canvas.add(obj);
  }
  if (region && droppedCount > 0 && import.meta.env.DEV) {
    console.warn(
      `[canvas-engine] applyPatternObjects: ${droppedCount} objetos descartados por estarem fora da região-alvo`
    );
  }

  // Importa LayerMeta correspondentes (pulando principal — já filtrado acima).
  for (const layer of patternLayerById.values()) {
    const newId = idMap.get(layer.id);
    if (!newId) continue;
    const newLayer: LayerMeta = { ...layer, id: newId };

    // Onda 16.fix — Resolve parentLayerId em ordem de prioridade:
    // 1. Se layer.parentLayerId apontava pra um PRINCIPAL DO PATTERN (que foi
    //    pulado), re-parent pro parentLayerId externo (broche-alvo na prancha).
    //    SEM ISSO: parentLayerId aponta pra um id sem LayerMeta → slot vira
    //    órfão no painel (caso que vc viu: slots fora do agrupamento do broche).
    // 2. Se layer.parentLayerId apontava pra OUTRO LAYER NÃO-PRINCIPAL do
    //    pattern (grupo aninhado), remapeia pro newId mapeado.
    // 3. Se layer.parentLayerId era null (slot solto no pattern), usa
    //    parentLayerId externo se informado.
    // 4. Fallback: limpa pra null.
    if (layer.parentLayerId && patternPrincipalIds.has(layer.parentLayerId)) {
      (newLayer as unknown as { parentLayerId: string | null }).parentLayerId =
        parentLayerId ?? null;
    } else if (layer.parentLayerId && idMap.has(layer.parentLayerId)) {
      (newLayer as unknown as { parentLayerId: string }).parentLayerId = idMap.get(
        layer.parentLayerId
      )!;
    } else if (parentLayerId) {
      (newLayer as unknown as { parentLayerId: string | null }).parentLayerId = parentLayerId;
    } else if (layer.parentLayerId) {
      (newLayer as unknown as { parentLayerId: string | null }).parentLayerId = null;
    }
    layerMeta.set(newId, newLayer);
  }

  // Onda 15.fix — pra cada object adicionado SEM LayerMeta correspondente
  // (órfão: estava no canvasJson mas faltava entry em capi.layers), criamos
  // VisualLayerMeta default. Garante invariante: todo objeto user visível
  // no canvas tem entry em layerMeta → aparece no painel, é gerenciável,
  // não desaparece no próximo serialize.
  for (const newId of newIds) {
    if (layerMeta.has(newId)) continue;
    const orphanMeta: VisualLayerMeta = {
      id: newId,
      parentLayerId: parentLayerId ?? null,
      name: 'Forma',
      zIndex: canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'visual',
      materialId: null,
    };
    layerMeta.set(newId, orphanMeta);
  }

  slotManager.loadSlotsFromCanvas();

  // Re-aplica materiais.
  if (resolveUrl) {
    await Promise.all(
      Array.from(layerMeta.entries())
        .filter(([id]) => newIds.includes(id))
        .filter(
          ([, meta]) => !isOperationLayer(meta) && (meta as VisualLayerMeta).materialId !== null
        )
        .map(async ([id, meta]) => {
          const materialId = (meta as VisualLayerMeta).materialId!;
          try {
            const url = await resolveUrl(materialId);
            await applyMaterialToLayer(id, materialId, url);
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn(
                `[canvas-engine] applyPatternObjects: failed to apply material ${materialId}:`,
                err
              );
            }
          }
        })
    );
  }

  canvas.requestRenderAll();
  return newIds;
}

// ─── deserialize ──────────────────────────────────────────────────────────────

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
export async function deserializeCanvas(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  slotManager: SlotManager,
  clearUserObjects: () => void,
  findByCapiId: (id: string) => fabric.FabricObject | undefined,
  applyMaterialToLayer: (layerId: string, materialId: string, assetUrl: string) => Promise<void>,
  data: SerializedCanvas,
  resolveUrl?: (materialId: string) => Promise<string>
): Promise<void> {
  clearUserObjects();

  // Restore layerMeta from the persisted array.
  for (const layer of data.capi?.layers ?? []) {
    layerMeta.set(layer.id, { ...layer });
  }

  if (!data.objects || data.objects.length === 0) {
    canvas.requestRenderAll();
    return;
  }

  const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(data.objects);
  for (const obj of enlivened) {
    canvas.add(obj);
  }
  slotManager.loadSlotsFromCanvas();

  // Onda 26 — propaga LayerMeta.opacity pro fabric obj. obj.opacity já
  // costuma vir do enlivenObjects (fabric serializa), mas LayerMeta é a
  // fonte autoritativa pra esse campo: garante coerência em padrões
  // salvos antes do campo existir (opacity undefined → mantém atual).
  for (const meta of layerMeta.values()) {
    if (meta.opacity === undefined) continue;
    const obj = findByCapiId(meta.id);
    if (obj) obj.set({ opacity: meta.opacity });
  }

  // Onda 26 Fase 5 — propaga LayerMeta.blendMode pro fabric obj
  // (globalCompositeOperation). colorLabel é só meta visual, não toca o canvas.
  for (const meta of layerMeta.values()) {
    if (meta.blendMode === undefined || meta.blendMode === 'normal') continue;
    const obj = findByCapiId(meta.id);
    if (obj) {
      (obj as unknown as { globalCompositeOperation: string }).globalCompositeOperation =
        meta.blendMode;
    }
  }

  // Onda 26c — re-aplica trava nos apliques-base do Novo Pedido após
  // deserialize. addAppliqueSvg trava no momento da criação, mas snapshot
  // serializado pode ter sido gravado antes desta regra existir (pedidos
  // antigos) ou pelo próprio fluxo serialize→deserialize que preserva os
  // flags. Garantir aqui é idempotente e barato.
  const lockedAppliqueIds = new Set<string>();
  for (const meta of layerMeta.values()) {
    if (meta.kind === 'principal' && meta.appliqueId?.startsWith('board-item:')) {
      lockedAppliqueIds.add(meta.id);
    }
  }
  if (lockedAppliqueIds.size > 0) {
    for (const obj of canvas.getObjects()) {
      const objId = (obj as unknown as Record<string, unknown>).id;
      if (typeof objId === 'string' && lockedAppliqueIds.has(objId)) {
        obj.set({ selectable: false, evented: false, hoverCursor: 'default' });
      }
    }
  }

  // Re-apply material Patterns for all layers that had a materialId.
  // OperationLayerMeta has no materialId field — filter it out before accessing.
  if (resolveUrl) {
    await Promise.all(
      Array.from(layerMeta.entries())
        .filter(
          ([, meta]) => !isOperationLayer(meta) && (meta as VisualLayerMeta).materialId !== null
        )
        .map(async ([id, meta]) => {
          // Safe: filter above guarantees meta is PrincipalLayerMeta | VisualLayerMeta.
          const materialId = (meta as VisualLayerMeta).materialId!;
          try {
            const url = await resolveUrl(materialId);
            await applyMaterialToLayer(id, materialId, url);
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

  canvas.requestRenderAll();
}
