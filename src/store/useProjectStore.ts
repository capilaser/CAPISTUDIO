import { create } from 'zustand'
import {
  ProductTemplate,
  ArtProject,
  Layer,
  LayerType,
  CanvasElement,
  TextElementData,
  ImageElementData,
  FilledSlot,
  ViewportState,
  SelectionState,
  ToolId,
  EditableSlot,
} from '@/types'

// ─────────────────────────────────────────────────────────────
// DEMO TEMPLATE — Broche Magnético Dourado
// ─────────────────────────────────────────────────────────────

const now = () => new Date().toISOString()

const demoBrocheTemplate: ProductTemplate = {
  id: 'tpl_broche_dourado',
  name: 'Broche Magnético Dourado',
  slug: 'broche-magnetico-dourado',
  category: 'Brochos',
  description: 'Broche dourado 70×25mm para identificação profissional',
  realWidthMm: 70,
  realHeightMm: 25,
  unit: 'mm',
  document: {
    id: 'doc_broche',
    widthMm: 70,
    heightMm: 25,
    unit: 'mm',
    backgroundColor: '#D4AF37',
    layers: [
      {
        id: 'l_mockup',
        name: 'Mockup Dourado',
        type: 'mockup',
        order: 0,
        visible: true,
        locked: true,
        operationalColor: '#D4AF37',
        machines: ['machine_1'],
        export: { png: true, svg: false, dxf: false },
        tags: ['aprovacao'],
      },
      {
        id: 'l_cut',
        name: 'Corte',
        type: 'cut',
        order: 1,
        visible: true,
        locked: false,
        operationalColor: '#000000',
        machines: ['machine_1'],
        export: { png: false, svg: true, dxf: true },
        tags: ['producao'],
      },
      {
        id: 'l_engrave',
        name: 'Gravação',
        type: 'engrave',
        order: 2,
        visible: true,
        locked: false,
        operationalColor: '#ff0000',
        machines: ['machine_1', 'machine_2'],
        export: { png: true, svg: true, dxf: true },
        tags: ['producao'],
      },
      {
        id: 'l_logo',
        name: 'Logo',
        type: 'logo',
        order: 3,
        visible: true,
        locked: false,
        operationalColor: '#ff0000',
        machines: ['machine_1'],
        export: { png: true, svg: true, dxf: true },
        tags: ['producao'],
      },
    ],
    elements: [
      {
        id: 'el_nome',
        layerId: 'l_engrave',
        slotId: 'slot_nome',
        type: 'text',
        name: 'Nome do Cliente',
        x: 35,
        y: 8,
        width: 50,
        height: 8,
        rotation: 0,
        visible: true,
        locked: false,
        data: {
          text: 'NOME DO CLIENTE',
          fontFamily: 'Arial',
          fontSize: 8,
          fontWeight: 'bold',
          align: 'center',
          color: '#000000',
        },
      },
      {
        id: 'el_cargo',
        layerId: 'l_engrave',
        slotId: 'slot_cargo',
        type: 'text',
        name: 'Cargo',
        x: 35,
        y: 17,
        width: 50,
        height: 5,
        rotation: 0,
        visible: true,
        locked: false,
        data: {
          text: 'Cargo / Especialidade',
          fontFamily: 'Arial',
          fontSize: 5,
          align: 'center',
          color: '#333333',
        },
      },
      {
        id: 'el_logo',
        layerId: 'l_logo',
        slotId: 'slot_logo',
        type: 'image',
        name: 'Logo',
        x: 5,
        y: 5,
        width: 15,
        height: 15,
        rotation: 0,
        visible: true,
        locked: false,
        data: { src: '', keepAspectRatio: true },
      },
    ],
  },
  slots: [
    {
      id: 'slot_nome',
      templateId: 'tpl_broche_dourado',
      name: 'slot_nome',
      label: 'Nome do cliente',
      kind: 'text',
      x: 35,
      y: 8,
      width: 50,
      height: 8,
      rotation: 0,
      layerId: 'l_engrave',
      required: true,
      defaultValue: 'NOME DO CLIENTE',
      defaultFontFamily: 'Arial',
      defaultFontSize: 8,
      constraints: { maxLines: 1, autoFit: true, align: 'center' },
    },
    {
      id: 'slot_cargo',
      templateId: 'tpl_broche_dourado',
      name: 'slot_cargo',
      label: 'Cargo / Especialidade',
      kind: 'text',
      x: 35,
      y: 17,
      width: 50,
      height: 5,
      rotation: 0,
      layerId: 'l_engrave',
      required: false,
      defaultValue: 'Cargo / Especialidade',
      defaultFontFamily: 'Arial',
      defaultFontSize: 5,
      constraints: { maxLines: 1, autoFit: true, align: 'center' },
    },
    {
      id: 'slot_logo',
      templateId: 'tpl_broche_dourado',
      name: 'slot_logo',
      label: 'Logo do cliente',
      kind: 'logo',
      x: 5,
      y: 5,
      width: 15,
      height: 15,
      rotation: 0,
      layerId: 'l_logo',
      required: false,
      constraints: { keepAspectRatio: true },
    },
  ],
  createdAt: now(),
  updatedAt: now(),
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

/** Deep clone a template's document so the project owns it */
function cloneDocument(tpl: ProductTemplate) {
  return JSON.parse(JSON.stringify(tpl.document)) as ProductTemplate['document']
}

function buildProjectFromTemplate(tpl: ProductTemplate): ArtProject {
  const doc = cloneDocument(tpl)
  const filledSlots: FilledSlot[] = tpl.slots.map((s) => ({
    slotId: s.id,
    value: s.kind === 'text' ? s.defaultValue ?? '' : undefined,
    assetPath: s.kind !== 'text' ? '' : undefined,
  }))

  return {
    id: uid('proj'),
    name: `Novo projeto — ${tpl.name}`,
    templateId: tpl.id,
    status: 'draft',
    document: doc,
    filledSlots,
    exportHistory: [],
    createdAt: now(),
    updatedAt: now(),
  }
}

// ─────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────

interface ProjectStoreState {
  // catalog
  templates: ProductTemplate[]
  selectedTemplateId: string | null

  // current project
  currentProject: ArtProject | null

  // UI
  viewport: ViewportState
  selection: SelectionState
  activeTool: ToolId

  // actions — projects/templates
  createProjectFromTemplate: (templateId: string) => void
  openProject: (project: ArtProject) => void
  updateProjectName: (name: string) => void

  // actions — slots
  fillSlot: (slotId: string, value?: string, assetPath?: string) => void
  getSlotValue: (slotId: string) => { value?: string; assetPath?: string } | undefined
  getSlotsForCurrent: () => EditableSlot[]

  // actions — selection
  selectElement: (id?: string) => void
  selectLayer: (id?: string) => void
  clearSelection: () => void

  // actions — elements
  updateElement: (id: string, changes: Partial<CanvasElement>) => void

  // actions — layers
  addLayer: (type: LayerType) => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  deleteLayer: (id: string) => void
  updateLayer: (id: string, changes: Partial<Layer>) => void

  // actions — viewport
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  zoomFit: () => void

  // actions — tool
  setTool: (tool: ToolId) => void
}

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  // bootstrap: auto-create a project from the demo template
  const initialProject = buildProjectFromTemplate(demoBrocheTemplate)

  return {
    templates: [demoBrocheTemplate],
    selectedTemplateId: demoBrocheTemplate.id,
    currentProject: initialProject,
    viewport: { zoom: 4, panX: 0, panY: 0 },
    selection: {},
    activeTool: 'select',

    createProjectFromTemplate: (templateId) => {
      const tpl = get().templates.find((t) => t.id === templateId)
      if (!tpl) return
      set({
        currentProject: buildProjectFromTemplate(tpl),
        selectedTemplateId: tpl.id,
        selection: {},
      })
    },

    openProject: (project) => set({ currentProject: project, selection: {} }),

    updateProjectName: (name) => {
      const p = get().currentProject
      if (!p) return
      set({ currentProject: { ...p, name, updatedAt: now() } })
    },

    fillSlot: (slotId, value, assetPath) => {
      const project = get().currentProject
      if (!project) return

      // update FilledSlot
      const filledSlots = project.filledSlots.map((fs) =>
        fs.slotId === slotId
          ? {
              ...fs,
              value: value !== undefined ? value : fs.value,
              assetPath: assetPath !== undefined ? assetPath : fs.assetPath,
            }
          : fs,
      )

      // update matching CanvasElement(s) in the document
      const elements = project.document.elements.map((el) => {
        if (el.slotId !== slotId) return el
        if (el.type === 'text' && value !== undefined) {
          const data = el.data as TextElementData
          return { ...el, data: { ...data, text: value } }
        }
        if (el.type === 'image' && assetPath !== undefined) {
          const data = el.data as ImageElementData
          return { ...el, data: { ...data, src: assetPath } }
        }
        return el
      })

      set({
        currentProject: {
          ...project,
          filledSlots,
          document: { ...project.document, elements },
          updatedAt: now(),
        },
      })
    },

    getSlotValue: (slotId) => {
      const p = get().currentProject
      if (!p) return undefined
      const fs = p.filledSlots.find((f) => f.slotId === slotId)
      return fs ? { value: fs.value, assetPath: fs.assetPath } : undefined
    },

    getSlotsForCurrent: () => {
      const p = get().currentProject
      if (!p?.templateId) return []
      const tpl = get().templates.find((t) => t.id === p.templateId)
      return tpl?.slots ?? []
    },

    selectElement: (id) => set({ selection: { ...get().selection, elementId: id } }),
    selectLayer: (id) => set({ selection: { ...get().selection, layerId: id } }),
    clearSelection: () => set({ selection: {} }),

    updateElement: (id, changes) => {
      const project = get().currentProject
      if (!project) return
      const elements = project.document.elements.map((el) =>
        el.id === id ? { ...el, ...changes } : el,
      )
      set({
        currentProject: {
          ...project,
          document: { ...project.document, elements },
          updatedAt: now(),
        },
      })
    },

    addLayer: (type) => {
      const project = get().currentProject
      if (!project) return
      const order = project.document.layers.length
      const newLayer: Layer = {
        id: uid('l'),
        name: `Camada ${order + 1}`,
        type,
        order,
        visible: true,
        locked: false,
        operationalColor: '#000000',
        machines: ['machine_1'],
        export: { png: true, svg: true, dxf: true },
        tags: [],
      }
      set({
        currentProject: {
          ...project,
          document: { ...project.document, layers: [...project.document.layers, newLayer] },
          updatedAt: now(),
        },
      })
    },

    toggleLayerVisibility: (id) => {
      const project = get().currentProject
      if (!project) return
      const layers = project.document.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l,
      )
      set({
        currentProject: {
          ...project,
          document: { ...project.document, layers },
          updatedAt: now(),
        },
      })
    },

    toggleLayerLock: (id) => {
      const project = get().currentProject
      if (!project) return
      const layers = project.document.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l,
      )
      set({
        currentProject: {
          ...project,
          document: { ...project.document, layers },
          updatedAt: now(),
        },
      })
    },

    deleteLayer: (id) => {
      const project = get().currentProject
      if (!project) return
      const layers = project.document.layers.filter((l) => l.id !== id)
      const elements = project.document.elements.filter((e) => e.layerId !== id)
      set({
        currentProject: {
          ...project,
          document: { ...project.document, layers, elements },
          updatedAt: now(),
        },
      })
    },

    updateLayer: (id, changes) => {
      const project = get().currentProject
      if (!project) return
      const layers = project.document.layers.map((l) =>
        l.id === id ? { ...l, ...changes } : l,
      )
      set({
        currentProject: {
          ...project,
          document: { ...project.document, layers },
          updatedAt: now(),
        },
      })
    },

    setZoom: (zoom) =>
      set({ viewport: { ...get().viewport, zoom: Math.max(0.1, Math.min(40, zoom)) } }),
    setPan: (panX, panY) => set({ viewport: { ...get().viewport, panX, panY } }),
    zoomIn: () => get().setZoom(get().viewport.zoom * 1.2),
    zoomOut: () => get().setZoom(get().viewport.zoom / 1.2),
    zoomReset: () => set({ viewport: { zoom: 4, panX: 0, panY: 0 } }),
    zoomFit: () => set({ viewport: { zoom: 4, panX: 0, panY: 0 } }),

    setTool: (tool) => set({ activeTool: tool }),
  }
})
