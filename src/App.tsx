import React, { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { CanvasArea } from '@/components/layout/CanvasArea'
import { StatusBar } from '@/components/layout/StatusBar'
import { useProjectStore } from '@/store/useProjectStore'

export default function App() {
  // Global keyboard shortcuts (limited to v1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useProjectStore.getState()
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      const ctrl = e.ctrlKey || e.metaKey

      if (!ctrl) {
        switch (e.key.toLowerCase()) {
          case 'v': store.setTool('select'); break
          case 't': store.setTool('text'); break
          case 'i': store.setTool('image'); break
          case 'h': store.setTool('pan'); break
          case '+':
          case '=': store.zoomIn(); break
          case '-': store.zoomOut(); break
          case '0': store.zoomReset(); break
          case 'f': store.zoomFit(); break
          case 'escape': store.clearSelection(); break
        }
      } else if (e.key === '0') {
        e.preventDefault()
        store.zoomReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-studio-bg">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CanvasArea />
        <RightSidebar />
      </div>
      <StatusBar />
    </div>
  )
}
