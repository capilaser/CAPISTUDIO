/**
 * slot-content-promoter.ts — Onda 35.
 *
 * Os conteúdos de slot (fabric.Text dentro de TEXT_AREA, fabric.Group SVG
 * dentro de LOGO_AREA) são criados pelo `slot-manager` com
 * `excludeFromExport: true` desde a Onda 14, SEM `id` capi e SEM LayerMeta.
 * Isso é proposital — eles são "decoração visual do operador", não geometria
 * de produção persistida (não vazam em PNG, serialize, canvas.toJSON).
 *
 * Onda 35: para o export de produção, texto/logo dos slots PRECISAM virar
 * geometria real (texto vetorizado, logo como paths). Mas mudar o contrato
 * runtime do slot-manager quebraria outros caminhos. Solução: PROMOVER
 * TEMPORARIAMENTE durante o export, restaurando no try/finally.
 *
 * Promoção = 3 coisas em conjunto:
 *  1. `excludeFromExport = false`  — pra o exporter "ver" o objeto.
 *  2. `id` capi temporário          — pra `getCapiId` retornar algo.
 *  3. LayerMeta sintética no array de layers — herda processType+machineTargets
 *     da AREA pai (via capiSlot.id no body do slot). Sem isso, o
 *     routing-resolver não acha rota.
 *
 * O caller invoca `withSlotContentExportable` passando o engine e o array
 * de layers original. Recebe um snapshot enriquecido pra usar nos exporters.
 * Restore desfaz tudo (id, layer entry, excludeFromExport).
 */
import type { LayerMeta, VisualLayerMeta } from '@/data/schema';

/**
 * Shape mínimo do que precisamos do objeto Fabric — só flag + id.
 * Evita acoplar este arquivo ao import direto de `fabric`, mantém testável.
 */
export interface ExcludableObject {
  excludeFromExport?: boolean;
  id?: string;
}

/**
 * Body de slot que carrega capiSlot. O promoter usa o id do capiSlot pra
 * achar a LayerMeta da AREA (com patternRole+processType+machineTargets) e
 * herdar o routing para o content.
 */
export interface SlotBody extends ExcludableObject {
  capiSlot?: { id?: string };
}

/**
 * Mapping content → body do slot. O caller é responsável por construir esse
 * mapping (ele tem acesso ao slot-manager interno).
 */
export interface SlotContentEntry {
  /** Objeto Fabric do conteúdo (text/group/etc). */
  content: ExcludableObject;
  /** Body do slot (o "rect transparente" que carrega capiSlot). */
  body: SlotBody;
}

/**
 * Resultado do enrich pra passar adiante aos exporters.
 */
export interface PromotedExportContext {
  /** Array de layers com entries sintéticas pra cada slot content. */
  layers: LayerMeta[];
}

/**
 * Executa `fn` com slot contents promovidos a "exportáveis": destrava
 * `excludeFromExport`, atribui id capi, injeta LayerMeta sintética herdando
 * routing da AREA pai. Restaura tudo no try/finally — propaga exceções.
 *
 * Idempotente: se não há slots com content, `layers` é o original sem cópia
 * extra e fn roda direto.
 *
 * @param entries  array de pares {content, body} — caller monta com base no
 *   slot-manager interno. Slots sem content NÃO devem entrar.
 * @param baseLayers  layers originais do engine (não muta).
 * @param fn  callback que recebe `{layers}` enriquecido.
 */
export async function withSlotContentExportable<T>(
  entries: SlotContentEntry[],
  baseLayers: LayerMeta[],
  fn: (ctx: PromotedExportContext) => Promise<T> | T
): Promise<T> {
  if (entries.length === 0) {
    return await fn({ layers: baseLayers });
  }

  // Snapshot dos valores originais por objeto.
  const originals = new Map<
    ExcludableObject,
    { excludeFromExport: boolean | undefined; id: string | undefined }
  >();
  const syntheticIds: string[] = [];

  for (const { content, body } of entries) {
    originals.set(content, {
      excludeFromExport: content.excludeFromExport,
      id: content.id,
    });
    content.excludeFromExport = false;

    // Reaproveita id se já existir; caso contrário sintetiza a partir do
    // body capiSlot.id (slot id) com sufixo determinístico.
    if (!content.id) {
      const slotId = body.capiSlot?.id;
      content.id = slotId ? `${slotId}__content` : `slot-content-${syntheticIds.length}`;
    }
    syntheticIds.push(content.id);
  }

  // Enriquece o array de layers: para cada slot content, cria uma
  // VisualLayerMeta sintética com parentLayerId = id do body do slot. Essa
  // hierarquia bate com a expectativa do `resolveTextLayerRouting`, que
  // procura processType+machineTargets no PAI. O body do slot é o que tem
  // a LayerMeta da AREA com a metadata Onda 33.
  const enrichedLayers: LayerMeta[] = [...baseLayers];
  for (const { content, body } of entries) {
    const parentId = body.capiSlot?.id;
    if (!parentId) continue; // body sem capiSlot — não há como amarrar routing
    const synthetic: VisualLayerMeta = {
      kind: 'visual',
      id: content.id!,
      parentLayerId: parentId,
      name: 'slot-content',
      zIndex: enrichedLayers.length,
      visible: true,
      locked: false,
      materialId: null,
    };
    enrichedLayers.push(synthetic);
  }

  try {
    return await fn({ layers: enrichedLayers });
  } finally {
    // Restaura TUDO — propaga exception após restore.
    for (const [obj, snap] of originals) {
      if (snap.excludeFromExport === undefined) {
        delete (obj as { excludeFromExport?: boolean }).excludeFromExport;
      } else {
        obj.excludeFromExport = snap.excludeFromExport;
      }
      if (snap.id === undefined) {
        delete (obj as { id?: string }).id;
      } else {
        obj.id = snap.id;
      }
    }
  }
}
