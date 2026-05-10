/**
 * capi-id.ts — extração canônica do "capi id" de um objeto Fabric.
 *
 * Motivação (Onda 7b, Fix #1 — Causa #B):
 *   - Objetos comuns (rect, aplique, etc.) carregam `id` direto no FabricObject
 *     (gravado em addRectangle / addAppliqueSvg / serialize).
 *   - Slots NÃO carregam `id` direto — só `capiSlot: SlotMeta`. O id capi do
 *     slot mora em `capiSlot.id` (slot-manager nunca seta `body.id`).
 *
 * Antes desta abstração, o AlignmentToolbar (e qualquer caller) lia `obj.id`
 * direto e recebia `undefined` para slots, fazendo silently fallback pra
 * canvas em vez de pai imediato.
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
