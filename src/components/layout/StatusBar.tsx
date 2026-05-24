import React from 'react'
import { MousePointer2, ZoomIn, Layers, Monitor } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { LAYER_TYPE_LABELS } from '@/types'

export function StatusBar() {
  const {
    cursor,
    viewport,
    project,
    selection,
    activeTool,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useProjectStore()

  const zoomPercent = Math.round(viewport.zoom * 100)
  const { canvas } = project

  const selectedLayer = canvas.layers.find(
    (l) => l.id === selection.selectedLayerId
  )

  const totalElements = canvas.layers.reduce(
    (sum, l) => sum + l.elements.length,
    0
  )

  const TOOL_LABELS: Record<string, string> = {
    select:        'Selecionar',
    move:          'Mover',
    text:          'Texto',
    rectangle:     'Retângulo',
    ellipse:       'Elipse',
    line:          'Linha',
    pen:           'Caneta',
    image:         'Imagem',
    'laser-cut':   'Corte Laser',
    'laser-engrave': 'Gravação Laser',
  }

  return (
    <footer className="flex items-center h-statusbar bg-studio-sidebar border-t border-studio-border px-3 gap-4 shrink-0 text-2xs text-studio-muted select-none z-30">
      {/* Cursor position */}
      <div className="flex items-center gap-1.5 font-mono">
        <MousePointer2 size={10} />
        <span>
          X: <span className="text-studio-text">{cursor.canvasX.toFixed(0)}</span>
          {' '}
          Y: <span className="text-studio-text">{cursor.canvasY.toFixed(0)}</span>
        </span>
      </div>

      <div className="studio-separator h-3" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <ZoomIn size={10} />
        <button
          className="font-mono text-studio-text hover:text-white transition-colors"
          onClick={zoomReset}
          title="Clique para 100% (0)"
        >
          {zoomPercent}%
        </button>
      </div>

      <div className="studio-separator h-3" />

      {/* Canvas size */}
      <div className="flex items-center gap-1">
        <Monitor size={10} />
        <span className="font-mono">
          {canvas.width} × {canvas.height} {canvas.unit}
        </span>
      </div>

      <div className="studio-separator h-3" />

      {/* Layers count */}
      <div className="flex items-center gap-1">
        <Layers size={10} />
        <span>{canvas.layers.length} camadas · {totalElements} elementos</span>
      </div>

      {/* Selected layer */}
      {selectedLayer && (
        <>
          <div className="studio-separator h-3" />
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedLayer.color ?? '#6366f1' }}
            />
            <span className="text-studio-text">{selectedLayer.name}</span>
            <span className="text-studio-faint">
              ({LAYER_TYPE_LABELS[selectedLayer.type]})
            </span>
          </div>
        </>
      )}

      {/* Selection count */}
      {selection.selectedElementIds.length > 0 && (
        <>
          <div className="studio-separator h-3" />
          <span className="text-studio-accent">
            {selection.selectedElementIds.length} selecionado(s)
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active tool */}
      <div className="flex items-center gap-1.5">
        <span className="text-studio-faint">Ferramenta:</span>
        <span className="text-studio-text font-medium">
          {TOOL_LABELS[activeTool] ?? activeTool}
        </span>
      </div>

      <div className="studio-separator h-3" />

      {/* Keyboard hint */}
      <div className="flex items-center gap-1 text-studio-faint">
        <kbd className="px-1 py-0.5 bg-studio-surface border border-studio-border rounded text-2xs font-mono">
          Ctrl+S
        </kbd>
        <span>salvar</span>
        <span className="mx-1">·</span>
        <kbd className="px-1 py-0.5 bg-studio-surface border border-studio-border rounded text-2xs font-mono">
          F
        </kbd>
        <span>ajustar</span>
        <span className="mx-1">·</span>
        <kbd className="px-1 py-0.5 bg-studio-surface border border-studio-border rounded text-2xs font-mono">
          V
        </kbd>
        <span>selecionar</span>
      </div>
    </footer>
  )
}
