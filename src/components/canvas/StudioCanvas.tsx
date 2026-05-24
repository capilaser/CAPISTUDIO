import React, { useRef, useEffect } from 'react'
import { useProjectStore } from '@/store/useProjectStore'

// Konva will be imported here when we implement the canvas in Entrega 2.
// For now we render a placeholder that shows canvas dimensions and layers count.

interface StudioCanvasProps {
  width: number
  height: number
}

export function StudioCanvas({ width, height }: StudioCanvasProps) {
  const { project, selection } = useProjectStore()
  const { canvas } = project

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ width, height }}
    >
      {/* Artboard shadow */}
      <div
        className="absolute rounded-sm"
        style={{
          width: canvas.width + 8,
          height: canvas.height + 8,
          backgroundColor: 'rgba(0,0,0,0.4)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translate(3px, 4px)',
          filter: 'blur(6px)',
        }}
      />

      {/* Artboard */}
      <div
        className="absolute bg-studio-artboard rounded-sm overflow-hidden"
        style={{
          width: canvas.width,
          height: canvas.height,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Empty canvas state */}
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 select-none">
          <div className="flex flex-col items-center gap-2 opacity-30">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="8" stroke="#6366f1" strokeWidth="2" />
              <path d="M24 4 L24 12 M24 36 L24 44 M4 24 L12 24 M36 24 L44 24"
                    stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 10 L16 16 M32 32 L38 38 M10 38 L16 32 M32 16 L38 10"
                    stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium text-gray-400 tracking-wide">
              Canvas vazio
            </span>
            <span className="text-xs text-gray-500">
              Use as ferramentas para adicionar elementos
            </span>
          </div>
        </div>
      </div>

      {/* Artboard dimension label */}
      <div
        className="absolute text-studio-faint text-2xs font-mono select-none pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: `translate(-50%, ${canvas.height / 2 + 10}px)`,
          marginTop: '-50%',
          whiteSpace: 'nowrap',
        }}
      >
        <ArtboardLabel
          width={canvas.width}
          height={canvas.height}
          canvasY={canvas.height / 2}
        />
      </div>
    </div>
  )
}

function ArtboardLabel({
  width,
  height,
  canvasY,
}: {
  width: number
  height: number
  canvasY: number
}) {
  return (
    <div
      className="absolute text-studio-faint text-2xs font-mono select-none pointer-events-none"
      style={{
        top: `calc(50% + ${canvasY}px + 8px)`,
        left: '50%',
        transform: 'translateX(-50%)',
        whiteSpace: 'nowrap',
      }}
    >
      {width} × {height} px
    </div>
  )
}
