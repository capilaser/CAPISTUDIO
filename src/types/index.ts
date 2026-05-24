/**
 * Capi Studio — Core Types
 *
 * Hierarchy:
 *   ProductTemplate → EditableSlot   (definition)
 *           ↓
 *       ArtProject → FilledSlot      (instance for a client)
 *           ↓
 *       CanvasDocument → Layer + CanvasElement  (visual)
 */

// ─────────────────────────────────────────────────────────────
// LAYERS
// ─────────────────────────────────────────────────────────────

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
  | 'editable_area'
  | 'replacement_area'
  | 'non_exportable'

export type MachineId = 'machine_1' | 'machine_2' | 'machine_3'

export type ExportFormat = 'png' | 'svg' | 'dxf'

export interface LayerExportConfig {
  png: boolean
  svg: boolean
  dxf: boolean
}

export interface Layer {
  id: string
  name: string
  type: LayerType
  order: number
  visible: boolean
  locked: boolean
  /** Operational color used for laser machine: '#000000' cut, '#ff0000' engrave, '#0000ff' mark */
  operationalColor: string
  machines: MachineId[]
  export: LayerExportConfig
  tags: string[]
}

/** Short labels for layer-type badges */
export const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  base: 'BAS',
  cut: 'CUT',
  engrave: 'ENG',
  mark: 'MRK',
  text: 'TXT',
  logo: 'LOG',
  svg: 'SVG',
  image: 'IMG',
  mockup: 'MOC',
  reference: 'REF',
  guide: 'GDE',
  editable_area: 'EDT',
  replacement_area: 'RPL',
  non_exportable: 'NEX',
}

export const LAYER_TYPE_COLORS: Record<LayerType, string> = {
  base: '#888888',
  cut: '#000000',
  engrave: '#ef4444',
  mark: '#3b82f6',
  text: '#a855f7',
  logo: '#f59e0b',
  svg: '#22c55e',
  image: '#06b6d4',
  mockup: '#D4AF37',
  reference: '#64748b',
  guide: '#64748b',
  editable_area: '#22c55e',
  replacement_area: '#f59e0b',
  non_exportable: '#475569',
}

// ─────────────────────────────────────────────────────────────
// EDITABLE SLOTS (template definition)
// ─────────────────────────────────────────────────────────────

export type SlotKind = 'text' | 'logo' | 'svg' | 'image'

export interface SlotConstraints {
  maxLines?: number
  autoFit?: boolean
  keepAspectRatio?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface EditableSlot {
  id: string
  templateId: string
  /** internal name e.g. 'slot_nome' */
  name: string
  /** display label e.g. 'Nome do cliente' */
  label: string
  kind: SlotKind
  x: number
  y: number
  width: number
  height: number
  rotation: number
  layerId: string
  required: boolean
  defaultValue?: string
  defaultFontFamily?: string
  defaultFontSize?: number
  constraints: SlotConstraints
}

// ─────────────────────────────────────────────────────────────
// CANVAS ELEMENTS (rendered instances)
// ─────────────────────────────────────────────────────────────

export type ElementType = 'text' | 'path' | 'svg' | 'image' | 'shape'

export interface TextElementData {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight?: string
  fontStyle?: string
  align: 'left' | 'center' | 'right'
  color: string
  lineHeight?: number
}

export interface ImageElementData {
  src: string
  originalPath?: string
  keepAspectRatio: boolean
}

export interface ShapeElementData {
  shapeType: 'rect' | 'circle' | 'line'
  fill?: string
  stroke?: string
  strokeWidth?: number
}

export type ElementData = TextElementData | ImageElementData | ShapeElementData

export interface CanvasElement {
  id: string
  layerId: string
  /** if rendered from a template slot, link to it so fills can update */
  slotId?: string
  type: ElementType
  name?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
  locked: boolean
  data: ElementData
}

// ─────────────────────────────────────────────────────────────
// CANVAS DOCUMENT
// ─────────────────────────────────────────────────────────────

export interface CanvasDocument {
  id: string
  widthMm: number
  heightMm: number
  unit: 'mm'
  backgroundColor: string
  layers: Layer[]
  elements: CanvasElement[]
}

// ─────────────────────────────────────────────────────────────
// PRODUCT TEMPLATE
// ─────────────────────────────────────────────────────────────

export interface ProductTemplate {
  id: string
  name: string
  slug: string
  category: string
  description?: string
  thumbnail?: string
  realWidthMm: number
  realHeightMm: number
  unit: 'mm'
  document: CanvasDocument
  slots: EditableSlot[]
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// ART PROJECT (instance per client/order)
// ─────────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'draft'
  | 'approval_pending'
  | 'approved'
  | 'production_ready'
  | 'archived'

export interface SlotOverrides {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  fontSize?: number
}

export interface FilledSlot {
  slotId: string
  /** for text slots */
  value?: string
  /** for logo/image/svg slots */
  assetPath?: string
  overrides?: SlotOverrides
}

export interface ExportRecord {
  id: string
  format: ExportFormat
  filePath: string
  createdAt: string
}

export interface ArtProject {
  id: string
  name: string
  templateId?: string
  status: ProjectStatus
  document: CanvasDocument
  filledSlots: FilledSlot[]
  exportHistory: ExportRecord[]
  folderPath?: string
  createdAt: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// UI STATE
// ─────────────────────────────────────────────────────────────

export type ToolId = 'select' | 'text' | 'image' | 'pan'

export interface ViewportState {
  zoom: number
  panX: number
  panY: number
}

export interface SelectionState {
  elementId?: string
  layerId?: string
}

/** Standard mm → px conversion at 96dpi */
export const MM_TO_PX = 3.7795275591
