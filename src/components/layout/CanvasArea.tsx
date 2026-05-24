import React, { useEffect, useRef, useState } from 'react'
import { StudioCanvas } from '@/components/canvas/StudioCanvas'
import { useProjectStore } from '@/store/useProjectStore'

export const CanvasArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const zoom = useProjectStore((s) => s.viewport.zoom)
  const project = useProjectStore((s) => s.currentProject)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#252525]">
        {size.width > 0 && size.height > 0 && (
          <StudioCanvas width={size.width} height={size.height} />
        )}

        {/* Dimensions label */}
        {project && (
          <div className="absolute bottom-3 left-3 text-2xs text-studio-muted bg-studio-sidebar/80 backdrop-blur px-2 py-1 rounded-studio border border-studio-border pointer-events-none">
            {project.document.widthMm} × {project.document.heightMm} mm
          </div>
        )}

        {/* Zoom indicator */}
        <div className="absolute bottom-3 right-3 text-2xs text-studio-muted bg-studio-sidebar/80 backdrop-blur px-2 py-1 rounded-studio border border-studio-border pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  )
}
