import React, { useState } from 'react'
import {
  SlidersHorizontal,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  RefreshCw,
  Cpu,
  FileImage,
  FileCode2,
  FileBox,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { Layer, MachineId, ExportFormat } from '@/types'

const MACHINE_LABEL: Record<MachineId, string> = {
  machine1: 'CO2 60W',
  machine2: 'Fibra 20W',
  machine3: 'Diodo 10W',
}

const MACHINE_COLOR: Record<MachineId, string> = {
  machine1: '#6366f1',
  machine2: '#f59e0b',
  machine3: '#22c55e',
}

const ALL_MACHINES: MachineId[] = ['machine1', 'machine2', 'machine3']
const ALL_FORMATS: ExportFormat[] = ['png', 'svg', 'dxf']

const FORMAT_ICON: Record<ExportFormat, React.ElementType> = {
  png: FileImage,
  svg: FileCode2,
  dxf: FileBox,
}

const FORMAT_COLOR: Record<ExportFormat, string> = {
  png: '#3b82f6',
  svg: '#10b981',
  dxf: '#f59e0b',
}

// ─────────────────────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const { selection, project, updateLayer } = useProjectStore()

  const selectedLayer = project.canvas.layers.find(
    (l) => l.id === selection.selectedLayerId
  )

  const selectedElements = selectedLayer
    ? selectedLayer.elements.filter((e) =>
        selection.selectedElementIds.includes(e.id)
      )
    : []

  const singleElement = selectedElements.length === 1 ? selectedElements[0] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#2d2d2d] shrink-0">
        <SlidersHorizontal size={12} className="text-[#666]" />
        <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
          Propriedades
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* No selection */}
        {!selectedLayer && (
          <div className="px-3 py-6 text-center">
            <SlidersHorizontal size={20} className="text-[#333] mx-auto mb-2" />
            <p className="text-xs text-[#444]">Selecione uma camada</p>
            <p className="text-2xs text-[#333] mt-1">para ver suas propriedades</p>
          </div>
        )}

        {/* Element selected: text element */}
        {singleElement?.type === 'text' && (
          <TextElementProps element={singleElement} />
        )}

        {/* Element selected: image/svg */}
        {singleElement && (singleElement.type === 'image' || singleElement.type === 'path') && (
          <ImageElementProps element={singleElement} />
        )}

        {/* Layer selected (no specific element) — show layer production config */}
        {selectedLayer && !singleElement && (
          <LayerProductionProps
            layer={selectedLayer}
            onUpdate={(patch) => updateLayer(selectedLayer.id, patch)}
          />
        )}
      </div>
    </div>
  )
}

// ── Text element properties ───────────────────────────────────────────────────

function TextElementProps({ element }: { element: any }) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Type size={11} className="text-[#8b5cf6]" />
        <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
          Elemento de Texto
        </span>
      </div>

      {/* Text content */}
      <div className="space-y-1">
        <label className="block text-2xs text-[#666]">Conteúdo</label>
        <textarea
          className="w-full bg-[#252525] border border-[#2d2d2d] rounded-md px-2.5 py-1.5 text-xs text-[#e5e5e5] resize-none focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          rows={2}
          defaultValue={element.text ?? ''}
          placeholder="Texto do elemento..."
        />
      </div>

      {/* Font + size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="block text-2xs text-[#666]">Fonte</label>
          <select className="w-full bg-[#252525] border border-[#2d2d2d] rounded-md px-2 py-1.5 text-xs text-[#e5e5e5] focus:outline-none focus:border-[#6366f1]/60">
            <option>Inter</option>
            <option>Arial</option>
            <option>Roboto</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-2xs text-[#666]">Tamanho</label>
          <div className="flex items-center gap-1">
            <input
              className="w-full bg-[#252525] border border-[#2d2d2d] rounded-md px-2 py-1.5 text-xs text-[#e5e5e5] focus:outline-none focus:border-[#6366f1]/60"
              type="number"
              defaultValue={element.fontSize ?? 16}
            />
            <span className="text-2xs text-[#444] shrink-0">pt</span>
          </div>
        </div>
      </div>

      {/* Alignment */}
      <div className="space-y-1">
        <label className="block text-2xs text-[#666]">Alinhamento</label>
        <div className="flex gap-1">
          {[AlignLeft, AlignCenter, AlignRight].map((Icon, i) => (
            <button
              key={i}
              className={`flex-1 flex items-center justify-center py-1.5 rounded-md border transition-colors ${
                i === 0
                  ? 'border-[#6366f1]/40 bg-[#6366f1]/10 text-[#6366f1]'
                  : 'border-[#2d2d2d] text-[#666] hover:text-[#e5e5e5] hover:border-[#444]'
              }`}
            >
              <Icon size={12} />
            </button>
          ))}
        </div>
      </div>

      {/* Position */}
      <PositionFields element={element} />
    </div>
  )
}

// ── Image/SVG element properties ──────────────────────────────────────────────

function ImageElementProps({ element }: { element: any }) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <ImageIcon size={11} className="text-[#f97316]" />
        <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
          Asset / Imagem
        </span>
      </div>

      {/* Replace asset */}
      <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[#2d2d2d] bg-[#252525] hover:border-[#6366f1]/50 text-[#e5e5e5] text-xs transition-colors">
        <RefreshCw size={11} className="text-[#6366f1]" />
        Substituir asset
      </button>

      {/* Position + size */}
      <PositionFields element={element} />
    </div>
  )
}

