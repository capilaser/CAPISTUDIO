/**
 * useCanvasShortcuts — atalhos teclado-canvas do editor (Onda 20.C).
 *
 * Tecla        Ação
 * ─────────    ─────────────────────────────────────────────────
 * Delete       Confirma exclusão da camada selecionada (dialog).
 * Backspace    Mesma coisa que Delete (Mac users).
 * Escape       Limpa a seleção atual do canvas.
 * Tab          Foca o próximo slot do broche ativo.
 * Shift+Tab    Foca o slot anterior.
 * ↑↓←→        Move o objeto selecionado em 0.1 mm.
 * Shift+↑↓←→   Move em 1 mm.
 *
 * Os atalhos só agem quando há um objeto ativo (pra setas/Delete) ou
 * quando há slots no broche ativo (pra Tab). Esc sempre funciona, mesmo
 * sem seleção (é um no-op nesse caso).
 *
 * IMPORTANTE: react-hotkeys-hook por default ignora eventos vindos de
 * <input>/<textarea>. Mantenho esse comportamento — quando o operador
 * está digitando texto na sidebar, Tab/Delete/setas seguem comportamento
 * normal do form. Atalhos só pegam quando o foco está no canvas (body).
 */
import { type RefObject } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { getCapiId } from '@/core/canvas/capi-id';
import { cycleSlotIndex, type CycleDirection } from '@/core/canvas/slot-cycle';
import type { LayerPanelHandle } from '@/ui/canvas/LayerPanel';

const FINE_STEP_MM = 0.1;
const COARSE_STEP_MM = 1;
const MM_TO_PX = 4;
const FINE_STEP_PX = FINE_STEP_MM * MM_TO_PX;
const COARSE_STEP_PX = COARSE_STEP_MM * MM_TO_PX;

interface UseCanvasShortcutsProps {
  engineRef: RefObject<CanvasEngine | null>;
  /** Ref pro LayerPanel pra disparar o dialog de delete com cascade. */
  layerPanelRef: RefObject<LayerPanelHandle | null>;
  /** Id do broche ativo (board-item:<itemId>). Null = sem broche. */
  activeBoardItemId: string | null;
  /** Se false, todos os atalhos ficam off (ex: durante saving global). */
  enabled?: boolean;
}

export function useCanvasShortcuts({
  engineRef,
  layerPanelRef,
  activeBoardItemId,
  enabled = true,
}: UseCanvasShortcutsProps): void {
  // Delete / Backspace → confirma exclusão da camada selecionada.
  useHotkeys(
    'delete, backspace',
    (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const active = engine.canvas.getActiveObject();
      if (!active) return;
      const id = getCapiId(active as unknown as Record<string, unknown>);
      if (!id) return;
      e.preventDefault();
      layerPanelRef.current?.requestDeleteByCanvasId(id);
    },
    { enabled }
  );

  // Escape → limpa seleção.
  useHotkeys(
    'escape',
    () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.canvas.discardActiveObject();
      engine.canvas.requestRenderAll();
    },
    { enabled }
  );

  // Tab / Shift+Tab → cicla entre slots do broche ativo.
  useHotkeys(
    'tab, shift+tab',
    (e, handler) => {
      const engine = engineRef.current;
      if (!engine || !activeBoardItemId) return;
      const slots = collectActiveBoardSlots(engine, activeBoardItemId);
      if (slots.length === 0) return;
      e.preventDefault();

      const direction: CycleDirection = handler.shift ? 'backward' : 'forward';
      const active = engine.canvas.getActiveObject();
      const activeId = active ? getCapiId(active as unknown as Record<string, unknown>) : null;
      const currentIdx = activeId ? slots.findIndex((s) => s.id === activeId) : -1;
      const nextIdx = cycleSlotIndex(currentIdx, slots.length, direction);
      const target = slots[nextIdx];
      if (target) engine.selectById(target.id);
    },
    { enabled, preventDefault: true }
  );

  // Setas → move o objeto ativo. Shift = coarse (1mm), sem Shift = fine (0.1mm).
  // react-hotkeys-hook aceita combos múltiplos numa string, então registro
  // todos os 8 combos (4 direções × 2 magnitudes) num useHotkeys só pra evitar
  // 8 chamadas. O handler discrimina pelo `handler.keys`.
  useHotkeys(
    'up, down, left, right, shift+up, shift+down, shift+left, shift+right',
    (e, handler) => {
      const engine = engineRef.current;
      if (!engine) return;
      const active = engine.canvas.getActiveObject();
      if (!active) return;
      e.preventDefault();

      const step = handler.shift ? COARSE_STEP_PX : FINE_STEP_PX;
      // handler.keys é array com a tecla "raw" (ex: ['up']).
      const key = (handler.keys ?? [])[0];
      let dx = 0;
      let dy = 0;
      if (key === 'up') dy = -step;
      else if (key === 'down') dy = step;
      else if (key === 'left') dx = -step;
      else if (key === 'right') dx = step;
      if (dx === 0 && dy === 0) return;

      active.set({
        left: (active.left ?? 0) + dx,
        top: (active.top ?? 0) + dy,
      });
      active.setCoords();
      // Dispara object:modified pra que slot-manager / snap / store
      // reajam como se fosse drag manual.
      engine.canvas.fire('object:modified', { target: active });
      engine.canvas.requestRenderAll();
    },
    { enabled, preventDefault: true }
  );
}

/**
 * Filtra os slots do engine pra incluir só os do broche ativo. Slot pertence
 * a um broche quando a camada principal pai tem `appliqueId === activeBoardItemId`.
 * Ordem: logo → nome → profissao → custom (mesmo critério visual da sidebar).
 */
function collectActiveBoardSlots(
  engine: CanvasEngine,
  activeBoardItemId: string
): { id: string }[] {
  const allLayers = engine.getAllLayerMetas();
  // Acha o principal do broche ativo (appliqueId === activeBoardItemId).
  let principalId: string | null = null;
  for (const [id, meta] of allLayers.entries()) {
    if (meta.kind === 'principal' && meta.appliqueId === activeBoardItemId) {
      principalId = id;
      break;
    }
  }
  if (!principalId) return [];

  const types: Array<'logo' | 'nome' | 'profissao' | 'custom'> = [
    'logo',
    'nome',
    'profissao',
    'custom',
  ];
  const result: { id: string }[] = [];
  for (const type of types) {
    const slots = engine.getSlotsByType(type);
    for (const s of slots) {
      // Slot pertence ao broche ativo se a layerMeta correspondente tem
      // parentLayerId === principalId.
      const slotMeta = allLayers.get(s.id);
      if (slotMeta && 'parentLayerId' in slotMeta && slotMeta.parentLayerId === principalId) {
        result.push({ id: s.id });
      }
    }
  }
  return result;
}
