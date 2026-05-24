import React from 'react'
import { LayersPanel } from '@/components/layers/LayersPanel'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'

export const RightSidebar: React.FC = () => {
  return (
    <aside
      className="flex flex-col bg-studio-sidebar border-l border-studio-border overflow-hidden"
      style={{ width: 260, minWidth: 260 }}
    >
      <div className="flex-shrink-0">
        <LayersPanel />
      </div>
      <div className="flex-1 overflow-hidden">
        <PropertiesPanel />
      </div>
    </aside>
  )
}
