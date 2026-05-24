import React, { useState, useEffect, useRef } from 'react'
import { Save, ZoomIn, ZoomOut, Maximize2, FileImage, FileType, FileBox } from 'lucide-react'
import { useProjectStore } from '@/store/useProjectStore'

export const TopBar: React.FC = () => {
  const project = useProjectStore((s) => s.currentProject)
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const templates = useProjectStore((s) => s.templates)
  const zoom = useProjectStore((s) => s.viewport.zoom)
  const zoomIn = useProjectStore((s) => s.zoomIn)
  const zoomOut = useProjectStore((s) => s.zoomOut)
  const zoomFit = useProjectStore((s) => s.zoomFit)

  const [editingName, setEditingName] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName && inputRef.current) inputRef.current.select()
  }, [editingName])

  const templateName = templates.find((t) => t.id === project?.templateId)?.name

  return (
    <header className="flex items-center h-12 px-3 bg-studio-sidebar border-b border-studio-border shrink-0 select-none">
      {/* Left — logo + project name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-studio bg-studio-accent flex items-center justify-center text-white text-2xs font-bold">
            CS
          </div>
          <span className="text-xs font-semibold text-studio-text">Capi Studio</span>
        </div>

        <div className="w-px h-5 bg-studio-border" />

        {editingName ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              updateProjectName(draft.trim() || project?.name || 'Sem nome')
              setEditingName(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="bg-studio-surface border border-studio-border rounded-studio px-2 py-1 text-xs text-studio-text focus:outline-none focus:border-studio-accent"
            style={{ width: 240 }}
          />
        ) : (
          <button
            onClick={() => {
              setDraft(project?.name ?? '')
              setEditingName(true)
            }}
            className="text-xs text-studio-text hover:text-white max-w-[260px] truncate text-left"
            title="Clique para renomear"
          >
            {project?.name ?? 'Sem projeto'}
          </button>
        )}
      </div>

      {/* Center — template indicator */}
      <div className="flex-1 flex items-center justify-center text-2xs text-studio-muted">
        {templateName && (
          <span className="px-2.5 py-1 rounded-studio bg-studio-elevated border border-studio-border">
            Template: <span className="text-studio-text font-medium">{templateName}</span>
          </span>
        )}
      </div>

      {/* Right — export + save + zoom */}
      <div className="flex items-center gap-1.5">
        <ExportButton icon={<FileImage size={12} />} label="PNG" />
        <ExportButton icon={<FileType size={12} />} label="SVG" />
        <ExportButton icon={<FileBox size={12} />} label="DXF" />

        <div className="w-px h-5 bg-studio-border mx-1" />

        <button className="btn-secondary" title="Salvar projeto">
          <Save size={12} />
          <span>Salvar</span>
        </button>

        <div className="w-px h-5 bg-studio-border mx-1" />

        <button onClick={zoomOut} className="p-1.5 rounded-studio text-studio-muted hover:text-studio-text hover:bg-studio-elevated" title="Diminuir zoom">
          <ZoomOut size={14} />
        </button>
        <span className="text-2xs text-studio-muted w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomIn} className="p-1.5 rounded-studio text-studio-muted hover:text-studio-text hover:bg-studio-elevated" title="Aumentar zoom">
          <ZoomIn size={14} />
        </button>
        <button onClick={zoomFit} className="p-1.5 rounded-studio text-studio-muted hover:text-studio-text hover:bg-studio-elevated" title="Ajustar à tela">
          <Maximize2 size={14} />
        </button>
      </div>
    </header>
  )
}

const ExportButton: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <button
    disabled
    title={`Exportar ${label} — em breve`}
    className="flex items-center gap-1 px-2 py-1.5 rounded-studio
               bg-studio-surface border border-studio-border text-studio-muted
               text-2xs font-medium opacity-60 cursor-not-allowed"
  >
    {icon}
    {label}
  </button>
)
