/**
 * PanelSearchBar — Onda 26 Fase 5.
 *
 * Busca incremental por nome da camada (Photoshop "Find layer"). Fica
 * abaixo do PanelHeader. Esc limpa, Enter blur.
 *
 * Lógica de filtragem vive no LayerPanel: aqui só apresenta o input.
 */
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function PanelSearchBar({ value, onChange }: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 border-b border-ink-800 bg-ink-900 px-2 py-1.5">
      <Search className="h-3 w-3 shrink-0 text-ink-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Buscar camada…"
        className="
          h-5 min-w-0 flex-1 bg-transparent
          text-[11px] text-ink-200 placeholder:text-ink-600
          focus:outline-none
        "
        data-testid="panel-search-input"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-ink-500 hover:bg-ink-800 hover:text-ink-200"
          aria-label="Limpar busca"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}
