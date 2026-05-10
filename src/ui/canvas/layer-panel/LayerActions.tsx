/**
 * LayerActions.tsx — botões inline de ação (Onda 7).
 *
 * 👁️ visibility, 🔒 lock, ✏️ rename, 🗑️ delete + (quando selecionado)
 * ↑↓ z-order e Mover pra... (slots/visuais).
 */
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, Pencil, Trash2, Unlock } from 'lucide-react';

import { MoveToDropdown } from './MoveToDropdown';

interface Props {
  visible: boolean;
  locked: boolean;
  /** Mostra ↑↓ + Mover pra. True quando a linha está selecionada. */
  selected: boolean;
  /** Slot/visual aceita "Mover pra..."; principal não (invariante hierarquia). */
  canReparent: boolean;
  /** Lista de opções de pai pra dropdown. Ignorado quando canReparent=false. */
  reparentOptions?: Array<{ id: string | null; name: string }>;
  currentParentId?: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onRename: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReparent: (newParentId: string | null) => void;
}

export function LayerActions({
  visible,
  locked,
  selected,
  canReparent,
  reparentOptions,
  currentParentId,
  canMoveUp,
  canMoveDown,
  onToggleVisible,
  onToggleLocked,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
  onReparent,
}: Props): React.ReactElement {
  const btn =
    'flex h-6 w-6 items-center justify-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {/* Z-order ↑↓ — só aparece quando linha está selecionada */}
      {selected && (
        <>
          <button
            type="button"
            className={btn}
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label="Subir camada"
            data-testid="move-up"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            className={btn}
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label="Descer camada"
            data-testid="move-down"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </>
      )}

      {/* Mover pra... — só pra slots/visuais quando selecionado */}
      {selected && canReparent && reparentOptions && (
        <MoveToDropdown
          currentParentId={currentParentId ?? null}
          options={reparentOptions}
          onSelect={onReparent}
        />
      )}

      {/* Visibilidade */}
      <button
        type="button"
        className={btn}
        onClick={onToggleVisible}
        aria-label={visible ? 'Esconder camada' : 'Mostrar camada'}
        data-testid="toggle-visible"
      >
        {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>

      {/* Lock */}
      <button
        type="button"
        className={btn}
        onClick={onToggleLocked}
        aria-label={locked ? 'Destravar camada' : 'Travar camada'}
        data-testid="toggle-locked"
      >
        {locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
      </button>

      {/* Renomear */}
      <button
        type="button"
        className={btn}
        onClick={onRename}
        aria-label="Renomear camada"
        data-testid="rename-layer"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {/* Deletar */}
      <button
        type="button"
        className={btn}
        onClick={onDelete}
        aria-label="Excluir camada"
        data-testid="delete-layer"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
