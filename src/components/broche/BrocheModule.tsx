import React from 'react'
import { BrocheSidebar } from './BrocheSidebar'
import { PatternStrip } from './PatternStrip'
import { BrocheCanvas } from './BrocheCanvas'

export function BrocheModule() {
  return (
    <div id="modulo1-view" className="active">
      <BrocheSidebar />
      <main className="main">
        <PatternStrip />
        <BrocheCanvas />
      </main>
    </div>
  )
}
