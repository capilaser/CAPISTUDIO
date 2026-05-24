import React, { useState, useRef, useEffect } from 'react'
import {
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  Circle,
  Undo2,
  Redo2,
  Settings,
  FileText,
  FolderOpen,
  Plus,
  FileImage,
  FileCode2,
  FileBox,
} from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

export function TopBar() {
  const {
    project,
    viewport,
    setProjectName,
    markSaved,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomFit,
    setZoom,
    newProject,
  } = useProjectStore()

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(project.name)
  const [showFileMenu, setShowFileMenu] = useState(false)
  const [showZoomInput, setShowZoomInput] = useState(false)
  const [zoomInputValue, setZoomInputValue] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const zoomRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setNameValue(project.name)
  }, [project.name])

  const handleNameCommit = () => {
    const trimmed = nameValue.trim()
    if (trimmed) setProjectName(trimmed)
    else setNameValue(project.name)
    setEditingName(false)
  }

  const handleZoomCommit = () => {
    const val = parseFloat(zoomInputValue)
    if (!isNaN(val) && val > 0) {
      setZoom(val / 100)
    }
    setShowZoomInput(false)
  }

  const zoomPercent = Math.round(viewport.zoom * 100)

  return (
    <header className="flex items-center h-topbar bg-[#1e1e1e] border-b border-[#2d2d2d] px-3 gap-2 shrink-0 z-30">

      {/* Logo mark */}
      <div className="flex items-center gap-2 mr-1 select-none">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#6366f1]">
          {/* Laser crosshair icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2" fill="white" />
            <circle cx="8" cy="8" r="4.5" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="8" y1="1" x2="8" y2="5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="8" y1="11" x2="8" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="8" x2="5" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[#e5e5e5] font-semibold text-sm tracking-tight">
          Capi Studio
        </span>
      </div>

      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />

      {/* File menu */}
      <div className="relative">
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[#e5e5e5] hover:bg-[#252525] transition-colors"
          onClick={() => setShowFileMenu(!showFileMenu)}
        >
          <FileText size={12} className="text-[#666]" />
          Arquivo
          <ChevronDown size={10} className={`text-[#666] transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
        </button>
        {showFileMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFileMenu(false)} />
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg shadow-2xl z-50 py-1 overflow-hidden">
              <MenuItemRow icon={Plus} label="Novo Projeto" shortcut="Ctrl+N" onClick={() => { newProject(); setShowFileMenu(false) }} />
              <MenuItemRow icon={FolderOpen} label="Abrir..." shortcut="Ctrl+O" onClick={() => setShowFileMenu(false)} />
              <div className="h-px bg-[#2d2d2d] my-1" />
              <MenuItemRow icon={Save} label="Salvar" shortcut="Ctrl+S" onClick={() => { markSaved(); setShowFileMenu(false) }} />
              <MenuItemRow icon={Save} label="Salvar Como..." shortcut="Ctrl+Shift+S" onClick={() => setShowFileMenu(false)} />
            </div>
          </>
        )}
      </div>

      {/* Project name */}
      <div className="flex items-center gap-1.5 mx-1">
        {editingName ? (
          <input
            ref={nameRef}
            className="bg-[#252525] border border-[#6366f1]/50 rounded-md px-2 py-0.5 text-sm text-[#e5e5e5] focus:outline-none focus:ring-1 focus:ring-[#6366f1]/30 w-48"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameCommit()
              if (e.key === 'Escape') { setNameValue(project.name); setEditingName(false) }
            }}
            autoFocus
          />
        ) : (
          <button
            className="flex items-center gap-1.5 text-sm text-[#e5e5e5] hover:text-white transition-colors font-medium"
            onClick={() => setEditingName(true)}
            title="Clique para renomear"
          >
            {project.name}
            {project.isDirty && (
              <Circle size={5} className="fill-[#6366f1] text-[#6366f1]" />
            )}
          </button>
        )}
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button className="p-1.5 rounded text-[#666] hover:text-[#e5e5e5] hover:bg-[#252525] transition-colors" title="Desfazer (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="p-1.5 rounded text-[#666] hover:text-[#e5e5e5] hover:bg-[#252525] transition-colors" title="Refazer (Ctrl+Y)">
          <Redo2 size={14} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 bg-[#252525] border border-[#2d2d2d] rounded-md px-1">
        <button
          className="p-1 rounded text-[#666] hover:text-[#e5e5e5] transition-colors"
          onClick={zoomOut}
          title="Diminuir zoom (-)"
        >
          <ZoomOut size={13} />
        </button>

        {showZoomInput ? (
          <input
            ref={zoomRef}
            className="w-12 text-center bg-transparent text-xs text-[#e5e5e5] focus:outline-none"
            value={zoomInputValue}
            onChange={(e) => setZoomInputValue(e.target.value)}
            onBlur={handleZoomCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleZoomCommit()
              if (e.key === 'Escape') setShowZoomInput(false)
            }}
            autoFocus
          />
        ) : (
          <button
            className="w-12 text-center text-xs text-[#e5e5e5] hover:text-white font-mono transition-colors"
            onClick={() => {
              setZoomInputValue(String(zoomPercent))
              setShowZoomInput(true)
            }}
            title="Clique para digitar zoom"
          >
            {zoomPercent}%
          </button>
        )}

        <button
          className="p-1 rounded text-[#666] hover:text-[#e5e5e5] transition-colors"
          onClick={zoomIn}
          title="Aumentar zoom (+)"
        >
          <ZoomIn size={13} />
        </button>

        <div className="w-px h-4 bg-[#2d2d2d] mx-0.5" />

        <button
          className="p-1 rounded text-[#666] hover:text-[#e5e5e5] transition-colors"
          onClick={zoomFit}
          title="Ajustar ao canvas (F)"
        >
          <Maximize2 size={12} />
        </button>
      </div>

      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />

      {/* Save */}
      <button
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
          project.isDirty
            ? 'border-[#6366f1]/40 text-[#6366f1] hover:bg-[#6366f1]/10'
            : 'border-[#2d2d2d] text-[#666] hover:text-[#e5e5e5] hover:border-[#444]'
        }`}
        onClick={markSaved}
        title="Salvar (Ctrl+S)"
      >
        <Save size={12} />
        {project.isDirty ? 'Salvar*' : 'Salvo'}
      </button>

      <div className="w-px h-5 bg-[#2d2d2d] mx-0.5" />

      {/* Export buttons — PNG / SVG / DXF */}
      <div className="flex items-center gap-1">
        <ExportButton
          icon={FileImage}
          label="PNG"
          color="#3b82f6"
          title="Exportar PNG (raster para mockup)"
        />
        <ExportButton
          icon={FileCode2}
          label="SVG"
          color="#10b981"
          title="Exportar SVG (vetorial)"
        />
        <ExportButton
          icon={FileBox}
          label="DXF"
          color="#f59e0b"
          title="Exportar DXF (para corte CNC/laser)"
        />
      </div>

      <div className="w-px h-5 bg-[#2d2d2d] mx-1" />

      {/* Settings */}
      <button className="p-1.5 rounded text-[#666] hover:text-[#e5e5e5] hover:bg-[#252525] transition-colors" title="Configurações">
        <Settings size={14} />
      </button>
    </header>
  )
}

// ── Export button ─────────────────────────────────────────────────────────────

function ExportButton({
  icon: Icon,
  label,
  color,
  title,
}: {
  icon: React.ElementType
  label: string
  color: string
  title: string
}) {
  return (
    <button
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors hover:opacity-90 active:scale-95"
      style={{
        borderColor: `${color}50`,
        backgroundColor: `${color}18`,
        color: color,
      }}
      title={title}
    >
      <Icon size={12} />
      <span className="font-semibold font-mono">{label}</span>
    </button>
  )
}

// ── Menu item row ─────────────────────────────────────────────────────────────

function MenuItemRow({
  icon: Icon,
  label,
  shortcut,
  onClick,
}: {
  icon: React.ElementType
  label: string
  shortcut?: string
  onClick: () => void
}) {
  return (
    <button
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-[#e5e5e5] hover:bg-[#252525] hover:text-white transition-colors"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <Icon size={12} className="text-[#666]" />
        {label}
      </span>
      {shortcut && (
        <span className="text-[#444] font-mono text-2xs">{shortcut}</span>
      )}
    </button>
  )
}
