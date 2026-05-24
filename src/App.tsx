import React from 'react'
import { BrocheModule } from '@/components/broche/BrocheModule'

export default function App() {
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
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
          v0.2 · Broche Magnético 60×25mm
        </div>
      </header>

      {/* ── Main app ── */}
      <div className="app">
        <BrocheModule />
      </div>

    </div>
  )
}
