import React from 'react'
import { ChevronRight } from 'lucide-react'
import { LayersPanel } from '@/components/layers/LayersPanel'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'
import { useProjectStore } from '@/store/useProjectStore'

export function RightSidebar() {
  const { rightSidebarCollapsed, toggleRightSidebar } = useProjectStore()

  return (
    <aside
      className={`
        flex bg-[#1e1e1e] border-l border-[#2d2d2d] shrink-0 z-20
        transition-all duration-200 overflow-hidden
        ${rightSidebarCollapsed ? 'w-0' : 'w-64'}
      `}
    >
      <div className="flex flex-col w-full h-full overflow-hidden">

        {/* Collapse button — top right */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#2d2d2d] shrink-0">
          <span className="text-xs font-semibold text-[#666] uppercase tracking-wide">
            Produção
          </span>
          <button
            className="text-[#666] hover:text-[#e5e5e5] transition-colors"
            onClick={toggleRightSidebar}
            title="Recolher painel"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* TOP HALF — Layers list (fixed height) */}
        <div className="flex flex-col border-b border-[#2d2d2d]" style={{ minHeight: 0, flex: '1 1 0' }}>
          <LayersPanel />
        </div>

        {/* BOTTOM HALF — Element/Layer properties */}
        <div className="flex flex-col overflow-y-auto" style={{ flex: '1 1 0' }}>
          <PropertiesPanel />
        </div>

      </div>
    </aside>
  )
}
