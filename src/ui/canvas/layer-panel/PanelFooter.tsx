/**
 * PanelFooter — Onda 26.
 *
 * Barra inferior fixa do painel de camadas com ações globais estilo Photoshop:
 *   [Duplicar] [Lixeira]
 *
 * Fase 3: Duplicar (apenas leaves — apliques principais não duplicam
 * nesta fase) + Excluir.
 *
 * Ações ficam desabilitadas quando não há seleção (selectedId === null).
 */
import { Copy, Trash2 } from 'lucide-react';

interface Props {
  /** Se há ao menos uma camada selecionada. */
  hasSelection: boolean;
  /** Implementação real chega na Fase 3 (multi-seleção + duplicateLayer). */
  onDuplicate?: () => void;
  onDelete?: () => void;
}

export function PanelFooter({ hasSelection, onDuplicate, onDelete }: Props): React.ReactElement {
  const btn =
    'flex h-7 w-7 items-center justify-center rounded text-ink-400 transition-colors ' +
    'hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed ' +
    'disabled:hover:bg-transparent';

  return (
    <footer className="flex items-center justify-end gap-1 border-t border-ink-800 bg-ink-900 px-2 py-1.5">
      <button
        type="button"
        className={btn}
        onClick={onDuplicate}
        disabled={!hasSelection || !onDuplicate}
        aria-label="Duplicar camada"
        title="Duplicar (Ctrl+D)"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={btn}
        onClick={onDelete}
        disabled={!hasSelection || !onDelete}
        aria-label="Excluir camada"
        title="Excluir (Del)"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </footer>
  );
}
