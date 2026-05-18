/**
 * LayerContextMenu — Onda 26 Fase 3.
 *
 * Menu de clique direito pra uma row do painel de camadas, estilo
 * Photoshop. Itens variam por kind:
 *   - principal: Renomear / Soloar / Esconder outras / Excluir
 *   - visual|operation: Renomear / Duplicar / Soloar / Esconder outras /
 *     Mover pro topo / Mover pro fundo / Excluir
 *
 * Atalhos exibidos em ContextMenuShortcut são UI-only (texto). A captura
 * real dos atalhos vive em useLayerKeyboardNav (instalado no LayerPanel).
 */
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Tag, Trash2 } from 'lucide-react';

import type { LayerNode } from '@/core/canvas/canvas-engine';
import type { LayerColorLabel } from '@/data/schema';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/ui/components/context-menu';
import { LayerColorLabelPicker } from './LayerColorLabelPicker';

interface Props {
  node: LayerNode;
  children: ReactNode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onSolo: () => void;
  onHideOthers: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onDelete: () => void;
  /** Onda 26 Fase 5 — define cor de label. */
  onColorLabelChange: (label: LayerColorLabel) => void;
}

export function LayerContextMenu({
  node,
  children,
  canMoveUp,
  canMoveDown,
  onRename,
  onDuplicate,
  onSolo,
  onHideOthers,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
  onColorLabelChange,
}: Props): React.ReactElement {
  const isPrincipal = node.kind === 'principal';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onRename}>
          <Pencil />
          Renomear
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>

        {!isPrincipal && (
          <ContextMenuItem onSelect={onDuplicate}>
            <Copy />
            Duplicar
            <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onSolo}>
          <Eye />
          Soloar (só esta visível)
        </ContextMenuItem>
        <ContextMenuItem onSelect={onHideOthers}>
          <EyeOff />
          Esconder outras
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Cor de label — picker inline (Fase 5). */}
        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-ink-500">
          <Tag className="inline h-3 w-3 align-middle" /> Cor da camada
        </div>
        <LayerColorLabelPicker current={node.colorLabel} onSelect={onColorLabelChange} />

        {!isPrincipal && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onMoveToTop} disabled={!canMoveUp}>
              <ArrowUp />
              Mover pro topo
            </ContextMenuItem>
            <ContextMenuItem onSelect={onMoveToBottom} disabled={!canMoveDown}>
              <ArrowDown />
              Mover pro fundo
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={onDelete}
          className="text-danger focus:bg-danger/15 focus:text-danger"
        >
          <Trash2 />
          Excluir
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
