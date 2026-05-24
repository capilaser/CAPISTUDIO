import React, { useState, useRef, useEffect } from 'react'
import {
  Save,
  Download,
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
    <header className="flex items-center h-topbar bg-studio-sidebar border-b border-studio-border px-3 gap-2 shrink-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2 select-none">
        <div className="flex items-center justify-center w-7 h-7 rounded-studio bg-studio-accent">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3" fill="white" />
            <path d="M8 1 L8 4 M8 12 L8 15 M1 8 L4 8 M12 8 L15 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3.5 3.5 L5.5 5.5 M10.5 10.5 L12.5 12.5 M3.5 12.5 L5.5 10.5 M10.5 5.5 L12.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-studio-text font-semibold text-sm tracking-tight">Capi Studio</span>
      </div>

      <div className="studio-separator" />

      {/* File menu */}
      <div className="relative">
        <button
          className="btn-ghost text-xs"
          onClick={() => setShowFileMenu(!showFileMenu)}
        >
          <FileText size={13} />
          Arquivo
          <ChevronDown size={11} className={`transition-transform ${showFileMenu ? 'rotate-180' : ''}`} />
        </button>
        {showFileMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowFileMenu(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-48 bg-studio-elevated border border-studio-border rounded-studio shadow-xl z-50 py-1 animate-fade-in">
              <MenuItemRow icon={Plus} label="Novo Projeto" shortcut="Ctrl+N" onClick={() => { newProject(); setShowFileMenu(false) }} />
              <MenuItemRow icon={FolderOpen} label="Abrir..." shortcut="Ctrl+O" onClick={() => setShowFileMenu(false)} />
              <div className="h-px bg-studio-border my-1" />
              <MenuItemRow icon={Save} label="Salvar" shortcut="Ctrl+S" onClick={() => { markSaved(); setShowFileMenu(false) }} />
              <MenuItemRow icon={Save} label="Salvar Como..." shortcut="Ctrl+Shift+S" onClick={() => setShowFileMenu(false)} />
              <div className="h-px bg-studio-border my-1" />
              <MenuItemRow icon={Download} label="Exportar..." shortcut="Ctrl+E" onClick={() => setShowFileMenu(false)} />
            </div>
          </>
        )}
      </div>

      {/* Project name */}
      <div className="flex items-center gap-1.5 mx-2">
        {editingName ? (
          <input
            ref={nameRef}
            className="bg-studio-surface border border-studio-accent rounded-studio px-2 py-0.5 text-sm text-studio-text focus:outline-none focus:ring-1 focus:ring-studio-accent/50 w-48"
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
            className="flex items-center gap-1.5 text-sm text-studio-text hover:text-white transition-colors font-medium"
            onClick={() => setEditingName(true)}
            title="Clique para renomear"
          >
            {project.name}
            {project.isDirty && (
              <Circle size={6} className="fill-studio-accent text-studio-accent" />
            )}
          </button>
        )}
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5">
        <button className="btn-ghost px-1.5" title="Desfazer (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button className="btn-ghost px-1.5" title="Refazer (Ctrl+Y)">
          <Redo2 size={14} />
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 bg-studio-surface border border-studio-border rounded-studio px-1">
        <button
          className="btn-ghost px-1.5 py-1"
          onClick={zoomOut}
          title="Diminuir zoom (-)"
        >
          <ZoomOut size={14} />
        </button>

        {showZoomInput ? (
          <input
            ref={zoomRef}
            className="w-12 text-center bg-transparent text-xs text-studio-text focus:outline-none"
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
            className="w-12 text-center text-xs text-studio-text hover:text-white font-mono transition-colors"
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
          className="btn-ghost px-1.5 py-1"
          onClick={zoomIn}
          title="Aumentar zoom (+)"
        >
          <ZoomIn size={14} />
        </button>

        <div className="studio-separator" />

        <button
          className="btn-ghost px-1.5 py-1"
          onClick={zoomFit}
          title="Ajustar ao canvas (F)"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div className="studio-separator" />

      {/* Save */}
      <button
        className={`btn-secondary text-xs ${project.isDirty ? 'border-studio-accent/40 text-studio-accent' : ''}`}
        onClick={markSaved}
        title="Salvar (Ctrl+S)"
      >
        <Save size={13} />
        {project.isDirty ? 'Salvar*' : 'Salvo'}
      </button>

      {/* Export */}
      <button className="btn-primary" title="Exportar (Ctrl+E)">
        <Download size={13} />
        Exportar
      </button>

      <div className="studio-separator" />

      {/* Settings */}
      <button className="btn-ghost px-1.5" title="Configurações">
        <Settings size={14} />
      </button>
    </header>
  )
}

// ── Helper ──────────────────────────────────────────────────────────────────

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
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-studio-text hover:bg-studio-surface hover:text-white transition-colors"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <Icon size={12} className="text-studio-muted" />
        {label}
      </span>
      {shortcut && (
        <span className="text-studio-faint font-mono text-2xs">{shortcut}</span>
      )}
    </button>
  )
}
