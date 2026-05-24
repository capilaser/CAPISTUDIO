import React, { useRef, useEffect, useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'
import { MM_TO_PX } from '@/types'
import type { CanvasElement, TextElementData, ImageElementData, ShapeElementData } from '@/types'

/**
 * SVG-based canvas renderer.
 * - artboard dimensions in mm, scaled to px via MM_TO_PX × zoom.
 * - elements rendered using SVG primitives (text, image, rect, circle).
 * - selected element shown with blue outline.
 */
export const StudioCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const project = useProjectStore((s) => s.currentProject)
  const viewport = useProjectStore((s) => s.viewport)
  const selection = useProjectStore((s) => s.selection)
  const selectElement = useProjectStore((s) => s.selectElement)
  const clearSelection = useProjectStore((s) => s.clearSelection)
  const setPan = useProjectStore((s) => s.setPan)

  // pan drag state
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    const handleUp = () => {
      setIsPanning(false)
      panStart.current = null
    }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [])

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-studio-canvas text-studio-muted text-xs">
        Nenhum projeto aberto.
      </div>
    )
  }

  const { document: doc } = project
  const scale = MM_TO_PX * viewport.zoom
  const artW = doc.widthMm * scale
  const artH = doc.heightMm * scale

  // sort layers ascending order = render bottom→top
  const layers = [...doc.layers].sort((a, b) => a.order - b.order)
  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id))

  // build rendering list ordered by layer order; within layer, original element order
  const renderList: CanvasElement[] = []
  for (const layer of layers) {
    if (!visibleLayerIds.has(layer.id)) continue
    for (const el of doc.elements) {
      if (el.layerId === layer.id && el.visible) renderList.push(el)
    }
  }

  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || e.button === 2) {
      // middle/alt = pan
      setIsPanning(true)
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      }
      e.preventDefault()
    } else {
      clearSelection()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan(panStart.current.panX + dx, panStart.current.panY + dy)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 relative overflow-hidden bg-studio-canvas"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      {/* Dotted background hint */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle, #444 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div
        className="absolute inset-0 flex items-center justify-center"
        onMouseDown={handleBackgroundMouseDown}
      >
        <div
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
          }}
        >
          {/* artboard shadow */}
          <div
            style={{
              width: artW,
              height: artH,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              borderRadius: 2,
              overflow: 'visible',
            }}
          >
            <svg
              width={artW}
              height={artH}
              viewBox={`0 0 ${doc.widthMm} ${doc.heightMm}`}
              style={{
                display: 'block',
                background: doc.backgroundColor,
                borderRadius: 2,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {renderList.map((el) => (
                <ElementRenderer
                  key={el.id}
                  element={el}
                  selected={selection.elementId === el.id}
                  onSelect={() => selectElement(el.id)}
                />
              ))}
            </svg>
          </div>

          {/* dimensions label */}
          <div className="text-2xs text-studio-muted text-center mt-1">
            {doc.widthMm} × {doc.heightMm} mm
          </div>
        </div>
      </div>

      {/* zoom indicator */}
      <div className="absolute bottom-3 right-3 text-2xs text-studio-muted bg-studio-sidebar/80 backdrop-blur px-2 py-1 rounded-studio border border-studio-border pointer-events-none">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ElementRenderer
// ─────────────────────────────────────────────────────────────

const ElementRenderer: React.FC<{
  element: CanvasElement
  selected: boolean
  onSelect: () => void
}> = ({ element, selected, onSelect }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect()
  }

  const selectionStroke = selected ? '#6366f1' : 'none'
  const selectionWidth = selected ? 0.15 : 0

  if (element.type === 'text') {
    const data = element.data as TextElementData
    // anchor based on align: 'left' → element.x is left edge; 'center' → element.x is center; etc.
    // Convention here: element.x is the CENTER X (matches demo template setup)
    const align = data.align ?? 'center'
    const textAnchor =
      align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle'

    return (
      <g onMouseDown={handleClick} style={{ cursor: 'pointer' }}>
        {selected && (
          <rect
            x={element.x - element.width / 2}
            y={element.y - element.height / 2}
            width={element.width}
            height={element.height}
            fill="none"
            stroke={selectionStroke}
            strokeWidth={selectionWidth}
            strokeDasharray="0.4 0.4"
          />
        )}
        <text
          x={element.x}
          y={element.y + data.fontSize * 0.35}
          textAnchor={textAnchor}
          fontFamily={data.fontFamily}
          fontSize={data.fontSize}
          fontWeight={data.fontWeight ?? 'normal'}
          fontStyle={data.fontStyle ?? 'normal'}
          fill={data.color}
          style={{ userSelect: 'none' }}
        >
          {data.text}
        </text>
      </g>
    )
  }

  if (element.type === 'image') {
    const data = element.data as ImageElementData
    return (
      <g onMouseDown={handleClick} style={{ cursor: 'pointer' }}>
        {data.src ? (
          <image
            href={data.src}
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            preserveAspectRatio={data.keepAspectRatio ? 'xMidYMid meet' : 'none'}
          />
        ) : (
          <g>
            <rect
              x={element.x}
              y={element.y}
              width={element.width}
              height={element.height}
              fill="rgba(255,255,255,0.4)"
              stroke="#666"
              strokeWidth={0.1}
              strokeDasharray="0.5 0.5"
            />
            <text
              x={element.x + element.width / 2}
              y={element.y + element.height / 2 + 1}
              textAnchor="middle"
              fontSize={2}
              fill="#666"
              style={{ userSelect: 'none' }}
            >
              LOGO
            </text>
          </g>
        )}
        {selected && (
          <rect
            x={element.x}
            y={element.y}
            width={element.width}
            height={element.height}
            fill="none"
            stroke={selectionStroke}
            strokeWidth={selectionWidth}
            strokeDasharray="0.4 0.4"
          />
        )}
      </g>
    )
  }

  if (element.type === 'shape') {
    const data = element.data as ShapeElementData
    if (data.shapeType === 'circle') {
      return (
        <g onMouseDown={handleClick} style={{ cursor: 'pointer' }}>
          <ellipse
            cx={element.x + element.width / 2}
            cy={element.y + element.height / 2}
            rx={element.width / 2}
            ry={element.height / 2}
            fill={data.fill ?? 'none'}
            stroke={selected ? selectionStroke : data.stroke ?? '#000'}
            strokeWidth={selected ? selectionWidth : data.strokeWidth ?? 0.1}
          />
        </g>
      )
    }
    return (
      <g onMouseDown={handleClick} style={{ cursor: 'pointer' }}>
        <rect
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          fill={data.fill ?? 'none'}
          stroke={selected ? selectionStroke : data.stroke ?? '#000'}
          strokeWidth={selected ? selectionWidth : data.strokeWidth ?? 0.1}
        />
      </g>
    )
  }

  return null
}
