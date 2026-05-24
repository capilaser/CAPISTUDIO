import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Group } from 'react-konva'
import Konva from 'konva'
import { useProjectStore } from '@/store/useProjectStore'
import { MM_TO_PX } from '@/types'
import type {
  CanvasElement,
  TextElementData,
  ImageElementData,
  ShapeElementData,
} from '@/types'

interface StudioCanvasProps {
  width: number
  height: number
}

/**
 * Konva-based interactive canvas.
 * - Stage in pixel space; positions/sizes from store are in mm → multiplied by MM_TO_PX.
 * - Konva's own scale/translate handle zoom + pan (viewport.zoom and viewport.panX/Y).
 * - Click element → select + Transformer. Drag/resize updates store (back in mm).
 * - Wheel + Ctrl: zoom around cursor. Middle mouse / Space+drag: pan.
 */
export const StudioCanvas: React.FC<StudioCanvasProps> = ({ width, height }) => {
  const project = useProjectStore((s) => s.currentProject)
  const viewport = useProjectStore((s) => s.viewport)
  const selection = useProjectStore((s) => s.selection)
  const selectElement = useProjectStore((s) => s.selectElement)
  const updateElement = useProjectStore((s) => s.updateElement)
  const setZoom = useProjectStore((s) => s.setZoom)
  const setPan = useProjectStore((s) => s.setPan)
  const activeTool = useProjectStore((s) => s.activeTool)

  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)

  // track Space key for pan
  const [spaceHeld, setSpaceHeld] = useState(false)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spaceHeld) setSpaceHeld(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [spaceHeld])

  // attach Transformer to selected node
  useEffect(() => {
    const transformer = transformerRef.current
    const stage = stageRef.current
    if (!transformer || !stage) return
    if (selection.elementId) {
      const node = stage.findOne(`#${selection.elementId}`)
      if (node) {
        transformer.nodes([node])
      } else {
        transformer.nodes([])
      }
    } else {
      transformer.nodes([])
    }
    transformer.getLayer()?.batchDraw()
  }, [selection.elementId, project])

  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#252525] text-studio-muted text-xs">
        Nenhum projeto aberto.
      </div>
    )
  }

  const { document: doc } = project
  const scale = MM_TO_PX // base mm→px (Konva handles zoom via stage scale)
  const artW = doc.widthMm * scale
  const artH = doc.heightMm * scale

  // Center the artboard initially (if pan is 0 we still center)
  // We compute an effective stage position that centers artboard then applies user pan.
  const centerX = (width - artW * viewport.zoom) / 2
  const centerY = (height - artH * viewport.zoom) / 2
  const stageX = centerX + viewport.panX
  const stageY = centerY + viewport.panY

  // sort layers + visibility set
  const layers = [...doc.layers].sort((a, b) => a.order - b.order)
  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    [layers],
  )

  // ordered render list (layer order, then doc order)
  const renderList: CanvasElement[] = []
  for (const layer of layers) {
    if (!visibleLayerIds.has(layer.id)) continue
    for (const el of doc.elements) {
      if (el.layerId === layer.id && el.visible) renderList.push(el)
    }
  }

  // ─── Event handlers ─────────────────────────────────────────

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    if (!e.evt.ctrlKey && !e.evt.metaKey) return
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    const scaleBy = 1.05
    const oldScale = viewport.zoom
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    // pointer position in artboard pixel coordinates
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clamped = Math.min(Math.max(newScale, 0.1), 40)

    // new desired stage position so the point under cursor stays fixed
    const newPosX = pointer.x - mousePointTo.x * clamped
    const newPosY = pointer.y - mousePointTo.y * clamped

    // setZoom + setPan (pan is offset from centered position)
    const newCenterX = (width - artW * clamped) / 2
    const newCenterY = (height - artH * clamped) / 2
    setZoom(clamped)
    setPan(newPosX - newCenterX, newPosY - newCenterY)
  }

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // clicking empty area (stage itself) clears selection — except when starting pan
    const isPanGesture =
      e.evt.button === 1 || spaceHeld || activeTool === 'pan'
    if (isPanGesture) {
      // let stage drag handle it
      return
    }
    if (e.target === e.target.getStage()) {
      selectElement(undefined)
    }
  }

  const handleStageDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (e.target !== e.target.getStage()) return
    const stage = e.target.getStage()!
    setPan(stage.x() - centerX, stage.y() - centerY)
  }

  const stageDraggable = spaceHeld || activeTool === 'pan'

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      x={stageX}
      y={stageY}
      scaleX={viewport.zoom}
      scaleY={viewport.zoom}
      draggable={stageDraggable}
      onWheel={handleWheel}
      onMouseDown={handleStageMouseDown}
      onDragEnd={handleStageDragEnd}
      style={{
        background: '#252525',
        cursor: stageDraggable ? 'grab' : 'default',
      }}
    >
      {/* Background layer (dark stage bg + artboard) */}
      <Layer listening={false}>
        {/* Stage-wide dark bg — drawn in artboard coords; large rect covers visible area */}
        {/* We draw it in stage-space using negative offsets relative to stage position */}
        <Rect
          x={-stageX / viewport.zoom}
          y={-stageY / viewport.zoom}
          width={width / viewport.zoom}
          height={height / viewport.zoom}
          fill="#252525"
        />
        {/* Artboard */}
        <Rect
          x={0}
          y={0}
          width={artW}
          height={artH}
          fill={doc.backgroundColor}
          shadowColor="#000"
          shadowBlur={20 / viewport.zoom}
          shadowOpacity={0.4}
          shadowOffsetY={8 / viewport.zoom}
          cornerRadius={2 / viewport.zoom}
        />
      </Layer>

      {/* Elements layer */}
      <Layer>
        {renderList.map((el) => (
          <ElementNode
            key={el.id}
            element={el}
            zoom={viewport.zoom}
            onSelect={() => selectElement(el.id)}
            onChange={(changes) => updateElement(el.id, changes)}
          />
        ))}
      </Layer>

      {/* Transformer layer */}
      <Layer>
        <Transformer
          ref={transformerRef}
          rotateEnabled={false}
          borderStroke="#6366f1"
          borderStrokeWidth={1.5 / viewport.zoom}
          anchorStroke="#6366f1"
          anchorFill="#ffffff"
          anchorSize={8 / viewport.zoom}
          anchorStrokeWidth={1 / viewport.zoom}
          ignoreStroke
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 2 || newBox.height < 2) return oldBox
            return newBox
          }}
        />
      </Layer>
    </Stage>
  )
}

