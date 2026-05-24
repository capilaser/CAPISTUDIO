import React, { useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { CanvasArea } from '@/components/layout/CanvasArea'
import { StatusBar } from '@/components/layout/StatusBar'
import { useProjectStore } from '@/store/useProjectStore'

export default function App() {
  const { leftSidebarCollapsed, rightSidebarCollapsed } = useProjectStore()

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useProjectStore.getState()

      // Don't fire when inside input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      const ctrl = e.ctrlKey || e.metaKey

      if (!ctrl) {
        switch (e.key.toLowerCase()) {
          case 'v': store.setTool('select'); break
          case 'h': store.setTool('move'); break
          case 't': store.setTool('text'); break
          case 'r': store.setTool('rectangle'); break
          case 'e': store.setTool('ellipse'); break
          case 'l': store.setTool('line'); break
          case 'p': store.setTool('pen'); break
          case 'i': store.setTool('image'); break
          case '+':
          case '=': store.zoomIn(); break
          case '-': store.zoomOut(); break
          case '0': store.zoomReset(); break
          case 'f': store.zoomFit(); break
          case 'escape': store.clearSelection(); break
        }
      } else {
        // Ctrl shortcuts
        if (e.key === '0') { e.preventDefault(); store.zoomReset() }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-studio-bg">
      {/* Top Bar */}
      <TopBar />

      {/* Main area: sidebars + canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Canvas */}
        <CanvasArea />

        {/* Right Sidebar */}
        <RightSidebar />
      </div>

      {/* Status Bar */}
      <StatusBar />
    </div>
  )
}
