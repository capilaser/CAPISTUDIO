/**
 * ObjectPropertiesPanel — Onda 14c
 *
 * Inputs X/Y/W/H em mm pro objeto atualmente selecionado no canvas
 * (slot OU retângulo decorativo). Commit em blur ou Enter (Esc cancela).
 * tabular-nums obrigatório por design system (CLAUDE.md).
 */
import { useState } from 'react';

import { cn } from '@/lib/cn';

export interface ObjectGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rótulo curto exibido no header (ex: "Slot · Nome", "Borda", "Traço"). */
  label: string;
}

interface Props {
  object: ObjectGeometry;
  /** Bounds em mm do canvas — usado pra validar limites (não pode sair do produto). */
  productBoundsMm: { widthMm: number; heightMm: number };
  onChange: (patch: Partial<Pick<ObjectGeometry, 'x' | 'y' | 'width' | 'height'>>) => void;
}

type Field = 'x' | 'y' | 'width' | 'height';

const LABEL: Record<Field, string> = {
  x: 'X',
  y: 'Y',
  width: 'L',
  height: 'A',
};

export function ObjectPropertiesPanel({ object, productBoundsMm, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {object.label}
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60" title={object.id}>
          {object.id.slice(0, 8)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          field="x"
          value={object.x}
          min={0}
          max={Math.max(0, productBoundsMm.widthMm - object.width)}
          onCommit={(v) => onChange({ x: v })}
        />
        <NumberField
          field="y"
          value={object.y}
          min={0}
          max={Math.max(0, productBoundsMm.heightMm - object.height)}
          onCommit={(v) => onChange({ y: v })}
        />
        <NumberField
          field="width"
          value={object.width}
          min={0.1}
          max={Math.max(0.1, productBoundsMm.widthMm - object.x)}
          onCommit={(v) => onChange({ width: v })}
        />
        <NumberField
          field="height"
          value={object.height}
          min={0.1}
          max={Math.max(0.1, productBoundsMm.heightMm - object.y)}
          onCommit={(v) => onChange({ height: v })}
        />
      </div>
    </div>
  );
}

interface NumberFieldProps {
  field: Field;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

function NumberField({ field, value, min, max, onCommit }: NumberFieldProps) {
  // Local draft separado do prop pra permitir edição livre antes do commit.
  // Re-hidrata quando prop muda (drag externo do objeto) usando "derived state"
  // — comparação na render, sem useEffect (React docs: you might not need an effect).
  const [draft, setDraft] = useState(formatMm(value));
  const [lastSynced, setLastSynced] = useState(value);
  if (value !== lastSynced) {
    setLastSynced(value);
    setDraft(formatMm(value));
  }

  function commit() {
    const parsed = parseFloat(draft.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(formatMm(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    const rounded = Math.round(clamped * 10) / 10;
    if (rounded === value) {
      setDraft(formatMm(value));
      return;
    }
    onCommit(rounded);
  }

  return (
    <label className="flex items-center gap-1.5">
      <span className="w-3 font-mono text-[10px] uppercase text-muted-foreground">
        {LABEL[field]}
      </span>
      <input
        type="number"
        step={0.1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(formatMm(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-7 w-full min-w-0 rounded-md border border-border bg-background/60 px-2',
          'font-mono text-xs tabular-nums text-foreground',
          'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
        )}
      />
      <span className="font-mono text-[9px] text-muted-foreground/70">mm</span>
    </label>
  );
}

function formatMm(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}
