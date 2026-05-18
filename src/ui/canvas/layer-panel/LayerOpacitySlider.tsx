/**
 * LayerOpacitySlider — Onda 26.
 *
 * Slider compacto 0..100% pra opacity de camada (Photoshop-like).
 * Usa input[type=range] nativo estilizado — evita dep Radix Slider.
 *
 * Controles:
 *  - Drag/click na trilha → muda opacity em tempo real (commit a cada change).
 *  - Input numérico inline (text com pattern \d+) — Enter/blur commit.
 *  - Step 1, range 0..100.
 *
 * Persistência: cada commit chama engine.setLayerOpacity, que persiste em
 * LayerMeta.opacity (campo opcional) e propaga pro fabric obj.opacity.
 */
import { useState } from 'react';

interface Props {
  /** Valor atual 0..1. */
  value: number;
  onChange: (next: number) => void;
}

export function LayerOpacitySlider({ value, onChange }: Props): React.ReactElement {
  const pct = Math.round(value * 100);
  /**
   * Draft do input numérico. Reseta automaticamente quando o `value`
   * externo muda — feito via "derived state" detectando mudança durante
   * render (padrão React docs: "Adjusting state when a prop changes")
   * em vez de useEffect com setState (anti-pattern: cascading renders).
   */
  const [draftState, setDraftState] = useState<{ draft: string; lastPct: number }>(() => ({
    draft: String(pct),
    lastPct: pct,
  }));
  let draft = draftState.draft;
  if (draftState.lastPct !== pct) {
    draft = String(pct);
    setDraftState({ draft, lastPct: pct });
  }
  const setDraft = (next: string): void => setDraftState({ draft: next, lastPct: pct });

  function commitText(): void {
    const n = Number.parseInt(draft, 10);
    if (Number.isNaN(n)) {
      setDraft(String(pct));
      return;
    }
    const clamped = Math.max(0, Math.min(100, n));
    setDraft(String(clamped));
    onChange(clamped / 100);
  }

  return (
    <div
      className="flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
      data-testid="layer-opacity-slider"
    >
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="
          h-1 w-16 cursor-pointer appearance-none rounded-full
          bg-ink-700
          accent-laser
          focus:outline-none focus:ring-1 focus:ring-laser/40
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ink-500
          [&::-webkit-slider-thumb]:bg-ink-100
          [&::-webkit-slider-thumb]:hover:border-laser
        "
        aria-label="Opacidade"
      />
      <input
        type="text"
        inputMode="numeric"
        pattern="\d*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setDraft(String(pct));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="
          h-5 w-7 rounded border border-transparent bg-transparent
          px-0.5 text-right font-mono text-[10px] tabular-nums text-ink-300
          hover:border-ink-700 focus:border-laser/40 focus:bg-ink-900 focus:text-ink-100
          focus:outline-none
        "
        aria-label="Opacidade em porcentagem"
      />
      <span className="font-mono text-[9px] text-ink-500">%</span>
    </div>
  );
}
