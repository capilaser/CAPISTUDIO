/**
 * LayerRow.tsx — 1 linha do painel de camadas.
 *
 * Onda 7: layout original com ícone + nome + ações inline.
 * Onda 26 (pro): grid `[chevron][thumb][nome+badges+slider+blend][actions]`,
 * altura 40px, faixa de cor à esquerda quando há colorLabel.
 * Onda 26 Fase 5: faixa de cor, blend mode select inline, chevron toggle
 * collapsible nos principais.
 *
 * Estado de "renomeando", seleção e collapsed continuam no LayerPanel pai —
 * esta linha só recebe via props.
 */
import { ChevronDown, ChevronRight, Layers as LayersIcon } from 'lucide-react';
import { type RefObject } from 'react';

import type { CanvasEngine, LayerNode } from '@/core/canvas/canvas-engine';
import { ChildCountBadge, OperationBadge } from './LayerBadge';
import { LayerActions } from './LayerActions';
import { LayerBlendModeSelect } from './LayerBlendModeSelect';
import { LayerOpacitySlider } from './LayerOpacitySlider';
import { LayerThumbnail } from './LayerThumbnail';
import { RenameInput } from './RenameInput';
import { COLOR_LABEL_HEX } from './layer-label-config';
import type { LayerBlendMode } from '@/data/schema';

interface Props {
  node: LayerNode;
  selected: boolean;
  renaming: boolean;
  indentPx: number;
  reparentOptions?: Array<{ id: string | null; name: string }>;
  canMoveUp: boolean;
  canMoveDown: boolean;
  engineRef: RefObject<CanvasEngine | null>;
  thumbRevision: number;
  /** Onda 26 Fase 5 — só relevante pra principais. Ignorado em leaves. */
  collapsed?: boolean;
  /** Onda 26 Fase 5 — só relevante pra principais. */
  onToggleCollapsed?: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onCommitRename: (newName: string) => void;
  onCancelRename: () => void;
  onToggleVisible: () => void;
  onToggleLocked: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReparent: (newParentId: string | null) => void;
  onOpacityChange: (next: number) => void;
  onBlendModeChange: (next: LayerBlendMode) => void;
}

export function LayerRow({
  node,
  selected,
  renaming,
  indentPx,
  reparentOptions,
  canMoveUp,
  canMoveDown,
  engineRef,
  thumbRevision,
  collapsed,
  onToggleCollapsed,
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
  onOpacityChange,
  onBlendModeChange,
}: Props): React.ReactElement {
  const isPrincipal = node.kind === 'principal';
  const parentId = isPrincipal ? null : node.parentId;
  const labelHex = COLOR_LABEL_HEX[node.colorLabel];

  return (
    <div
      onClick={(e) => onSelect(e)}
      className={[
        'group relative flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition-colors',
        selected ? 'bg-ink-700/60 ring-1 ring-laser/30' : 'hover:bg-ink-800',
        !node.visible && 'opacity-50',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: `${6 + indentPx}px`, minHeight: 40 }}
      data-testid={`layer-row-${node.id}`}
    >
      {/* Faixa de cor (Fase 5). Strip vertical 3px à esquerda quando há label. */}
      {labelHex && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
          style={{ backgroundColor: labelHex }}
        />
      )}

      {/* Disclosure: principal vira toggle clicável (collapse). Leaves
          mantêm chevron de ornamento. */}
      {isPrincipal ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed?.();
          }}
          aria-label={collapsed ? 'Expandir grupo' : 'Colapsar grupo'}
          className="flex h-4 w-3 shrink-0 items-center justify-center rounded text-ink-500 hover:text-ink-200"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      ) : (
        <span className="flex h-4 w-3 shrink-0 items-center justify-center text-ink-700">
          <ChevronRight className="h-2.5 w-2.5 opacity-50" />
        </span>
      )}

      {/* Thumbnail 32x32. Apliques principais usam ícone Layers
          pra economizar render quando só agrupa filhos. */}
      {isPrincipal ? (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-ink-700 bg-ink-900"
          aria-hidden="true"
        >
          <LayersIcon className="h-3.5 w-3.5 text-ink-500" />
        </div>
      ) : (
        <LayerThumbnail engineRef={engineRef} layerId={node.id} revision={thumbRevision} />
      )}

      {/* Nome + badges (col flex). Em rename, o input ocupa o slot. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {renaming ? (
          <RenameInput initialValue={node.name} onSave={onCommitRename} onCancel={onCancelRename} />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            className="min-w-0 truncate text-[11px] text-ink-200"
            title={node.name}
          >
            {node.name}
          </span>
        )}
        {!renaming && (
          <div className="flex items-center gap-1">
            {node.kind === 'operation' && (
              <OperationBadge operation={node.operation} machines={node.machines} />
            )}
            {node.kind === 'principal' && (
              <ChildCountBadge
                operations={node.children.filter((c) => c.kind === 'operation').length}
              />
            )}
            {selected && (
              <>
                <LayerOpacitySlider value={node.opacity} onChange={onOpacityChange} />
                <LayerBlendModeSelect value={node.blendMode} onChange={onBlendModeChange} />
              </>
            )}
          </div>
        )}
      </div>

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
