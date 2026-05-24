import React from 'react'
import { Layers as LayersIcon, MousePointer2, Monitor } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

export const StatusBar: React.FC = () => {
  const project = useProjectStore((s) => s.currentProject)
  const selection = useProjectStore((s) => s.selection)
  const activeTool = useProjectStore((s) => s.activeTool)

  const layerCount = project?.document.layers.length ?? 0
  const elementCount = project?.document.elements.length ?? 0

  const selectedElement = selection.elementId
    ? project?.document.elements.find((e) => e.id === selection.elementId)
    : undefined

  return (
    <footer className="flex items-center justify-between h-6 px-3 bg-studio-sidebar border-t border-studio-border text-2xs text-studio-muted shrink-0">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <MousePointer2 size={10} /> {activeTool}
        </span>
        <span className="flex items-center gap-1">
          <LayersIcon size={10} /> {layerCount} camadas · {elementCount} elementos
        </span>
        {selectedElement && (
          <span>
            Selecionado: <span className="text-studio-text">{selectedElement.name ?? selectedElement.id}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Monitor size={10} />
        <span>{project?.document.widthMm} × {project?.document.heightMm} mm</span>
      </div>
    </footer>
  )
}
