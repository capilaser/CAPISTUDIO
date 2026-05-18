/**
 * LayerBlendModeSelect — Onda 26 Fase 5.
 *
 * Dropdown nativo compacto pros 4 blend modes do painel. Aparece embed
 * na row da camada selecionada (linha do slider de opacity).
 *
 * Por que nativo: 4 opções não justifica Radix Select. Native select dá
 * teclado/acessibilidade de graça. Estilo dark customizado via Tailwind.
 */
import type { LayerBlendMode } from '@/data/schema';
import { BLEND_MODES } from './layer-label-config';

interface Props {
  value: LayerBlendMode;
  onChange: (next: LayerBlendMode) => void;
}

export function LayerBlendModeSelect({ value, onChange }: Props): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LayerBlendMode)}
      onClick={(e) => e.stopPropagation()}
      className="
        h-5 rounded border border-transparent bg-transparent
        px-1 font-mono text-[10px] text-ink-300
        hover:border-ink-700 focus:border-laser/40 focus:bg-ink-900 focus:text-ink-100
        focus:outline-none
      "
      aria-label="Modo de mesclagem"
      data-testid="blend-mode-select"
    >
      {BLEND_MODES.map(({ value: v, label }) => (
        <option key={v} value={v} className="bg-ink-900 text-ink-100">
          {label}
        </option>
      ))}
    </select>
  );
}
