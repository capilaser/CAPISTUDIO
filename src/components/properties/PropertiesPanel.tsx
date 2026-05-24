import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Link,
  Unlink,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

export function PropertiesPanel() {
  const { selection, project } = useProjectStore()

  const selectedLayer = project.canvas.layers.find(
    (l) => l.id === selection.selectedLayerId
  )

  const selectedElements = selectedLayer
    ? selectedLayer.elements.filter((e) =>
        selection.selectedElementIds.includes(e.id)
      )
    : []

  const hasSelection = selectedElements.length > 0
  const singleElement = selectedElements.length === 1 ? selectedElements[0] : null

  return (
    <div className="flex flex-col overflow-y-auto">
      {/* Transform section */}
      <TransformSection
        element={singleElement}
        hasSelection={hasSelection}
        multiCount={selectedElements.length}
      />

      {/* Fill section */}
      <FillSection element={singleElement} hasSelection={hasSelection} />

      {/* Stroke section */}
      <StrokeSection element={singleElement} hasSelection={hasSelection} />

      {/* Canvas section */}
      <CanvasSection />
    </div>
  )
}

// ── Transform Section ─────────────────────────────────────────────────────────

function TransformSection({
  element,
  hasSelection,
  multiCount,
}: {
  element: any
  hasSelection: boolean
  multiCount: number
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [linked, setLinked] = useState(true)

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Transformar</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </div>

      {!collapsed && (
        <div className="px-2 pb-3 space-y-1.5">
          {!hasSelection && (
            <div className="px-1 py-2 text-center text-studio-faint text-xs">
              Selecione um elemento
            </div>
          )}
          {hasSelection && multiCount > 1 && (
            <div className="px-1 py-1 text-center text-studio-muted text-xs">
              {multiCount} elementos selecionados
            </div>
          )}
          {hasSelection && (
            <>
              {/* X / Y */}
              <div className="grid grid-cols-2 gap-1.5">
                <PropInput label="X" value={element?.transform?.x?.toFixed(1) ?? '—'} disabled={!element} />
                <PropInput label="Y" value={element?.transform?.y?.toFixed(1) ?? '—'} disabled={!element} />
              </div>
              {/* W / H */}
              <div className="grid grid-cols-2 gap-1.5">
                <PropInput label="L" value={element?.transform?.width?.toFixed(1) ?? '—'} disabled={!element} />
                <div className="relative">
                  <PropInput label="A" value={element?.transform?.height?.toFixed(1) ?? '—'} disabled={!element} />
                </div>
              </div>
              {/* Rotation */}
              <div className="grid grid-cols-2 gap-1.5">
                <PropInput label="Rot" value={element?.transform?.rotation?.toFixed(1) ?? '0'} suffix="°" disabled={!element} />
                <div className="flex items-center">
                  <button
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-studio border transition-colors ${
                      linked
                        ? 'border-studio-accent/40 text-studio-accent'
                        : 'border-studio-border text-studio-muted'
                    }`}
                    onClick={() => setLinked(!linked)}
                    title={linked ? 'Desvincular proporções' : 'Vincular proporções'}
                  >
                    {linked ? <Link size={11} /> : <Unlink size={11} />}
                    <span>{linked ? 'Vinc.' : 'Livre'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fill Section ──────────────────────────────────────────────────────────────

function FillSection({ element, hasSelection }: { element: any; hasSelection: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Preenchimento</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </div>

      {!collapsed && (
        <div className="px-2 pb-3">
          {!hasSelection ? (
            <div className="px-1 py-2 text-center text-studio-faint text-xs">
              Selecione um elemento
            </div>
          ) : (
            <div className="space-y-2">
              {/* Type selector */}
              <div className="flex items-center gap-2 px-1">
                <span className="prop-label">Tipo</span>
                <select className="prop-input">
                  <option value="solid">Sólido</option>
                  <option value="none">Nenhum</option>
                  <option value="gradient">Gradiente</option>
                </select>
              </div>
              {/* Color */}
              <div className="flex items-center gap-2 px-1">
                <span className="prop-label">Cor</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <div
                    className="w-6 h-6 rounded-studio border border-studio-border cursor-pointer"
                    style={{ backgroundColor: element?.fill?.color ?? '#6366f1' }}
                  />
                  <input
                    className="prop-input font-mono uppercase"
                    value={element?.fill?.color ?? '#6366f1'}
                    readOnly
                  />
                </div>
              </div>
              {/* Opacity */}
              <div className="flex items-center gap-2 px-1">
                <span className="prop-label">Opacidade</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="100"
                  className="flex-1 accent-studio-accent"
                />
                <span className="text-xs text-studio-muted w-8 text-right">100%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stroke Section ────────────────────────────────────────────────────────────

function StrokeSection({ element, hasSelection }: { element: any; hasSelection: boolean }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Contorno</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </div>

      {!collapsed && (
        <div className="px-2 pb-3">
          {!hasSelection ? (
            <div className="px-1 py-2 text-center text-studio-faint text-xs">
              Selecione um elemento
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="prop-label">Cor</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <div
                    className="w-6 h-6 rounded-studio border border-studio-border cursor-pointer"
                    style={{ backgroundColor: element?.stroke?.color ?? '#ef4444' }}
                  />
                  <input
                    className="prop-input font-mono uppercase"
                    value={element?.stroke?.color ?? '#ef4444'}
                    readOnly
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 px-1">
                <span className="prop-label">Espessura</span>
                <input className="prop-input" type="number" defaultValue="1" min="0" />
                <span className="text-xs text-studio-muted">px</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Canvas Section ────────────────────────────────────────────────────────────

function CanvasSection() {
  const { project } = useProjectStore()
  const [collapsed, setCollapsed] = useState(false)
  const { canvas } = project

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setCollapsed(!collapsed)}>
        <span>Canvas</span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </div>

      {!collapsed && (
        <div className="px-2 pb-3 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <PropInput label="Larg." value={String(canvas.width)} suffix="px" />
            <PropInput label="Alt." value={String(canvas.height)} suffix="px" />
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="prop-label">Fundo</span>
            <div className="flex items-center gap-1.5 flex-1">
              <div
                className="w-6 h-6 rounded-studio border border-studio-border cursor-pointer"
                style={{ backgroundColor: canvas.backgroundColor }}
              />
              <input
                className="prop-input font-mono uppercase"
                value={canvas.backgroundColor}
                readOnly
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="prop-label">Unidade</span>
            <select className="prop-input">
              <option value="px">px</option>
              <option value="mm">mm</option>
              <option value="in">in</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-1">
            <span className="prop-label">DPI</span>
            <input className="prop-input" type="number" value={canvas.dpi} readOnly />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared input ──────────────────────────────────────────────────────────────

function PropInput({
  label,
  value,
  suffix,
  disabled,
}: {
  label: string
  value: string
  suffix?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="text-studio-faint text-2xs w-5 shrink-0">{label}</span>
      <div className="relative flex-1">
        <input
          className={`prop-input w-full ${disabled ? 'opacity-40' : ''}`}
          value={value}
          readOnly={disabled}
          onChange={() => {}}
        />
        {suffix && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-studio-faint text-2xs">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