// ─────────────────────────────────────────────────────────────
// ElementNode — renders a single CanvasElement
// ─────────────────────────────────────────────────────────────

interface ElementNodeProps {
  element: CanvasElement
  zoom: number
  onSelect: () => void
  onChange: (changes: Partial<CanvasElement>) => void
}

const ElementNode: React.FC<ElementNodeProps> = ({ element, zoom, onSelect, onChange }) => {
  // Convert mm → px (zoom is applied by Stage scale)
  const x = element.x * MM_TO_PX
  const y = element.y * MM_TO_PX
  const w = element.width * MM_TO_PX
  const h = element.height * MM_TO_PX

  const commonProps = {
    id: element.id,
    draggable: !element.locked,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
      onSelect()
    },
    onTap: () => onSelect(),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      // node coords are in mm * MM_TO_PX (Stage handles zoom)
      const newXmm = node.x() / MM_TO_PX
      const newYmm = node.y() / MM_TO_PX
      // For text: x() is left edge of the Text node, but we treated element.x as center.
      // Compensate using the offset we set on the text node.
      onChange({ x: newXmm, y: newYmm })
    },
  }

  if (element.type === 'text') {
    const data = element.data as TextElementData
    const fontPx = data.fontSize * MM_TO_PX
    const align = data.align ?? 'center'

    // Konva.Text positioning: we want element.x to be the CENTER X.
    // Achieve via Group at element.x/y with offset = w/2, h/2 so transform origin = center.
    const handleTextTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
      const node = e.target as Konva.Text
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)
      const newW = Math.max(2, node.width() * scaleX)
      const newH = Math.max(2, node.height() * scaleY)
      onChange({
        x: node.x() / MM_TO_PX,
        y: node.y() / MM_TO_PX,
        width: newW / MM_TO_PX,
        height: newH / MM_TO_PX,
      })
    }

    return (
      <Text
        {...commonProps}
        x={x}
        y={y}
        width={w}
        height={h}
        offsetX={w / 2}
        offsetY={h / 2}
        text={data.text}
        fontFamily={data.fontFamily}
        fontSize={fontPx}
        fontStyle={
          data.fontWeight === 'bold' && data.fontStyle === 'italic'
            ? 'bold italic'
            : data.fontWeight === 'bold'
            ? 'bold'
            : data.fontStyle === 'italic'
            ? 'italic'
            : 'normal'
        }
        align={align}
        verticalAlign="middle"
        fill={data.color}
        rotation={element.rotation}
        onTransformEnd={handleTextTransformEnd}
        onDragEnd={(e) => {
          const node = e.target
          onChange({
            x: node.x() / MM_TO_PX,
            y: node.y() / MM_TO_PX,
          })
        }}
      />
    )
  }

  if (element.type === 'image') {
    const data = element.data as ImageElementData

    if (data.src) {
      return (
        <UrlImage
          src={data.src}
          element={element}
          zoom={zoom}
          onSelect={onSelect}
          onChange={onChange}
        />
      )
    }

    // Placeholder for empty image (logo)
    return (
      <Group
        id={element.id}
        x={x}
        y={y}
        rotation={element.rotation}
        draggable={!element.locked}
        onMouseDown={(e: Konva.KonvaEventObject<MouseEvent>) => {
          e.cancelBubble = true
          onSelect()
        }}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            x: e.target.x() / MM_TO_PX,
            y: e.target.y() / MM_TO_PX,
          })
        }}
        onTransformEnd={(e) => {
          const node = e.target
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange({
            x: node.x() / MM_TO_PX,
            y: node.y() / MM_TO_PX,
            width: Math.max(2, w * scaleX) / MM_TO_PX,
            height: Math.max(2, h * scaleY) / MM_TO_PX,
          })
        }}
      >
        <Rect
          width={w}
          height={h}
          fill="#333333"
          stroke="#555555"
          strokeWidth={1 / zoom}
          dash={[4 / zoom, 4 / zoom]}
        />
        <Text
          width={w}
          height={h}
          text="Logo"
          fontSize={Math.max(8, w * 0.18)}
          fontFamily="Arial"
          fill="#888888"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </Group>
    )
  }

  if (element.type === 'shape') {
    const data = element.data as ShapeElementData
    return (
      <Rect
        {...commonProps}
        x={x}
        y={y}
        width={w}
        height={h}
        rotation={element.rotation}
        fill={data.fill ?? 'transparent'}
        stroke={data.stroke ?? '#000'}
        strokeWidth={(data.strokeWidth ?? 0.1) * MM_TO_PX}
        onTransformEnd={(e) => {
          const node = e.target
          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          node.scaleX(1)
          node.scaleY(1)
          onChange({
            x: node.x() / MM_TO_PX,
            y: node.y() / MM_TO_PX,
            width: Math.max(2, node.width() * scaleX) / MM_TO_PX,
            height: Math.max(2, node.height() * scaleY) / MM_TO_PX,
          })
        }}
      />
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// UrlImage — loads HTMLImageElement asynchronously
// ─────────────────────────────────────────────────────────────

const UrlImage: React.FC<{
  src: string
  element: CanvasElement
  zoom: number
  onSelect: () => void
  onChange: (changes: Partial<CanvasElement>) => void
}> = ({ src, element, onSelect, onChange }) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImg(null)
      return
    }
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.src = src
    image.onload = () => setImg(image)
    image.onerror = () => setImg(null)
  }, [src])

  const x = element.x * MM_TO_PX
  const y = element.y * MM_TO_PX
  const w = element.width * MM_TO_PX
  const h = element.height * MM_TO_PX

  if (!img) return null

  return (
    <KonvaImage
      id={element.id}
      image={img}
      x={x}
      y={y}
      width={w}
      height={h}
      rotation={element.rotation}
      draggable={!element.locked}
      onMouseDown={(e) => {
        e.cancelBubble = true
        onSelect()
      }}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          x: e.target.x() / MM_TO_PX,
          y: e.target.y() / MM_TO_PX,
        })
      }}
      onTransformEnd={(e) => {
        const node = e.target
        const scaleX = node.scaleX()
        const scaleY = node.scaleY()
        node.scaleX(1)
        node.scaleY(1)
        onChange({
          x: node.x() / MM_TO_PX,
          y: node.y() / MM_TO_PX,
          width: Math.max(2, node.width() * scaleX) / MM_TO_PX,
          height: Math.max(2, node.height() * scaleY) / MM_TO_PX,
        })
      }}
    />
  )
}
