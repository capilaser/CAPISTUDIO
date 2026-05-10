import type { RefObject } from 'react';
import * as fabric from 'fabric';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { getCapiId } from '@/core/canvas/capi-id';
import type { SlotType } from '@/core/canvas/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/ui/components/button';

interface SlotCreatorButtonsProps {
  engineRef: RefObject<CanvasEngine | null>;
  disabled?: boolean;
}

const SLOT_BUTTONS: { label: string; type: SlotType }[] = [
  { label: '+ Slot Nome', type: 'nome' },
  { label: '+ Slot Profissão', type: 'profissao' },
  { label: '+ Slot Logo', type: 'logo' },
];

/**
 * Resolve o id do aplique-pai a usar quando criar um slot novo.
 * Regra (Fix #2 — Onda 7b):
 *   - Percorre a seleção atual (objeto único OU ActiveSelection)
 *   - Retorna o capi id do PRIMEIRO objeto cuja LayerMeta tenha kind='principal'
 *   - null se nenhum aplique estiver na seleção
 *
 * Critério unificado, determinístico, sem heurística geométrica.
 */
function resolveParentAppliqueId(engine: CanvasEngine): string | null {
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

export function SlotCreatorButtons({ engineRef, disabled }: SlotCreatorButtonsProps) {
  const { mode } = useCanvasStore();

  if (mode !== 'designer') return null;

  function handleCreate(type: SlotType) {
    const engine = engineRef.current;
    if (!engine) return;
    const parentLayerId = resolveParentAppliqueId(engine);
    engine.createSlot(type, parentLayerId);
  }

  return (
    <>
      <div className="h-4 w-px bg-ink-700" />
      {SLOT_BUTTONS.map(({ label, type }) => (
        <Button
          key={type}
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => handleCreate(type)}
          className="h-7 border-ink-700 font-mono text-[11px] text-ink-300 hover:border-laser hover:text-ink-100"
        >
          {label}
        </Button>
      ))}
    </>
  );
}
