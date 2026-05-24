import React from 'react'
import { StudioCanvas } from '@/components/canvas/StudioCanvas'

export const CanvasArea: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <StudioCanvas />
    </div>
  )
}
