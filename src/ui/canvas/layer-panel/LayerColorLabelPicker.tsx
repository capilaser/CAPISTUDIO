/**
 * LayerColorLabelPicker — Onda 26 Fase 5.
 *
 * Submenu de seleção de cor (usado dentro do LayerContextMenu). 8 opções
 * em grid: 7 cores + "Sem cor". Click aplica e fecha o context menu pai.
 */
import { Check } from 'lucide-react';

import type { LayerColorLabel } from '@/data/schema';
import { COLOR_LABEL_HEX, COLOR_LABEL_NAME, COLOR_LABEL_ORDER } from './layer-label-config';

interface Props {
  current: LayerColorLabel;
  onSelect: (label: LayerColorLabel) => void;
}

export function LayerColorLabelPicker({ current, onSelect }: Props): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5" data-testid="color-label-picker">
      {COLOR_LABEL_ORDER.map((label) => {
        const hex = COLOR_LABEL_HEX[label];
        const isCurrent = current === label;
        const name = COLOR_LABEL_NAME[label];
        return (
          <button
            key={label}
            type="button"
            title={name}
            onClick={() => onSelect(label)}
            className={[
              'flex h-5 w-5 items-center justify-center rounded-sm border transition-all',
              isCurrent ? 'border-laser' : 'border-ink-700 hover:border-ink-500',
              hex === null ? 'bg-transparent' : '',
            ].join(' ')}
            style={hex ? { backgroundColor: hex } : undefined}
            aria-label={name}
          >
            {hex === null ? (
              <span className="text-[8px] text-ink-500">∅</span>
            ) : isCurrent ? (
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
