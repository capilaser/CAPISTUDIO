import React, { useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { LAYER_TYPE_LABELS, LAYER_TYPE_COLORS } from '@/types'
import type { Layer, LayerType } from '@/types'

const LAYER_TYPE_OPTIONS: { value: LayerType; label: string }[] = [
  { value: 'base',     label: 'Base' },
  { value: 'cut',      label: 'Corte' },
  { value: 'engrave',  label: 'Gravação' },
  { value: 'mark',     label: 'Marcação' },
  { value: 'text',     label: 'Texto' },
  { value: 'logo',     label: 'Logo' },
  { value: 'svg',      label: 'SVG' },
  { value: 'image',    label: 'Imagem' },
  { value: 'mockup',   label: 'Mockup' },
  { value: 'reference',label: 'Referência' },
  { value: 'guide',    label: 'Guia' },
]

export function LayersPanel() {
  const {
    project,
    selection,
    selectLayer,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
  } = useProjectStore()

  const [collapsed, setCollapsed] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)

  const layers = [...project.canvas.layers].sort((a, b) => b.order - a.order)

  return (
    <div className="sidebar-section">
      {/* Section header */}
      <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-1.5">
          <Layers size={11} />
          <span>Camadas</span>
          <span className="text-studio-faint ml-1">({layers.length})</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Add layer */}
          <div className="relative">
            <button
              className="hover:text-studio-text p-0.5 rounded hover:bg-studio-elevated transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setShowAddMenu(!showAddMenu)
              }}
              title="Nova camada"
            >
              <Plus size={12} />
            </button>
            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-studio-elevated border border-studio-border rounded-studio shadow-xl z-50 py-1 animate-fade-in">
                  {LAYER_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className="w-full text-left px-3 py-1.5 text-xs text-studio-text hover:bg-studio-surface hover:text-white transition-colors flex items-center gap-2"
                      onClick={() => {
                        addLayer(opt.label, opt.value)
                        setShowAddMenu(false)
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: LAYER_TYPE_COLORS[opt.value] }}
                      />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </div>
      </div>

      {/* Layer list */}
      {!collapsed && (
        <div className="pb-1">
          {layers.length === 0 ? (
            <div className="px-3 py-4 text-center text-studio-faint text-xs">
              Nenhuma camada
            </div>
          ) : (
            layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                isSelected={selection.selectedLayerId === layer.id}
                onSelect={() => selectLayer(layer.id)}
                onToggleVisibility={() => toggleLayerVisibility(layer.id)}
                onToggleLock={() => toggleLayerLock(layer.id)}
                onDelete={() => removeLayer(layer.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Layer Row ─────────────────────────────────────────────────────────────────

function LayerRow({
  layer,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}: {
  layer: Layer
  isSelected: boolean
  onSelect: () => void
  onToggleVisibility: () => void
  onToggleLock: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const typeColor = LAYER_TYPE_COLORS[layer.type]

  return (
    <div
      className={`layer-row mx-1.5 ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      <GripVertical
        size={12}
        className="text-studio-faint shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
      />

      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: typeColor }}
      />

      {/* Name + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`truncate text-xs font-medium ${
              isSelected ? 'text-white' : 'text-studio-text'
            } ${!layer.visible ? 'opacity-40' : ''}`}
          >
            {layer.name}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className="layer-type-badge text-white text-opacity-90"
            style={{ backgroundColor: `${typeColor}33`, color: typeColor }}
          >
            {LAYER_TYPE_LABELS[layer.type]}
          </span>
          {layer.elements.length > 0 && (
            <span className="text-studio-faint text-2xs">
              {layer.elements.length} elem.
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-0.5 ${hovered || isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        <button
          className="p-0.5 rounded hover:bg-studio-surface transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
          title={layer.visible ? 'Ocultar camada' : 'Mostrar camada'}
        >
          {layer.visible
            ? <Eye size={12} className="text-studio-muted" />
            : <EyeOff size={12} className="text-studio-faint" />
          }
        </button>
        <button
          className="p-0.5 rounded hover:bg-studio-surface transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggleLock() }}
          title={layer.locked ? 'Desbloquear' : 'Bloquear'}
        >
          {layer.locked
            ? <Lock size={12} className="text-studio-warning" />
            : <Unlock size={12} className="text-studio-muted" />
          }
        </button>
        <button
          className="p-0.5 rounded hover:bg-studio-danger/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Excluir camada"
        >
          <Trash2 size={12} className="text-studio-faint hover:text-studio-danger" />
        </button>
      </div>
    </div>
  )
}
