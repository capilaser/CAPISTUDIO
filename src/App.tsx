import React, { useEffect, useRef, useState, useCallback } from 'react'
import { BrocheModule } from '@/components/broche/BrocheModule'
import { useBrocheStore } from '@/store/useBrocheStore'
import { saveProject } from '@/utils/projectSave'

export default function App() {
  const store = useBrocheStore()
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.getDocumentsPath
      if (!isElectron) {
        showToast('Salvar disponível apenas no app desktop.')
        return
      }
      const docsPath = await window.electronAPI.getDocumentsPath()
      const state = {
        type: store.type,
        color: store.color,
        logoHref: store.logoHref,
        hasLogo: store.hasLogo,
        logoSource: store.logoSource,
        activePatternId: store.activePatternId,
        activeFilter: store.activeFilter,
        elements: store.elements,
        nameText: store.nameText,
        nameFont: store.nameFont,
        professionText: store.professionText,
        professionFont: store.professionFont,
      }
      const folderPath = await saveProject(state, docsPath)
      if (folderPath) {
        const folderName = folderPath.split('/').pop() ?? folderPath
        store.markSaved(new Date().toISOString())
        showToast(`Salvo em Documents/CapiStudio/pedidos/${folderName}`)
      } else {
        showToast('Erro ao salvar projeto.')
      }
    } finally {
      setSaving(false)
    }
  }, [saving, store])

  // Export DXF trigger (dispatched via keyboard)
  const handleExportDXF = useCallback(() => {
    // Dispatch a custom event that BrocheCanvas listens to
    window.dispatchEvent(new CustomEvent('capi:exportDXF'))
  }, [])

  const handleExportPNG = useCallback(() => {
    window.dispatchEvent(new CustomEvent('capi:exportPNG'))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return

      if (e.key === 's') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'd') {
        e.preventDefault()
        handleExportDXF()
      } else if (e.key === 'p') {
        e.preventDefault()
        handleExportPNG()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, handleExportDXF, handleExportPNG])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header className="header">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="header-title">Capi Studio — Broches</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Save status indicator */}
          <span className={`save-status${store.isSaved ? ' saved' : ''}`}>
            {store.isSaved ? '✓ salvo' : '• não salvo'}
          </span>
          {/* Save button */}
          <button
            className="btn btn-save"
            onClick={handleSave}
            disabled={saving}
            title="Salvar pedido (Ctrl+S)"
          >
            {saving ? '...' : '💾 Salvar pedido'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            v0.2 · Broche Magnético 60×25mm
          </div>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          {toast}
        </div>
      )}

      {/* ── Main app ── */}
      <div className="app">
        <BrocheModule />
      </div>

    </div>
  )
}
