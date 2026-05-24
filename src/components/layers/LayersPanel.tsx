import React from 'react'
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { Layer } from '@/types'
import { LAYER_TYPE_LABELS, LAYER_TYPE_COLORS } from '@/types'

export const LayersPanel: React.FC = () => {
  const currentProject = useProjectStore((s) => s.currentProject)
  const selection = useProjectStore((s) => s.selection)
  const selectLayer = useProjectStore((s) => s.selectLayer)
  const toggleLayerVisibility = useProjectStore((s) => s.toggleLayerVisibility)
  const toggleLayerLock = useProjectStore((s) => s.toggleLayerLock)
  const deleteLayer = useProjectStore((s) => s.deleteLayer)
  const addLayer = useProjectStore((s) => s.addLayer)

  const layers = currentProject?.document.layers ?? []
  // top-of-list = highest order (drawn last/on top)
  const sorted = [...layers].sort((a, b) => b.order - a.order)

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-studio-border">
        <span className="text-2xs font-semibold uppercase tracking-wider text-studio-muted">
          Camadas de produção
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addLayer('engrave')}
            title="Adicionar camada"
            className="p-1 rounded-studio text-studio-muted hover:text-studio-text hover:bg-studio-elevated"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {sorted.length === 0 && (
          <div className="px-3 py-4 text-2xs text-studio-faint italic">
            Nenhuma camada.
          </div>
        )}
        {sorted.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            selected={selection.layerId === layer.id}
            onSelect={() => selectLayer(layer.id)}
            onToggleVisible={() => toggleLayerVisibility(layer.id)}
            onToggleLock={() => toggleLayerLock(layer.id)}
            onDelete={() => deleteLayer(layer.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LayerRow
// ─────────────────────────────────────────────────────────────

const LayerRow: React.FC<{
  layer: Layer
  selected: boolean
  onSelect: () => void
  onToggleVisible: () => void
  onToggleLock: () => void
  onDelete: () => void
}> = ({ layer, selected, onSelect, onToggleVisible, onToggleLock, onDelete }) => {
  const exportFormats: Array<'png' | 'svg' | 'dxf'> = []
  if (layer.export.png) exportFormats.push('png')
  if (layer.export.svg) exportFormats.push('svg')
  if (layer.export.dxf) exportFormats.push('dxf')

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-1.5 px-2 py-1.5 border-b border-studio-border/60 cursor-pointer
                  ${selected ? 'bg-studio-accent/15 ring-1 ring-inset ring-studio-accent/30' : 'hover:bg-studio-elevated'}`}
    >
      {/* color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/40"
        style={{ backgroundColor: layer.operationalColor }}
        title={`Cor operacional: ${layer.operationalColor}`}
      />

      {/* visibility */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleVisible()
        }}
        className="p-0.5 rounded text-studio-muted hover:text-studio-text shrink-0"
      >
        {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>

      {/* lock */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleLock()
        }}
        className="p-0.5 rounded text-studio-muted hover:text-studio-text shrink-0"
      >
        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
      </button>

      {/* name */}
      <span className="flex-1 text-xs text-studio-text truncate">{layer.name}</span>

      {/* type badge */}
      <span
        className="text-2xs font-semibold px-1 py-0.5 rounded text-white shrink-0"
        style={{ backgroundColor: LAYER_TYPE_COLORS[layer.type] }}
      >
        {LAYER_TYPE_LABELS[layer.type]}
      </span>

      {/* machine badges */}
      <div className="flex items-center gap-0.5 shrink-0">
        {layer.machines.map((m) => (
          <span
            key={m}
            className="text-2xs px-1 py-0.5 rounded bg-studio-elevated text-studio-text border border-studio-border"
          >
            M{m.slice(-1)}
          </span>
        ))}
      </div>

      {/* export format mini-badges */}
      <div className="flex items-center gap-0.5 shrink-0">
        {exportFormats.map((f) => (
          <span
            key={f}
            className="text-[9px] font-medium px-1 py-0.5 rounded
                       bg-studio-success/20 text-studio-success uppercase"
          >
            {f}
          </span>
        ))}
      </div>

      {/* delete (hover only) */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="p-0.5 rounded text-studio-muted hover:text-studio-danger opacity-0 group-hover:opacity-100 shrink-0"
        title="Excluir camada"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
