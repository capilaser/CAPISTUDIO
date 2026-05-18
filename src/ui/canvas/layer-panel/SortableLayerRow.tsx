/**
 * SortableLayerRow — Onda 26 Fase 2.
 *
 * Wrapper sortable do LayerRow usando @dnd-kit. Envelopa a row num
 * container draggable com handle dedicado (grip à esquerda do thumb).
 * Por que handle dedicado: a row tem MUITOS click handlers (select,
 * actions, slider) — drag direto interferiria. Handle só pega o grip.
 *
 * O drop alvo é gerenciado pelo SortableContext no LayerPanel, que
 * decide reorder/reparent no onDragEnd.
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { type ComponentProps, type RefObject } from 'react';

import type { CanvasEngine, LayerNode } from '@/core/canvas/canvas-engine';
import { LayerRow } from './LayerRow';

type LayerRowProps = ComponentProps<typeof LayerRow>;

interface Props {
  node: LayerNode;
  rowProps: Omit<LayerRowProps, 'node' | 'engineRef' | 'thumbRevision'>;
  engineRef: RefObject<CanvasEngine | null>;
  thumbRevision: number;
}

export function SortableLayerRow({
  node,
  rowProps,
  engineRef,
  thumbRevision,
}: Props): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    over,
    active,
  } = useSortable({ id: node.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: 'relative',
  };

  // Onda 26 Fase 4 — drop indicator:
  //   - se este nó é principal e o item draggado está OVER ele → ring laser
  //     indica "drop ON" (vai reparentar).
  //   - se é leaf, ring é mais sutil (só reordena).
  const isDropTarget = isOver && over?.id === node.id && active?.id !== node.id;
  const isReparentTarget =
    isDropTarget && node.kind === 'principal' && String(active?.id) !== node.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`sortable-${node.id}`}
      className={
        isReparentTarget
          ? 'rounded ring-2 ring-laser/70'
          : isDropTarget
            ? 'rounded ring-1 ring-laser/30'
            : undefined
      }
    >
      <div className="flex items-stretch">
        {/* Handle de drag — só este elemento responde a drag. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex w-4 shrink-0 cursor-grab items-center justify-center text-ink-700 hover:text-ink-400 active:cursor-grabbing"
          aria-label="Arrastar pra reordenar"
          // Stop propagation pra não disparar onSelect da row.
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <div className="min-w-0 flex-1">
          <LayerRow node={node} engineRef={engineRef} thumbRevision={thumbRevision} {...rowProps} />
        </div>
      </div>
    </div>
  );
}
