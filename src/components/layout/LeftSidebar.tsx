import React, { useRef } from 'react'
import { FileText, Pencil, Package, Image as ImageIcon, ChevronDown } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { EditableSlot } from '@/types'

const NAME_PRESETS = ['Dr.', 'Dra.', 'Enf.', 'Prof.', 'Sr.', 'Sra.']
const CARGO_PRESETS = ['Médico(a)', 'Enfermeiro(a)', 'Advogado(a)', 'Arquiteto(a)', 'Dentista', 'Designer']

export const LeftSidebar: React.FC = () => {
  const templates = useProjectStore((s) => s.templates)
  const selectedTemplateId = useProjectStore((s) => s.selectedTemplateId)
  const createProjectFromTemplate = useProjectStore((s) => s.createProjectFromTemplate)
  const getSlotsForCurrent = useProjectStore((s) => s.getSlotsForCurrent)
  const fillSlot = useProjectStore((s) => s.fillSlot)
  const getSlotValue = useProjectStore((s) => s.getSlotValue)
  // subscribe to currentProject so this panel re-renders when fills change
  const currentProject = useProjectStore((s) => s.currentProject)

  const slots = getSlotsForCurrent()

  return (
    <aside
      className="flex flex-col bg-studio-sidebar border-r border-studio-border overflow-y-auto"
      style={{ width: 280, minWidth: 280 }}
    >
      {/* ─── TEMPLATE SECTION ─────────────────────────── */}
      <section className="border-b border-studio-border">
        <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-studio-muted flex items-center gap-1.5">
          <FileText size={12} />
          Template
        </div>
        <div className="px-3 pb-3">
          <div className="relative">
            <select
              value={selectedTemplateId ?? ''}
              onChange={(e) => createProjectFromTemplate(e.target.value)}
              className="w-full appearance-none bg-studio-surface border border-studio-border rounded-studio
                         px-2.5 py-2 pr-8 text-xs text-studio-text
                         focus:outline-none focus:border-studio-accent focus:ring-1 focus:ring-studio-accent/30"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-studio-muted pointer-events-none"
            />
          </div>
          {currentProject?.templateId && (
            <div className="mt-2 text-2xs text-studio-muted">
              {templates.find((t) => t.id === currentProject.templateId)?.realWidthMm}
              {' × '}
              {templates.find((t) => t.id === currentProject.templateId)?.realHeightMm}
              {' mm'}
            </div>
          )}
        </div>
      </section>

      {/* ─── CAMPOS EDITÁVEIS ─────────────────────────── */}
      <section className="border-b border-studio-border flex-1">
        <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-studio-muted flex items-center gap-1.5">
          <Pencil size={12} />
          Campos editáveis
        </div>

        <div className="px-3 pb-3 space-y-3">
          {slots.length === 0 && (
            <div className="text-2xs text-studio-faint italic">
              Nenhum slot definido neste template.
            </div>
          )}

          {slots.map((slot) => (
            <SlotField
              key={slot.id}
              slot={slot}
              currentValue={getSlotValue(slot.id)}
              onChangeText={(v) => fillSlot(slot.id, v)}
              onChangeAsset={(p) => fillSlot(slot.id, undefined, p)}
            />
          ))}
        </div>
      </section>

      {/* ─── PADRÕES RÁPIDOS ──────────────────────────── */}
      <section className="border-b border-studio-border">
        <div className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-studio-muted flex items-center gap-1.5">
          <Package size={12} />
          Padrões rápidos
        </div>

        <div className="px-3 pb-3 space-y-2">
          <PresetGroup
            label="Prefixo do nome"
            presets={NAME_PRESETS}
            onPick={(v) => {
              const nameSlot = slots.find((s) => s.name === 'slot_nome')
              if (!nameSlot) return
              const current = getSlotValue(nameSlot.id)?.value ?? ''
              fillSlot(nameSlot.id, `${v} ${current.replace(/^(Dr\.|Dra\.|Enf\.|Prof\.|Sr\.|Sra\.)\s*/, '')}`.trim())
            }}
          />
          <PresetGroup
            label="Cargo"
            presets={CARGO_PRESETS}
            onPick={(v) => {
              const cargoSlot = slots.find((s) => s.name === 'slot_cargo')
              if (!cargoSlot) return
              fillSlot(cargoSlot.id, v)
            }}
          />
        </div>
      </section>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────
// SlotField — input variant per slot kind
// ─────────────────────────────────────────────────────────────

interface SlotFieldProps {
  slot: EditableSlot
  currentValue?: { value?: string; assetPath?: string }
  onChangeText: (v: string) => void
  onChangeAsset: (path: string) => void
}

const SlotField: React.FC<SlotFieldProps> = ({ slot, currentValue, onChangeText, onChangeAsset }) => {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <label className="block text-2xs text-studio-muted mb-1">
        {slot.label}
        {slot.required && <span className="text-studio-danger ml-1">*</span>}
      </label>

      {slot.kind === 'text' && (
        <input
          type="text"
          value={currentValue?.value ?? ''}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder={slot.defaultValue ?? ''}
          className="w-full bg-studio-surface border border-studio-border rounded-studio
                     px-2.5 py-2 text-xs text-studio-text
                     focus:outline-none focus:border-studio-success
                     focus:ring-1 focus:ring-studio-success/30
                     transition-colors"
        />
      )}

      {(slot.kind === 'logo' || slot.kind === 'image' || slot.kind === 'svg') && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={slot.kind === 'svg' ? '.svg' : 'image/*,.svg'}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => onChangeAsset(reader.result as string)
              reader.readAsDataURL(file)
            }}
          />
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = () => onChangeAsset(reader.result as string)
              reader.readAsDataURL(file)
            }}
            className="flex flex-col items-center justify-center gap-1.5
                       bg-studio-surface border border-dashed border-studio-border
                       rounded-studio px-3 py-4 cursor-pointer
                       hover:border-studio-accent hover:bg-studio-elevated
                       transition-colors"
          >
            {currentValue?.assetPath ? (
              <>
                <img
                  src={currentValue.assetPath}
                  alt={slot.label}
                  className="max-h-12 max-w-full object-contain"
                />
                <span className="text-2xs text-studio-muted">Clique para trocar</span>
              </>
            ) : (
              <>
                <ImageIcon size={20} className="text-studio-muted" />
                <span className="text-2xs text-studio-muted text-center">
                  Arraste ou clique<br />para enviar
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PresetGroup
// ─────────────────────────────────────────────────────────────

const PresetGroup: React.FC<{
  label: string
  presets: string[]
  onPick: (v: string) => void
}> = ({ label, presets, onPick }) => (
  <div>
    <div className="text-2xs text-studio-muted mb-1">{label}</div>
    <div className="flex flex-wrap gap-1">
      {presets.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="text-2xs px-2 py-1 rounded-studio
                     bg-studio-surface border border-studio-border
                     text-studio-text hover:bg-studio-elevated
                     hover:border-studio-accent transition-colors"
        >
          {p}
        </button>
      ))}
    </div>
  </div>
)
