import React, { useState } from 'react'
import { ChevronRight, Layers, SlidersHorizontal } from 'lucide-react'
import { LayersPanel } from '@/components/layers/LayersPanel'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'
import { useProjectStore } from '@/store/useProjectStore'

type RightTab = 'layers' | 'properties'

export function RightSidebar() {
  const { rightSidebarCollapsed, toggleRightSidebar } = useProjectStore()
  const [activeTab, setActiveTab] = useState<RightTab>('layers')

  return (
    <aside
      className={`
        flex bg-studio-sidebar border-l border-studio-border shrink-0 z-20
        transition-all duration-200 overflow-hidden
        ${rightSidebarCollapsed ? 'w-0' : 'w-sidebar-wide'}
      `}
    >
      <div className="flex flex-col w-full">
        {/* Tab bar */}
        <div className="flex items-center border-b border-studio-border shrink-0">
          <button
            className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'layers'
                ? 'border-studio-accent text-studio-text'
                : 'border-transparent text-studio-muted hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('layers')}
          >
            <Layers size={13} />
            Camadas
          </button>
          <button
            className={`flex items-center gap-1.5 flex-1 justify-center py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === 'properties'
                ? 'border-studio-accent text-studio-text'
                : 'border-transparent text-studio-muted hover:text-studio-text'
            }`}
            onClick={() => setActiveTab('properties')}
          >
            <SlidersHorizontal size={13} />
            Propriedades
          </button>

          {/* Collapse */}
          <button
            className="px-2 text-studio-faint hover:text-studio-muted transition-colors"
            onClick={toggleRightSidebar}
            title="Recolher painel"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'layers' && <LayersPanel />}
          {activeTab === 'properties' && <PropertiesPanel />}
        </div>
      </div>
    </aside>
  )
}
