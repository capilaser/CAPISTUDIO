import React from 'react'
import { SlidersHorizontal, Type as TypeIcon, Image as ImageIcon, Layers as LayersIcon } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { CanvasElement, TextElementData, ImageElementData, Layer, MachineId } from '@/types'

export const PropertiesPanel: React.FC = () => {
  const currentProject = useProjectStore((s) => s.currentProject)
  const selection = useProjectStore((s) => s.selection)
  const updateElement = useProjectStore((s) => s.updateElement)
  const updateLayer = useProjectStore((s) => s.updateLayer)

  const doc = currentProject?.document
  if (!doc) return null

  const selectedElement = selection.elementId
    ? doc.elements.find((e) => e.id === selection.elementId)
    : undefined

  const selectedLayer = selection.layerId
    ? doc.layers.find((l) => l.id === selection.layerId)
    : selectedElement
      ? doc.layers.find((l) => l.id === selectedElement.layerId)
      : undefined

  return (
    <div className="flex flex-col border-t border-studio-border">
      <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-studio-muted flex items-center gap-1.5 border-b border-studio-border">
        <SlidersHorizontal size={12} />
        Propriedades
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
        {selectedElement ? (
          <ElementProperties
            element={selectedElement}
            onChange={(changes) => updateElement(selectedElement.id, changes)}
          />
        ) : selectedLayer ? (
          <LayerProperties
            layer={selectedLayer}
            onChange={(changes) => updateLayer(selectedLayer.id, changes)}
          />
        ) : (
          <div className="px-3 py-4 text-2xs text-studio-faint italic">
            Selecione um elemento ou camada.
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Element Properties (context-sensitive)
// ─────────────────────────────────────────────────────────────

const ElementProperties: React.FC<{
  element: CanvasElement
  onChange: (changes: Partial<CanvasElement>) => void
}> = ({ element, onChange }) => {
  if (element.type === 'text') {
    const data = element.data as TextElementData
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-studio-text">
          <TypeIcon size={12} />
          <span className="font-semibold">{element.name ?? 'Texto'}</span>
        </div>

        <div>
          <label className="block text-2xs text-studio-muted mb-1">Conteúdo</label>
          <textarea
            value={data.text}
            onChange={(e) => onChange({ data: { ...data, text: e.target.value } })}
            rows={3}
            className="w-full bg-studio-surface border border-studio-border rounded-studio
                       px-2 py-1.5 text-xs text-studio-text resize-none
                       focus:outline-none focus:border-studio-accent"
          />
        </div>

        <div>
          <label className="block text-2xs text-studio-muted mb-1">
            Tamanho da fonte: {data.fontSize.toFixed(1)} mm
          </label>
          <input
            type="range"
            min={1}
            max={20}
            step={0.1}
            value={data.fontSize}
            onChange={(e) =>
              onChange({ data: { ...data, fontSize: parseFloat(e.target.value) } })
            }
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-2xs text-studio-muted mb-1">Alinhamento</label>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                onClick={() => onChange({ data: { ...data, align: a } })}
                className={`flex-1 text-2xs px-2 py-1 rounded-studio border transition-colors ${
                  data.align === a
                    ? 'bg-studio-accent/20 border-studio-accent text-studio-text'
                    : 'bg-studio-surface border-studio-border text-studio-muted hover:text-studio-text'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (element.type === 'image') {
    const data = element.data as ImageElementData
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-studio-text">
          <ImageIcon size={12} />
          <span className="font-semibold">{element.name ?? 'Imagem'}</span>
        </div>

        {data.src ? (
          <img src={data.src} alt="" className="max-h-20 mx-auto object-contain" />
        ) : (
          <div className="text-2xs text-studio-faint italic text-center">
            Sem imagem. Use o painel da esquerda para enviar um logo.
          </div>
        )}

        <button
          className="w-full text-xs px-3 py-1.5 rounded-studio
                     bg-studio-surface border border-studio-border text-studio-text
                     hover:bg-studio-elevated"
        >
          Substituir imagem
        </button>

        <div className="text-2xs text-studio-muted">
          Posição: {element.x.toFixed(1)} × {element.y.toFixed(1)} mm<br />
          Tamanho: {element.width.toFixed(1)} × {element.height.toFixed(1)} mm
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 text-2xs text-studio-muted">
      Tipo de elemento não suportado.
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Layer Properties (machine config + export toggles)
// ─────────────────────────────────────────────────────────────

const MACHINES: { id: MachineId; label: string }[] = [
  { id: 'machine_1', label: 'M1' },
  { id: 'machine_2', label: 'M2' },
  { id: 'machine_3', label: 'M3' },
]

const LayerProperties: React.FC<{
  layer: Layer
  onChange: (changes: Partial<Layer>) => void
}> = ({ layer, onChange }) => {
  const toggleMachine = (m: MachineId) => {
    const has = layer.machines.includes(m)
    onChange({
      machines: has ? layer.machines.filter((x) => x !== m) : [...layer.machines, m],
    })
  }

  const toggleExport = (k: 'png' | 'svg' | 'dxf') =>
    onChange({ export: { ...layer.export, [k]: !layer.export[k] } })

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-xs text-studio-text">
        <LayersIcon size={12} />
        <span className="font-semibold">{layer.name}</span>
      </div>

      <div>
        <label className="block text-2xs text-studio-muted mb-1">Cor operacional</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={layer.operationalColor}
            onChange={(e) => onChange({ operationalColor: e.target.value })}
            className="w-8 h-8 rounded-studio bg-transparent border border-studio-border cursor-pointer"
          />
          <code className="text-2xs text-studio-muted">{layer.operationalColor}</code>
        </div>
      </div>

      <div>
        <label className="block text-2xs text-studio-muted mb-1">Máquinas</label>
        <div className="flex gap-1">
          {MACHINES.map((m) => {
            const active = layer.machines.includes(m.id)
            return (
              <button
                key={m.id}
                onClick={() => toggleMachine(m.id)}
                className={`flex-1 text-2xs px-2 py-1 rounded-studio border transition-colors ${
                  active
                    ? 'bg-studio-accent/20 border-studio-accent text-studio-text'
                    : 'bg-studio-surface border-studio-border text-studio-muted'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-2xs text-studio-muted mb-1">Exportar</label>
        <div className="flex gap-1">
          {(['png', 'svg', 'dxf'] as const).map((k) => {
            const active = layer.export[k]
            return (
              <button
                key={k}
                onClick={() => toggleExport(k)}
                className={`flex-1 text-2xs px-2 py-1 rounded-studio border transition-colors uppercase ${
                  active
                    ? 'bg-studio-success/20 border-studio-success text-studio-success'
                    : 'bg-studio-surface border-studio-border text-studio-muted'
                }`}
              >
                {k}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
