import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  Project,
  Layer,
  CanvasElement,
  CanvasDocument,
  ViewportState,
  CursorPosition,
  SelectionState,
  ToolId,
  LayerType,
  ExportFormat,
  MachineId,
} from '@/types'

// ─── Template Field Types ─────────────────────────────────────────────────────

export interface TemplateField {
  id: string
  label: string
  type: 'text' | 'logo' | 'image'
  value: string | null
  layerId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11)
}

const BASE_ID = nanoid()
const CUT_ID = nanoid()
const ENGRAVE_ID = nanoid()
const TEXT_ID = nanoid()
const LOGO_ID = nanoid()

function makeDefaultCanvas(): CanvasDocument {
  return {
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    unit: 'px',
    dpi: 96,
    layers: [
      {
        id: BASE_ID,
        name: 'Base',
        type: 'base' as LayerType,
        machines: ['machine1' as MachineId],
        visible: true,
        locked: false,
        exportFormats: ['png', 'svg'] as ExportFormat[],
        elements: [],
        order: 0,
        color: '#555555',
      },
      {
        id: CUT_ID,
        name: 'Corte',
        type: 'cut' as LayerType,
        machines: ['machine1' as MachineId],
        visible: true,
        locked: false,
        exportFormats: ['svg', 'dxf'] as ExportFormat[],
        elements: [],
        order: 1,
        color: '#000000',
      },
      {
        id: ENGRAVE_ID,
        name: 'Gravação',
        type: 'engrave' as LayerType,
        machines: ['machine2' as MachineId],
        visible: true,
        locked: false,
        exportFormats: ['png'] as ExportFormat[],
        elements: [],
        order: 2,
        color: '#ef4444',
      },
      {
        id: TEXT_ID,
        name: 'Texto',
        type: 'text' as LayerType,
        machines: ['machine1' as MachineId, 'machine2' as MachineId],
        visible: true,
        locked: false,
        exportFormats: ['png', 'svg'] as ExportFormat[],
        elements: [],
        order: 3,
        color: '#8b5cf6',
      },
    ],
  }
}

function makeDefaultTemplateFields(): TemplateField[] {
  return [
    { id: 'tf1', label: 'Nome do cliente', type: 'text', value: 'João Silva', layerId: TEXT_ID },
    { id: 'tf2', label: 'Texto secundário', type: 'text', value: 'Presente especial', layerId: TEXT_ID },
    { id: 'tf3', label: 'Logo principal', type: 'logo', value: null, layerId: LOGO_ID },
  ]
}

function makeDefaultProject(): Project {
  return {
    id: nanoid(),
    name: 'Projeto Sem Nome',
    createdAt: new Date(),
    updatedAt: new Date(),
    canvas: makeDefaultCanvas(),
    isDirty: false,
  }
}

// ─── Store Types ──────────────────────────────────────────────────────────────

export interface ProjectStore {
  // Project
  project: Project
  setProjectName: (name: string) => void
  markDirty: () => void
  markSaved: () => void
  newProject: () => void

  // Template fields (quick-edit panel data)
  templateFields: TemplateField[]
  updateTemplateField: (id: string, value: string | null) => void

  // Viewport
  viewport: ViewportState
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  zoomFit: () => void
  setOffset: (x: number, y: number) => void

  // Cursor
  cursor: CursorPosition
  setCursor: (pos: CursorPosition) => void

  // Selection
  selection: SelectionState
  selectLayer: (layerId: string | null) => void
  selectElements: (ids: string[]) => void
  clearSelection: () => void

  // Tool
  activeTool: ToolId
  setTool: (tool: ToolId) => void

  // Layers
  addLayer: (name: string, type: LayerType) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  reorderLayer: (fromIndex: number, toIndex: number) => void

  // Elements
  addElement: (layerId: string, element: Omit<CanvasElement, 'id' | 'layerId'>) => void
  removeElement: (layerId: string, elementId: string) => void
  updateElement: (layerId: string, elementId: string, patch: Partial<CanvasElement>) => void

