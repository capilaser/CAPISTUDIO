import React, { useRef } from 'react'
import {
  LayoutTemplate,
  Type,
  ImagePlus,
  FolderOpen,
  ChevronLeft,
  Upload,
  FileImage,
  Layers,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'
import type { TemplateField } from '@/store/useProjectStore'

export function LeftSidebar() {
  const { leftSidebarCollapsed, toggleLeftSidebar, templateFields, updateTemplateField } =
    useProjectStore()

  return (
    <aside
      className={`
        flex flex-col bg-[#1e1e1e] border-r border-[#2d2d2d] shrink-0 z-20
        transition-all duration-200 overflow-hidden
        ${leftSidebarCollapsed ? 'w-0' : 'w-64'}
      `}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2d2d2d] shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={13} className="text-[#6366f1]" />
            <span className="text-xs font-semibold text-[#e5e5e5] tracking-wide uppercase">
              Edição Rápida
            </span>
          </div>
          <button
            className="text-[#666] hover:text-[#e5e5e5] transition-colors"
            onClick={toggleLeftSidebar}
            title="Recolher painel"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Template section */}
          <Section icon={LayoutTemplate} title="Template">
            <button className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-[#2d2d2d] bg-[#252525] hover:border-[#6366f1]/50 hover:bg-[#252525] transition-colors group">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#6366f1]/20 flex items-center justify-center">
                  <LayoutTemplate size={11} className="text-[#6366f1]" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-medium text-[#e5e5e5]">Template atual</div>
                  <div className="text-2xs text-[#666]">Caixa Presente v2</div>
                </div>
              </div>
              <FolderOpen size={12} className="text-[#666] group-hover:text-[#6366f1] transition-colors" />
            </button>
          </Section>

          {/* Campos de texto editáveis */}
          <Section icon={Type} title="Campos de Texto">
            {templateFields
              .filter((f) => f.type === 'text')
              .map((field) => (
                <TextFieldRow
                  key={field.id}
                  field={field}
                  onChange={(val) => updateTemplateField(field.id, val)}
                />
              ))}
          </Section>

          {/* Logo / Asset slots */}
          <Section icon={ImagePlus} title="Logos e Assets">
            {templateFields
              .filter((f) => f.type === 'logo' || f.type === 'image')
              .map((field) => (
                <AssetSlotRow key={field.id} field={field} />
              ))}
          </Section>

          {/* Assets importados */}
          <Section icon={FileImage} title="Assets do Projeto">
            <div className="space-y-1">
              <AssetFileRow name="logo-cliente.svg" size="12 KB" type="SVG" />
              <AssetFileRow name="icone-presente.png" size="48 KB" type="PNG" />
            </div>
            <button className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md border border-dashed border-[#2d2d2d] hover:border-[#6366f1]/50 text-[#666] hover:text-[#6366f1] text-xs transition-colors">
              <Upload size={11} />
              Importar asset
            </button>
          </Section>

          {/* Camadas rápidas (read-only overview) */}
          <Section icon={Layers} title="Camadas do Template">
            <LayerQuickRow color="#555555" name="Base" type="base" />
            <LayerQuickRow color="#000000" name="Corte" type="corte" />
            <LayerQuickRow color="#ef4444" name="Gravação" type="gravação" />
            <LayerQuickRow color="#8b5cf6" name="Texto" type="texto" />
          </Section>

        </div>
      </div>
    </aside>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="px-3 py-3 border-b border-[#2d2d2d]">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon size={11} className="text-[#666]" />
        <span className="text-2xs font-semibold text-[#666] uppercase tracking-widest">
          {title}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ── Text field row ───────────────────────────────────────────────────────────

function TextFieldRow({
  field,
  onChange,
}: {
  field: TemplateField
  onChange: (val: string) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-2xs text-[#666] font-medium">{field.label}</label>
      <input
        className="w-full bg-[#252525] border border-[#2d2d2d] rounded-md px-2.5 py-1.5 text-xs text-[#e5e5e5] placeholder-[#444] focus:outline-none focus:border-[#6366f1]/60 focus:ring-1 focus:ring-[#6366f1]/20 transition-colors"
        value={field.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Digite ${field.label.toLowerCase()}...`}
      />
    </div>
  )
}

// ── Asset slot row ───────────────────────────────────────────────────────────

function AssetSlotRow({ field }: { field: TemplateField }) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-1">
      <label className="block text-2xs text-[#666] font-medium">{field.label}</label>
      <button
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-dashed border-[#2d2d2d] hover:border-[#6366f1]/50 bg-[#252525] hover:bg-[#252525] transition-colors group"
        onClick={() => fileRef.current?.click()}
      >
        {field.value ? (
          <>
            <div className="w-8 h-8 rounded bg-[#2d2d2d] flex items-center justify-center shrink-0">
              <FileImage size={14} className="text-[#6366f1]" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs text-[#e5e5e5] truncate">{field.value}</div>
              <div className="text-2xs text-[#666]">Clique para substituir</div>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded border border-dashed border-[#444] flex items-center justify-center shrink-0 group-hover:border-[#6366f1]/50">
              <ImagePlus size={14} className="text-[#444] group-hover:text-[#6366f1] transition-colors" />
            </div>
            <div className="text-left">
              <div className="text-xs text-[#666] group-hover:text-[#e5e5e5] transition-colors">
                Nenhum arquivo
              </div>
              <div className="text-2xs text-[#444]">Clique para carregar</div>
            </div>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept=".svg,.png,.jpg" className="hidden" />
    </div>
  )
}

// ── Asset file row ───────────────────────────────────────────────────────────

function AssetFileRow({
  name,
  size,
  type,
}: {
  name: string
  size: string
  type: string
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#252525] cursor-pointer group transition-colors">
      <FileImage size={12} className="text-[#666] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#e5e5e5] truncate">{name}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-2xs text-[#444]">{size}</span>
        <span className="text-2xs font-mono bg-[#2d2d2d] text-[#666] px-1 py-0.5 rounded">
          {type}
        </span>
      </div>
    </div>
  )
}

// ── Layer quick row (overview only) ─────────────────────────────────────────

function LayerQuickRow({
  color,
  name,
  type,
}: {
  color: string
  name: string
  type: string
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <span
        className="w-2 h-2 rounded-full shrink-0 border border-white/10"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-[#e5e5e5] flex-1">{name}</span>
      <span className="text-2xs text-[#666]">{type}</span>
    </div>
  )
}
