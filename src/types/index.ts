// ─── Layer Types ─────────────────────────────────────────────────────────────

export type LayerType =
  | 'base'
  | 'cut'
  | 'engrave'
  | 'mark'
  | 'text'
  | 'logo'
  | 'svg'
  | 'image'
  | 'mockup'
  | 'reference'
  | 'guide'
  | 'editable'
  | 'non-exportable'

export type MachineId = 'machine1' | 'machine2' | 'machine3'

export type ExportFormat = 'png' | 'svg' | 'dxf'

export type ToolId =
  | 'select'
  | 'move'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'pen'
  | 'image'
  | 'laser-cut'
  | 'laser-engrave'

// ─── Element Types ────────────────────────────────────────────────────────────

export type ElementType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'text'
  | 'image'
  | 'path'
  | 'group'

export interface Transform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
}

export interface FillStyle {
  type: 'solid' | 'none' | 'gradient' | 'pattern'
  color?: string
  opacity?: number
}

export interface StrokeStyle {
  color: string
  width: number
  opacity: number
  dashArray?: number[]
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
}

export interface CanvasElement {
  id: string
  type: ElementType
  name: string
  layerId: string
  transform: Transform
  fill: FillStyle
  stroke: StrokeStyle
  visible: boolean
  locked: boolean
  // type-specific props
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  src?: string        // for images
  points?: number[]   // for lines/polylines
  d?: string          // for paths (SVG path data)
  cornerRadius?: number
}

// ─── Layer ───────────────────────────────────────────────────────────────────

export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  base:            'Base',
  cut:             'Corte',
  engrave:         'Gravação',
  mark:            'Marcação',
  text:            'Texto',
  logo:            'Logo',
  svg:             'SVG',
  image:           'Imagem',
  mockup:          'Mockup',
  reference:       'Referência',
  guide:           'Guia',
  editable:        'Editável',
  'non-exportable': 'Não Exportável',
}

export const LAYER_TYPE_COLORS: Record<LayerType, string> = {
  base:            '#6366f1',
  cut:             '#ef4444',
  engrave:         '#f59e0b',
  mark:            '#8b5cf6',
  text:            '#3b82f6',
  logo:            '#10b981',
  svg:             '#06b6d4',
  image:           '#ec4899',
  mockup:          '#78716c',
  reference:       '#64748b',
  guide:           '#22c55e',
  editable:        '#f97316',
  'non-exportable': '#6b7280',
}

export interface Layer {
  id: string
  name: string
  type: LayerType
  machines: MachineId[]
  visible: boolean
  locked: boolean
  exportFormats: ExportFormat[]
  elements: CanvasElement[]
  order: number
  color?: string
}

// ─── Canvas Document ──────────────────────────────────────────────────────────

export interface CanvasDocument {
  width: number
  height: number
  backgroundColor: string
  unit: 'mm' | 'px' | 'in'
  dpi: number
  layers: Layer[]
}

// ─── Machine Config ───────────────────────────────────────────────────────────

export interface MachineConfig {
  id: MachineId
  name: string
  workAreaWidth: number   // mm
  workAreaHeight: number  // mm
  maxPower: number        // W
  maxSpeed: number        // mm/s
  laserType: 'co2' | 'fiber' | 'diode'
  color: string
}

export const DEFAULT_MACHINES: MachineConfig[] = [
  {
    id: 'machine1',
    name: 'CO2 60W',
    workAreaWidth: 400,
    workAreaHeight: 600,
    maxPower: 60,
    maxSpeed: 500,
    laserType: 'co2',
    color: '#6366f1',
  },
  {
    id: 'machine2',
    name: 'Fibra 20W',
    workAreaWidth: 110,
    workAreaHeight: 110,
    maxPower: 20,
    maxSpeed: 2000,
    laserType: 'fiber',
    color: '#f59e0b',
  },
  {
    id: 'machine3',
    name: 'Diodo 10W',
    workAreaWidth: 200,
    workAreaHeight: 300,
    maxPower: 10,
    maxSpeed: 300,
    laserType: 'diode',
    color: '#22c55e',
  },
]

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  canvas: CanvasDocument
  templateId?: string
  filePath?: string
  isDirty: boolean
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface ViewportState {
  zoom: number          // 0.1 to 10
  offsetX: number
  offsetY: number
}

export interface CursorPosition {
  x: number
  y: number
  canvasX: number
  canvasY: number
}

export interface SelectionState {
  selectedLayerId: string | null
  selectedElementIds: string[]
}