  // UI state
  leftSidebarCollapsed: boolean
  rightSidebarCollapsed: boolean
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector((set, get) => ({
    // ── Project ──
    project: makeDefaultProject(),

    setProjectName: (name) =>
      set((s) => ({ project: { ...s.project, name, isDirty: true } })),

    markDirty: () =>
      set((s) => ({ project: { ...s.project, isDirty: true } })),

    markSaved: () =>
      set((s) => ({
        project: { ...s.project, isDirty: false, updatedAt: new Date() },
      })),

    newProject: () =>
      set({
        project: makeDefaultProject(),
        templateFields: makeDefaultTemplateFields(),
        selection: { selectedLayerId: null, selectedElementIds: [] },
        viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
      }),

    // ── Template Fields ──
    templateFields: makeDefaultTemplateFields(),

    updateTemplateField: (id, value) =>
      set((s) => ({
        templateFields: s.templateFields.map((f) =>
          f.id === id ? { ...f, value } : f
        ),
        project: { ...s.project, isDirty: true },
      })),

    // ── Viewport ──
    viewport: { zoom: 1, offsetX: 0, offsetY: 0 },

    setZoom: (zoom) =>
      set((s) => ({
        viewport: { ...s.viewport, zoom: Math.max(0.05, Math.min(20, zoom)) },
      })),

    zoomIn: () => {
      const z = get().viewport.zoom
      const steps = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10, 12, 16, 20]
      const next = steps.find((s) => s > z) ?? 20
      set((st) => ({ viewport: { ...st.viewport, zoom: next } }))
    },

    zoomOut: () => {
      const z = get().viewport.zoom
      const steps = [0.05, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5, 8, 10, 12, 16, 20]
      const prev = [...steps].reverse().find((s) => s < z) ?? 0.05
      set((st) => ({ viewport: { ...st.viewport, zoom: prev } }))
    },

    zoomReset: () =>
      set((s) => ({ viewport: { ...s.viewport, zoom: 1 } })),

    zoomFit: () =>
      set((s) => ({ viewport: { ...s.viewport, zoom: 1, offsetX: 0, offsetY: 0 } })),

    setOffset: (x, y) =>
      set((s) => ({ viewport: { ...s.viewport, offsetX: x, offsetY: y } })),

    // ── Cursor ──
    cursor: { x: 0, y: 0, canvasX: 0, canvasY: 0 },
    setCursor: (pos) => set({ cursor: pos }),

    // ── Selection ──
    selection: { selectedLayerId: null, selectedElementIds: [] },

    selectLayer: (layerId) =>
      set((s) => ({
        selection: { ...s.selection, selectedLayerId: layerId },
      })),

    selectElements: (ids) =>
      set((s) => ({
        selection: { ...s.selection, selectedElementIds: ids },
      })),

    clearSelection: () =>
      set({ selection: { selectedLayerId: null, selectedElementIds: [] } }),

    // ── Tool ──
    activeTool: 'select',
    setTool: (tool) => set({ activeTool: tool }),

    // ── Layers ──
    addLayer: (name, type) => {
      const id = nanoid()
      const layers = get().project.canvas.layers
      const newLayer: Layer = {
        id,
        name,
        type,
        machines: ['machine1'],
        visible: true,
        locked: false,
        exportFormats: ['png', 'svg'],
        elements: [],
        order: layers.length,
      }
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: [...s.project.canvas.layers, newLayer],
          },
        },
      }))
    },

    removeLayer: (id) =>
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: s.project.canvas.layers.filter((l) => l.id !== id),
          },
        },
      })),

    updateLayer: (id, patch) =>
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: s.project.canvas.layers.map((l) =>
              l.id === id ? { ...l, ...patch } : l
            ),
          },
        },
      })),

    toggleLayerVisibility: (id) => {
      const layer = get().project.canvas.layers.find((l) => l.id === id)
      if (layer) get().updateLayer(id, { visible: !layer.visible })
    },

    toggleLayerLock: (id) => {
      const layer = get().project.canvas.layers.find((l) => l.id === id)
      if (layer) get().updateLayer(id, { locked: !layer.locked })
    },

    reorderLayer: (fromIndex, toIndex) =>
      set((s) => {
        const layers = [...s.project.canvas.layers]
        const [moved] = layers.splice(fromIndex, 1)
        layers.splice(toIndex, 0, moved)
        return {
          project: {
            ...s.project,
            isDirty: true,
            canvas: {
              ...s.project.canvas,
              layers: layers.map((l, i) => ({ ...l, order: i })),
            },
          },
        }
      }),

    // ── Elements ──
    addElement: (layerId, element) => {
      const id = nanoid()
      const newEl: CanvasElement = { ...element, id, layerId } as CanvasElement
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: s.project.canvas.layers.map((l) =>
              l.id === layerId
                ? { ...l, elements: [...l.elements, newEl] }
                : l
            ),
          },
        },
      }))
    },

    removeElement: (layerId, elementId) =>
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: s.project.canvas.layers.map((l) =>
              l.id === layerId
                ? { ...l, elements: l.elements.filter((e) => e.id !== elementId) }
                : l
            ),
          },
        },
      })),

    updateElement: (layerId, elementId, patch) =>
      set((s) => ({
        project: {
          ...s.project,
          isDirty: true,
          canvas: {
            ...s.project.canvas,
            layers: s.project.canvas.layers.map((l) =>
              l.id === layerId
                ? {
                    ...l,
                    elements: l.elements.map((e) =>
                      e.id === elementId ? { ...e, ...patch } : e
                    ),
                  }
                : l
            ),
          },
        },
      })),

    // ── UI ──
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
    toggleLeftSidebar: () =>
      set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
    toggleRightSidebar: () =>
      set((s) => ({ rightSidebarCollapsed: !s.rightSidebarCollapsed })),
  }))
)