// ── Position fields (shared) ──────────────────────────────────────────────────

function PositionFields({ element }: { element: any }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <PropInput label="X" value={element?.transform?.x?.toFixed(1) ?? '0'} suffix="px" />
        <PropInput label="Y" value={element?.transform?.y?.toFixed(1) ?? '0'} suffix="px" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PropInput label="Larg." value={element?.transform?.width?.toFixed(1) ?? '0'} suffix="px" />
        <PropInput label="Alt." value={element?.transform?.height?.toFixed(1) ?? '0'} suffix="px" />
      </div>
      <PropInput label="Rot." value={element?.transform?.rotation?.toFixed(1) ?? '0'} suffix="°" />
    </>
  )
}

// ── Layer production settings ─────────────────────────────────────────────────

function LayerProductionProps({
  layer,
  onUpdate,
}: {
  layer: Layer
  onUpdate: (patch: Partial<Layer>) => void
}) {
  const layerColor = layer.color ?? '#6366f1'

  const toggleMachine = (m: MachineId) => {
    const current = layer.machines
    const next = current.includes(m)
      ? current.filter((x) => x !== m)
      : [...current, m]
    onUpdate({ machines: next })
  }

  const toggleFormat = (f: ExportFormat) => {
    const current = layer.exportFormats
    const next = current.includes(f)
      ? current.filter((x) => x !== f)
      : [...current, f]
    onUpdate({ exportFormats: next })
  }

  return (
    <div className="p-3 space-y-4">
      {/* Layer identity */}
      <div className="flex items-center gap-2 pb-2 border-b border-[#2d2d2d]">
        <div
          className="w-6 h-6 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${layerColor}22`, border: `1px solid ${layerColor}44` }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: layerColor }}
          />
        </div>
        <div>
          <div className="text-xs font-semibold text-[#e5e5e5]">{layer.name}</div>
          <div className="text-2xs text-[#666]">
            Tipo: <span style={{ color: layerColor }}>{layer.type}</span>
          </div>
        </div>
      </div>

      {/* Machines */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Cpu size={11} className="text-[#666]" />
          <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
            Máquinas
          </span>
        </div>
        <div className="space-y-1.5">
          {ALL_MACHINES.map((m) => {
            const active = layer.machines.includes(m)
            return (
              <button
                key={m}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border transition-colors text-left ${
                  active
                    ? 'bg-[#252525] border-[#2d2d2d]'
                    : 'border-[#1e1e1e] hover:border-[#2d2d2d] opacity-40 hover:opacity-70'
                }`}
                onClick={() => toggleMachine(m)}
              >
                {/* Toggle dot */}
                <div
                  className="w-3 h-3 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: active ? MACHINE_COLOR[m] : '#444',
                    backgroundColor: active ? MACHINE_COLOR[m] : 'transparent',
                  }}
                >
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#e5e5e5]">{MACHINE_LABEL[m]}</div>
                </div>
                <span
                  className="text-2xs font-mono font-semibold px-1 py-0.5 rounded"
                  style={{
                    backgroundColor: `${MACHINE_COLOR[m]}18`,
                    color: MACHINE_COLOR[m],
                  }}
                >
                  {m === 'machine1' ? 'M1' : m === 'machine2' ? 'M2' : 'M3'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Export formats */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <FileImage size={11} className="text-[#666]" />
          <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
            Exportar como
          </span>
        </div>
        <div className="flex gap-2">
          {ALL_FORMATS.map((fmt) => {
            const active = layer.exportFormats.includes(fmt)
            const Icon = FORMAT_ICON[fmt]
            return (
              <button
                key={fmt}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-md border transition-colors ${
                  active
                    ? 'border-transparent'
                    : 'border-[#2d2d2d] opacity-35 hover:opacity-60'
                }`}
                style={active ? {
                  backgroundColor: `${FORMAT_COLOR[fmt]}15`,
                  borderColor: `${FORMAT_COLOR[fmt]}40`,
                } : {}}
                onClick={() => toggleFormat(fmt)}
              >
                <Icon
                  size={14}
                  style={{ color: active ? FORMAT_COLOR[fmt] : '#666' }}
                />
                <span
                  className="text-2xs font-mono font-bold uppercase"
                  style={{ color: active ? FORMAT_COLOR[fmt] : '#666' }}
                >
                  {fmt}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Canvas dimensions (read only reference) */}
      <div className="space-y-1.5 pt-1 border-t border-[#2d2d2d]">
        <span className="text-2xs font-semibold text-[#444] uppercase tracking-widest">
          Elementos na camada
        </span>
        <div className="text-xs text-[#444] text-center py-2">
          {layer.elements.length === 0
            ? 'Nenhum elemento'
            : `${layer.elements.length} elemento(s)`
          }
        </div>
      </div>
    </div>
  )
}

// ── Shared prop input ─────────────────────────────────────────────────────────

function PropInput({
  label,
  value,
  suffix,
}: {
  label: string
  value: string
  suffix?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-2xs text-[#666]">{label}</label>
      <div className="relative">
        <input
          className="w-full bg-[#252525] border border-[#2d2d2d] rounded-md px-2 py-1.5 text-xs text-[#e5e5e5] focus:outline-none focus:border-[#6366f1]/60 transition-colors"
          defaultValue={value}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-[#444]">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
