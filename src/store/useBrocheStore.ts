import { create } from 'zustand'
import { BrocheType, BrocheTemplate, TEMPLATES } from '@/data/brocheTemplates'

export type BrocheColor = 'dourado' | 'prata' | 'rose_gold'
export type LogoSource = 'upload' | 'banco' | 'nao'

export interface LogoElements {
  x: number; y: number; width: number; height: number
}
export interface TextElement {
  x: number; y: number; size: number
}

export interface BrocheState {
  type: BrocheType
  color: BrocheColor
  logoHref: string
  hasLogo: boolean
  logoSource: LogoSource
  activePatternId: string | null
  activeFilter: string

  elements: {
    logo: LogoElements
    name: TextElement
    profession: TextElement
  }

  nameText: string
  nameFont: string
  professionText: string
  professionFont: string

  showGuides: boolean
  lastSavedAt: string | null
  isSaved: boolean

  setType: (t: BrocheType) => void
  setColor: (c: BrocheColor) => void
  setLogoSource: (s: LogoSource) => void
  setLogo: (href: string) => void
  removeLogo: () => void
  adjustLogo: (delta: number) => void
  resetLogoSize: () => void

  setNameText: (v: string) => void
  setNameFont: (v: string) => void
  setProfessionText: (v: string) => void
  setProfessionFont: (v: string) => void

  adjustText: (key: 'name' | 'profession', delta: number) => void
  nudge: (key: 'logo' | 'name' | 'profession', dx: number, dy: number) => void
  centerElement: (key: 'logo' | 'name' | 'profession') => void
  alignProfToName: () => void

  applyPattern: (id: string) => void
  setFilter: (f: string) => void
  toggleGuides: () => void

  markSaved: (at: string) => void
}

const DEFAULT_ELEMENTS = {
  logo:       { x: 4.8,  y: 5.1,  width: 14,   height: 14   },
  name:       { x: 38.1, y: 12.5, size: 7.2  },
  profession: { x: 38.1, y: 16.5, size: 2.85 },
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

export const useBrocheStore = create<BrocheState>((set, get) => {
  const firstTemplate = TEMPLATES.find(t => t.types.includes('logo_nome'))!

  return {
    type: 'logo_nome',
    color: 'dourado',
    logoHref: '',
    hasLogo: false,
    logoSource: 'upload',
    activePatternId: firstTemplate.id,
    activeFilter: 'todos',
    elements: JSON.parse(JSON.stringify(DEFAULT_ELEMENTS)),
    nameText: 'Flavinha',
    nameFont: 'Arial',
    professionText: 'GERENTE ADMINISTRATIVA',
    professionFont: 'Arial',
    showGuides: false,
    lastSavedAt: null,
    isSaved: false,

    setType: (t) => {
      set({ type: t, activeFilter: 'todos' })
      const matches = TEMPLATES.filter(tpl => tpl.types.includes(t))
      if (matches.length) get().applyPattern(matches[0].id)
    },

    setColor: (c) => set({ color: c }),

    setLogoSource: (s) => {
      set({ logoSource: s })
      if (s === 'nao') set({ hasLogo: false, logoHref: '' })
    },

    setLogo: (href) => set({ logoHref: href, hasLogo: true }),
    removeLogo: () => set({ logoHref: '', hasLogo: false }),

    adjustLogo: (delta) => {
      const el = get().elements.logo
      const newW = clamp(el.width + delta, 3, 28)
      const newH = clamp(el.height + delta, 3, 28)
      set(s => ({
        elements: { ...s.elements, logo: { ...el, width: newW, height: newH } },
      }))
    },

    resetLogoSize: () => {
      set(s => ({
        elements: { ...s.elements, logo: { ...s.elements.logo, width: 14, height: 14 } },
      }))
    },

    setNameText: (v) => set({ nameText: v, isSaved: false }),
    setNameFont: (v) => set({ nameFont: v, isSaved: false }),
    setProfessionText: (v) => set({ professionText: v, isSaved: false }),
    setProfessionFont: (v) => set({ professionFont: v, isSaved: false }),

    adjustText: (key, delta) => {
      const el = get().elements[key]
      const newSize = parseFloat(clamp(el.size + delta, 1, 14).toFixed(2))
      set(s => ({
        elements: { ...s.elements, [key]: { ...el, size: newSize } },
      }))
    },

    nudge: (key, dx, dy) => {
      const el = get().elements[key]
      set(s => ({
        elements: {
          ...s.elements,
          [key]: {
            ...el,
            x: parseFloat((el.x + dx).toFixed(2)),
            y: parseFloat((el.y + dy).toFixed(2)),
          },
        },
      }))
    },

    centerElement: (key) => {
      const logo = get().elements.logo
      if (key === 'logo') {
        set(s => ({
          elements: {
            ...s.elements,
            logo: {
              ...s.elements.logo,
              x: parseFloat(((60 - logo.width)  / 2).toFixed(2)),
              y: parseFloat(((25 - logo.height) / 2).toFixed(2)),
            },
          },
        }))
      } else {
        const y = key === 'profession' ? 16.5 : 12.5
        set(s => ({
          elements: { ...s.elements, [key]: { ...(s.elements[key] as TextElement), x: 30, y } },
        }))
      }
    },

    alignProfToName: () => {
      const nx = get().elements.name.x
      set(s => ({
        elements: {
          ...s.elements,
          profession: { ...s.elements.profession, x: nx },
        },
      }))
    },

    applyPattern: (id: string) => {
      const tpl: BrocheTemplate | undefined = TEMPLATES.find(t => t.id === id)
      if (!tpl) return
      const l = tpl.layout
      const type = get().type
      const hasProfissao = type.includes('profissao')
      const apenasLogo = type === 'apenas_logo'

      set(s => {
        const els = { ...s.elements }
        if (l.logo) els.logo = { ...els.logo, ...l.logo }
        if (l.nameOnly && !hasProfissao && !apenasLogo) {
          els.name = { ...els.name, ...l.nameOnly }
        } else if (l.name) {
          els.name = { ...els.name, ...l.name }
        }
        if (l.profession) els.profession = { ...els.profession, ...l.profession }
        return { activePatternId: id, elements: els }
      })
    },

    setFilter: (f) => set({ activeFilter: f }),
    toggleGuides: () => set(s => ({ showGuides: !s.showGuides })),
    markSaved: (at) => set({ lastSavedAt: at, isSaved: true }),
  }
})
