/**
 * LayerRow.tsx — 1 linha do painel de camadas (Onda 7).
 *
 * Renderiza um nó da árvore (`LayerNode`). Recebe callbacks pras ações.
 * O estado de "qual está sendo renomeado" vive no LayerPanel pai —
 * esta linha só sabe se ESTÁ ou NÃO em modo edição.
 */
import { ChevronDown, Layers as LayersIcon, Square } from 'lucide-react';

import type { LayerNode } from '@/core/canvas/canvas-engine';
import { LayerActions } from './LayerActions';
import { RenameInput } from './RenameInput';

interface Props {
  node: LayerNode;
  /** É o nó atualmente selecionado no canvas? */
  selected: boolean;
  /** Está em modo de edição inline do nome? */
  renaming: boolean;
  /** Indentação visual em px (apliques=0, filhos=16). */
  indentPx: number;
  /** Opções pra dropdown "Mover pra..." (só usadas se node.kind !== 'principal'). */
  reparentOptions?: Array<{ id: string | null; name: string }>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (newName: string) => void;
  onCancelRename: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReparent: (newParentId: string | null) => void;
}

export function LayerRow({
  node,
  selected,
  renaming,
  indentPx,
  reparentOptions,
  canMoveUp,
  canMoveDown,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onMoveUp,
  onMoveDown,
  onReparent,
}: Props): React.ReactElement {
  const isPrincipal = node.kind === 'principal';
  const parentId = isPrincipal ? null : node.parentId;

  return (
    <div
      onClick={onSelect}
      className={[
        'group flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 transition-colors',
        selected ? 'bg-ink-700/60' : 'hover:bg-ink-800',
        !node.visible && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: `${6 + indentPx}px` }}
      data-testid={`layer-row-${node.id}`}
    >
      {/* Ícone do tipo */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-500">
        {isPrincipal ? (
          <ChevronDown className="h-3 w-3" />
        ) : node.kind === 'operation' ? (
          <LayersIcon className="h-3 w-3" />
        ) : (
          <Square className="h-2.5 w-2.5" />
        )}
      </span>

      {/* Nome (ou input inline em modo edição) */}
      {renaming ? (
        <RenameInput initialValue={node.name} onSave={onCommitRename} onCancel={onCancelRename} />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-200"
        >
          {node.name}
        </span>
      )}

      {/* Ações inline */}
      {!renaming && (
        <LayerActions
          visible={node.visible}
          locked={node.locked}
          selected={selected}
          canReparent={!isPrincipal}
          reparentOptions={reparentOptions}
          currentParentId={parentId}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onToggleVisible={onToggleVisible}
          onToggleLocked={onToggleLocked}
          onRename={onStartRename}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onReparent={onReparent}
        />
      )}
    </div>
  );
}
