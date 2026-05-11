/**
 * resolve-parent-applique.ts — helper compartilhado (Onda 7b Fix #2 → Onda 8.5).
 *
 * Originalmente em SlotCreatorButtons.tsx, extraído pra cá quando a Onda 8.5
 * precisou da mesma lógica em EngravingPanel.tsx. Duplicar seria violar a
 * regra do briefing ("crie helper compartilhado em algum util").
 *
 * Regra:
 *   - Percorre a seleção atual do canvas (objeto único OU ActiveSelection)
 *   - Retorna o capi id do PRIMEIRO objeto cuja LayerMeta.kind === 'principal'
 *   - null se nenhum aplique estiver na seleção
 *
 * Critério unificado, determinístico, sem heurística geométrica.
 * Coerente com Fix #1 (getCapiId) — resolve slot.body via capiSlot.id.
 */
import * as fabric from 'fabric';

import { getCapiId } from './capi-id';
import type { CanvasEngine } from './canvas-engine';

export function resolveParentAppliqueId(engine: CanvasEngine): string | null {
  const active = engine.canvas.getActiveObject();
  if (!active) return null;

  const candidates: fabric.FabricObject[] =
    active instanceof fabric.ActiveSelection ? active.getObjects() : [active];

  for (const obj of candidates) {
    const id = getCapiId(obj as unknown as Record<string, unknown>);
    if (!id) continue;
    const meta = engine.getLayerMeta(id);
    if (meta?.kind === 'principal') return id;
  }
  return null;
}
