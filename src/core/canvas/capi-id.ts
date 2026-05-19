/**
 * capi-id.ts — extração canônica do "capi id" de um objeto Fabric.
 *
 * Motivação histórica (Onda 7b, Fix #1 — Causa #B):
 *   - Objetos comuns (rect, aplique, etc.) carregam `id` direto no FabricObject.
 *   - Slots, ANTES da Onda 31, NÃO carregavam `id` direto — só `capiSlot: SlotMeta`.
 *     O id capi do slot morava SÓ em `capiSlot.id`.
 *
 * Onda 31 — eliminou o dual-path:
 *   - `slot-manager.createSlot` agora seta `body.id = meta.id` na criação.
 *   - `slot-manager.loadSlotsFromCanvas` normaliza `body.id` para `capiSlot.id`
 *     ao carregar slots legados (de canvasJson antigo).
 *   - Em `applyPatternObjects`, IDs novos já são sincronizados em ambos.
 *
 * Esta função continua sendo o caminho canônico: ela tenta `obj.id` primeiro
 * (caminho rápido, válido pra TODOS os objetos pós-Onda 31), e cai pra
 * `capiSlot.id` como fallback (compatibilidade com canvasJson serializado
 * em ondas anteriores que ainda não passou por `loadSlotsFromCanvas`).
 *
 * Função pura, sem dependência de Fabric — recebe um shape mínimo que ambos
 * fabric.FabricObject e plain objects de teste satisfazem.
 */

/**
 * Shape mínimo aceito por getCapiId. Compatível com fabric.FabricObject
 * (que também é indexable como Record<string, unknown>) e com objetos de
 * teste plain JS.
 */
export type CapiIdSource = Record<string, unknown>;

/**
 * Resolve o id capi canônico de um objeto Fabric.
 *
 * Ordem de busca:
 *   1. obj.id (string) — caminho normal
 *   2. obj.capiSlot.id (string) — caminho slot
 *
 * Retorna undefined se nenhum dos dois existe (ex: slot overlay,
 * placeholder, base SVG).
 */
export function getCapiId(obj: CapiIdSource): string | undefined {
  if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id;

  const slotMeta = obj.capiSlot as { id?: unknown } | undefined;
  if (slotMeta && typeof slotMeta.id === 'string' && slotMeta.id.length > 0) {
    return slotMeta.id;
  }

  return undefined;
}
