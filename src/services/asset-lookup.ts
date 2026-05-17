/**
 * asset-lookup.ts — Composer de AssetLookupFn (Onda 13.6).
 *
 * O svg-exporter (Onda 9) recebe um `AssetLookupFn` que resolve um asset id
 * (de aplique, gravação ou marcação) pra info de roteamento (operation +
 * machines). Como existem 3 bancos diferentes, esta função tenta cada um em
 * ordem.
 *
 * Casos especiais (Onda 13.6):
 *   - Sentinel `board-item:<itemId>` → retorna default { corte, fiber-laser }.
 *     A base do produto na prancha é adicionada como aplique com esse id
 *     fake (vide useBoardEngine.addAppliqueSvg). Não existe no banco; sem
 *     este caso especial, o exporter falharia.
 */
import type { AssetExportInfo, AssetLookupFn } from '@/core/export/svg-exporter';
import { getById as getApplique } from '@/data/repositories/appliqueRepository';
import { getById as getEngraving } from '@/data/repositories/engravingRepository';
import { getById as getMarking } from '@/data/repositories/markingRepository';

/** Sentinel: appliqueId de broche base na prancha do editor multi-broche. */
export const BOARD_ITEM_APPLIQUE_PREFIX = 'board-item:';

/** Roteamento default pra base do produto (broche/placa) na prancha. */
const BOARD_ITEM_DEFAULT_ROUTING: AssetExportInfo = {
  operation: 'corte',
  machines: ['fiber-laser'],
};

/**
 * Cria um lookup composto. Tenta resolver o id na ordem:
 *   1. Sentinel board-item:* (Onda 13.6) → default corte/fiber-laser
 *   2. appliques
 *   3. engravings
 *   4. markings
 * Retorna null se não encontrado em nenhum.
 */
export function makeAssetLookup(): AssetLookupFn {
  return async (id: string) => {
    if (id.startsWith(BOARD_ITEM_APPLIQUE_PREFIX)) {
      return BOARD_ITEM_DEFAULT_ROUTING;
    }
    const applique = await getApplique(id);
    if (applique) {
      return { operation: applique.operation, machines: applique.machines };
    }
    const engraving = await getEngraving(id);
    if (engraving) {
      return { operation: engraving.operation, machines: engraving.machines };
    }
    const marking = await getMarking(id);
    if (marking) {
      return { operation: marking.operation, machines: marking.machines };
    }
    return null;
  };
}
