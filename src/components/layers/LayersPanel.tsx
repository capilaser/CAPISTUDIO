import React, { useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Layers,
  Scissors,
  Flame,
  Zap,
  Type,
  ImageIcon,
  LayoutTemplate,
  Monitor,
  Crosshair,
  Square,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import { LAYER_TYPE_LABELS } from '@/types'
import type { Layer, LayerType } from '@/types'

// ── Layer type icon + display color ──────────────────────────────────────────

const LAYER_TYPE_CONFIG: Record<
  LayerType,
  { icon: React.ElementType; displayColor: string; label: string }
> = {
  base:              { icon: Square,        displayColor: '#555555', label: 'Base' },
  cut:               { icon: Scissors,      displayColor: '#e5e5e5', label: 'Corte' },
  engrave:           { icon: Flame,         displayColor: '#ef4444', label: 'Gravação' },
  mark:              { icon: Zap,           displayColor: '#3b82f6', label: 'Marcação' },
  text:              { icon: Type,          displayColor: '#8b5cf6', label: 'Texto' },
  logo:              { icon: ImageIcon,     displayColor: '#f97316', label: 'Logo' },
  svg:               { icon: Crosshair,     displayColor: '#06b6d4', label: 'SVG' },
  image:             { icon: ImageIcon,     displayColor: '#ec4899', label: 'Imagem' },
  mockup:            { icon: Monitor,       displayColor: '#14b8a6', label: 'Mockup' },
  reference:         { icon: Crosshair,     displayColor: '#64748b', label: 'Referência' },
  guide:             { icon: Crosshair,     displayColor: '#22c55e', label: 'Guia' },
  editable:          { icon: Type,          displayColor: '#f59e0b', label: 'Editável' },
  'non-exportable':  { icon: Square,        displayColor: '#6b7280', label: 'Não Export.' },
}

const LAYER_ADD_OPTIONS: { value: LayerType; label: string }[] = [
  { value: 'cut',       label: 'Corte' },
  { value: 'engrave',   label: 'Gravação' },
  { value: 'mark',      label: 'Marcação' },
  { value: 'text',      label: 'Texto' },
  { value: 'logo',      label: 'Logo' },
  { value: 'mockup',    label: 'Mockup' },
  { value: 'reference', label: 'Referência' },
  { value: 'base',      label: 'Base' },
]

// ── Machine badge config ──────────────────────────────────────────────────────

const MACHINE_BADGE_COLOR: Record<string, string> = {
  machine1: '#6366f1',
  machine2: '#f59e0b',
  machine3: '#22c55e',
}

const MACHINE_BADGE_LABEL: Record<string, string> = {
  machine1: 'M1',
  machine2: 'M2',
  machine3: 'M3',
}

// ─────────────────────────────────────────────────────────────────────────────

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

  const [showAddMenu, setShowAddMenu] = useState(false)

  const layers = [...project.canvas.layers].sort((a, b) => b.order - a.order)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2d2d2d] shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-[#666]" />
          <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
            Camadas
          </span>
          <span className="text-2xs text-[#444] ml-1">({layers.length})</span>
        </div>

        {/* Add layer button */}
        <div className="relative">
          <button
            className="flex items-center gap-1 text-2xs text-[#666] hover:text-[#e5e5e5] px-1.5 py-0.5 rounded hover:bg-[#252525] transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu) }}
            title="Nova camada"
          >
            <Plus size={11} />
            <span>Nova</span>
          </button>

          {showAddMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
                <div className="px-2.5 py-1.5 text-2xs text-[#444] uppercase tracking-widest font-semibold border-b border-[#2d2d2d] mb-1">
                  Tipo de camada
                </div>
                {LAYER_ADD_OPTIONS.map((opt) => {
                  const cfg = LAYER_TYPE_CONFIG[opt.value]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={opt.value}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-[#e5e5e5] hover:bg-[#252525] transition-colors flex items-center gap-2"
                      onClick={() => { addLayer(opt.label, opt.value); setShowAddMenu(false) }}
                    >
                      <Icon size={11} style={{ color: cfg.displayColor }} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Layer list */}
      <div className="flex-1 overflow-y-auto py-1">
        {layers.length === 0 ? (
          <div className="px-3 py-6 text-center text-[#444] text-xs">
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

  const cfg = LAYER_TYPE_CONFIG[layer.type] ?? LAYER_TYPE_CONFIG['base']
  const Icon = cfg.icon
  // Use layer's own color if set, else the type display color
  const dotColor = layer.color ?? cfg.displayColor

  return (
    <div
      className={`
        mx-1.5 mb-0.5 rounded-md px-2 py-2 cursor-pointer transition-colors
        ${isSelected
          ? 'bg-[#6366f1]/15 border border-[#6366f1]/30'
          : 'border border-transparent hover:bg-[#252525]'}
        ${!layer.visible ? 'opacity-50' : ''}
      `}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2">
        {/* Type icon + color dot combined */}
        <div
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${dotColor}22`, border: `1px solid ${dotColor}44` }}
        >
          <Icon size={10} style={{ color: dotColor }} />
        </div>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-xs font-medium truncate ${
                isSelected ? 'text-white' : 'text-[#e5e5e5]'
              }`}
            >
              {layer.name}
            </span>
          </div>

          {/* Type label + machine badges */}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span
              className="text-2xs px-1 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${dotColor}18`,
                color: dotColor,
              }}
            >
              {LAYER_TYPE_LABELS[layer.type]}
            </span>
            {layer.machines.map((m) => (
              <span
                key={m}
                className="text-2xs px-1 py-0.5 rounded font-mono font-semibold"
                style={{
                  backgroundColor: `${MACHINE_BADGE_COLOR[m] ?? '#6366f1'}18`,
                  color: MACHINE_BADGE_COLOR[m] ?? '#6366f1',
                }}
              >
                {MACHINE_BADGE_LABEL[m] ?? m}
              </span>
            ))}
          </div>
        </div>

        {/* Actions — always visible, reduce opacity when not hovered */}
        <div
          className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
            hovered || isSelected ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <button
            className="p-0.5 rounded hover:bg-[#333] transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
            title={layer.visible ? 'Ocultar' : 'Mostrar'}
          >
            {layer.visible
              ? <Eye size={11} className="text-[#666]" />
              : <EyeOff size={11} className="text-[#444]" />
            }
          </button>
          <button
            className="p-0.5 rounded hover:bg-[#333] transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggleLock() }}
            title={layer.locked ? 'Desbloquear' : 'Bloquear'}
          >
            {layer.locked
              ? <Lock size={11} className="text-[#f59e0b]" />
              : <Unlock size={11} className="text-[#666]" />
            }
          </button>
          {(hovered || isSelected) && (
            <button
              className="p-0.5 rounded hover:bg-[#ef4444]/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              title="Excluir"
            >
              <Trash2 size={11} className="text-[#444] hover:text-[#ef4444] transition-colors" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
