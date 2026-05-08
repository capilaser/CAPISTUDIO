import type { RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
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

export function SlotCreatorButtons({ engineRef, disabled }: SlotCreatorButtonsProps) {
  const { mode } = useCanvasStore();

  if (mode !== 'designer') return null;

  function handleCreate(type: SlotType) {
    engineRef.current?.createSlot(type);
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
