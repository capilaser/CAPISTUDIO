import React from 'react'
import {
  MousePointer2,
  Move,
  Type,
  Square,
  Circle,
  Minus,
  Pen,
  Image,
  Scissors,
  Flame,
  ChevronLeft,
} from 'lucide-react'
import { ToolButton } from '@/components/toolbar/ToolButton'
import { useProjectStore } from '@/store/useProjectStore'
import type { ToolId } from '@/types'

const TOOLS: {
  id: ToolId
  icon: React.ElementType
  label: string
  shortcut?: string
  dividerAfter?: boolean
}[] = [
  { id: 'select',    icon: MousePointer2, label: 'Selecionar',   shortcut: 'V' },
  { id: 'move',      icon: Move,          label: 'Mover',        shortcut: 'H', dividerAfter: true },
  { id: 'text',      icon: Type,          label: 'Texto',        shortcut: 'T' },
  { id: 'rectangle', icon: Square,        label: 'Retângulo',    shortcut: 'R' },
  { id: 'ellipse',   icon: Circle,        label: 'Elipse',       shortcut: 'E' },
  { id: 'line',      icon: Minus,         label: 'Linha',        shortcut: 'L' },
  { id: 'pen',       icon: Pen,           label: 'Caneta/Path',  shortcut: 'P', dividerAfter: true },
  { id: 'image',     icon: Image,         label: 'Imagem',       shortcut: 'I', dividerAfter: true },
  { id: 'laser-cut',     icon: Scissors, label: 'Corte Laser',    shortcut: undefined },
  { id: 'laser-engrave', icon: Flame,    label: 'Gravação Laser', shortcut: undefined },
]

export function LeftSidebar() {
  const { activeTool, setTool, leftSidebarCollapsed, toggleLeftSidebar } = useProjectStore()

  return (
    <aside
      className={`
        flex flex-col bg-studio-sidebar border-r border-studio-border shrink-0 z-20
        transition-all duration-200 overflow-hidden
        ${leftSidebarCollapsed ? 'w-0' : 'w-sidebar'}
      `}
    >
      {/* Tools */}
      <div className="flex flex-col items-center gap-0.5 py-2 px-1.5 flex-1">
        {TOOLS.map(({ id, icon, label, shortcut, dividerAfter }) => (
          <React.Fragment key={id}>
            <ToolButton
              icon={icon as any}
              label={label}
              shortcut={shortcut}
              active={activeTool === id}
              onClick={() => setTool(id)}
            />
            {dividerAfter && (
              <div className="w-7 h-px bg-studio-border my-1" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Collapse toggle */}
      <button
        className="flex items-center justify-center w-full h-8 border-t border-studio-border text-studio-faint hover:text-studio-muted transition-colors"
        onClick={toggleLeftSidebar}
        title="Recolher painel"
      >
        <ChevronLeft size={14} />
      </button>
    </aside>
  )
}
