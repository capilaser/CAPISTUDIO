import React, { useRef, useCallback, useEffect, useState } from 'react'
import { useProjectStore } from '@/store/useProjectStore'

// Dot grid background SVG pattern
const GRID_DOT_SIZE = 1
const GRID_SPACING = 20

function GridBackground({ zoom }: { zoom: number }) {
  const spacing = GRID_SPACING * zoom
  const dotSize = Math.max(0.5, GRID_DOT_SIZE * zoom)

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: zoom < 0.3 ? 0 : Math.min(1, (zoom - 0.3) / 0.3) }}
    >
      <defs>
        <pattern
          id="dot-grid"
          x="0"
          y="0"
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={spacing / 2} cy={spacing / 2} r={dotSize} fill="#3a3a3a" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-grid)" />
    </svg>
  )
}

// Ruler tick marks
function Ruler({ axis, size, zoom, offset }: {
  axis: 'x' | 'y'
  size: number
  zoom: number
  offset: number
}) {
  const RULER_SIZE = 20
  const ticks: React.ReactNode[] = []

  const step = zoom >= 2 ? 50 : zoom >= 0.5 ? 100 : 200
  const scaledStep = step * zoom
  const start = Math.floor(-offset / scaledStep) * scaledStep - scaledStep
  const end = size + scaledStep

  for (let pos = start; pos < end; pos += scaledStep) {
    const value = Math.round((pos - offset) / zoom)
    const isLarge = value % (step * 5) === 0

    if (axis === 'x') {
      ticks.push(
        <g key={pos}>
          <line
            x1={pos + offset} y1={RULER_SIZE - (isLarge ? 8 : 4)}
            x2={pos + offset} y2={RULER_SIZE}
            stroke="#444" strokeWidth="1"
          />
          {isLarge && (
            <text
              x={pos + offset + 2}
              y={RULER_SIZE - 9}
              fill="#555"
              fontSize="9"
              fontFamily="monospace"
            >
              {value}
            </text>
          )}
        </g>
      )
    } else {
      ticks.push(
        <g key={pos}>
          <line
            x1={RULER_SIZE - (isLarge ? 8 : 4)} y1={pos + offset}
            x2={RULER_SIZE} y2={pos + offset}
            stroke="#444" strokeWidth="1"
          />
          {isLarge && (
            <text
              x={2}
              y={pos + offset - 2}
              fill="#555"
              fontSize="9"
              fontFamily="monospace"
              writingMode="vertical-rl"
            >
              {value}
            </text>
          )}
        </g>
      )
    }
  }

  if (axis === 'x') {
    return (
      <svg
        className="absolute top-0 left-5 pointer-events-none z-10"
        style={{ width: size, height: RULER_SIZE }}
      >
        <rect width={size} height={RULER_SIZE} fill="#1e1e1e" />
        <line x1="0" y1={RULER_SIZE - 1} x2={size} y2={RULER_SIZE - 1} stroke="#333" strokeWidth="1" />
        {ticks}
      </svg>
    )
  }

  return (
    <svg
      className="absolute top-5 left-0 pointer-events-none z-10"
      style={{ width: RULER_SIZE, height: size }}
    >
      <rect width={RULER_SIZE} height={size} fill="#1e1e1e" />
      <line x1={RULER_SIZE - 1} y1="0" x2={RULER_SIZE - 1} y2={size} stroke="#333" strokeWidth="1" />
      {ticks}
    </svg>
  )
}

export function CanvasArea() {
  const {
    project,
    viewport,
    setCursor,
    setZoom,
    setOffset,
    clearSelection,
  } = useProjectStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 })
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })

  const { canvas } = project
  const { zoom, offsetX, offsetY } = viewport

  // Compute centered offset when zoom changes
  const centerCanvas = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const cx = (rect.width - canvas.width * zoom) / 2
    const cy = (rect.height - canvas.height * zoom) / 2
    setOffset(cx, cy)
  }, [canvas.width, canvas.height, zoom, setOffset])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Center canvas on first load
  useEffect(() => {
    centerCanvas()
  }, [containerSize]) // eslint-disable-line

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current!.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom or ctrl+wheel
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.05, Math.min(20, zoom * delta))

      // Zoom towards cursor
      const newOffsetX = mouseX - (mouseX - offsetX) * (newZoom / zoom)
      const newOffsetY = mouseY - (mouseY - offsetY) * (newZoom / zoom)

      setZoom(newZoom)
      setOffset(newOffsetX, newOffsetY)
    } else {
      // Pan
      setOffset(offsetX - e.deltaX, offsetY - e.deltaY)
    }
  }, [zoom, offsetX, offsetY, setZoom, setOffset])

  // Pan with middle mouse / space+drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY })
    }
  }, [offsetX, offsetY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const canvasX = (px - offsetX) / zoom
    const canvasY = (py - offsetY) / zoom

    setCursor({ x: px, y: py, canvasX, canvasY })

    if (isPanning) {
      setOffset(
        panStart.ox + (e.clientX - panStart.x),
        panStart.oy + (e.clientY - panStart.y)
      )
    }
  }, [isPanning, panStart, zoom, offsetX, offsetY, setCursor, setOffset])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-studio-canvas overflow-hidden"
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        if (e.target === containerRef.current) clearSelection()
      }}
    >
      {/* Dot grid */}
      <GridBackground zoom={zoom} />

      {/* Rulers */}
      <Ruler axis="x" size={containerSize.w} zoom={zoom} offset={offsetX} />
      <Ruler axis="y" size={containerSize.h} zoom={zoom} offset={offsetY} />

      {/* Corner square where rulers meet */}
      <div className="absolute top-0 left-0 w-5 h-5 bg-studio-sidebar border-b border-r border-studio-border z-20" />

      {/* Canvas viewport transform */}
      <div
        className="absolute"
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: canvas.width,
          height: canvas.height,
        }}
      >
        {/* Artboard background */}
        <div
          className="absolute inset-0 bg-white"
          style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}
        />

        {/* Artboard content (elements rendered here in Entrega 2) */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
          <div className="flex flex-col items-center gap-3" style={{ opacity: 0.2 }}>
            {/* Laser beam icon */}
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="9" stroke="#6366f1" strokeWidth="2.5" />
              <circle cx="26" cy="26" r="3" fill="#6366f1" />
              <path
                d="M26 5L26 14 M26 38L26 47 M5 26L14 26 M38 26L47 26"
                stroke="#6366f1" strokeWidth="2" strokeLinecap="round"
              />
              <path
                d="M11.5 11.5L17.5 17.5 M34.5 34.5L40.5 40.5 M11.5 40.5L17.5 34.5 M34.5 17.5L40.5 11.5"
                stroke="#6366f1" strokeWidth="1.75" strokeLinecap="round"
              />
            </svg>
            <p className="text-sm font-medium text-gray-400">Capi Studio</p>
            <p className="text-xs text-gray-500">Selecione uma ferramenta para começar</p>
          </div>
        </div>
      </div>

      {/* Artboard size label */}
      <div
        className="absolute pointer-events-none select-none text-studio-faint text-2xs font-mono"
        style={{
          left: offsetX,
          top: offsetY + canvas.height * zoom + 6,
          whiteSpace: 'nowrap',
        }}
      >
        {canvas.width} × {canvas.height} px
      </div>

      {/* Artboard top label */}
      <div
        className="absolute pointer-events-none select-none text-studio-faint text-2xs font-mono"
        style={{
          left: offsetX,
          top: offsetY - 18,
          whiteSpace: 'nowrap',
        }}
      >
        {project.name}
      </div>
    </div>
  )
}
