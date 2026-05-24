export type BrocheType =
  | 'logo_nome_profissao'
  | 'logo_nome'
  | 'nome_profissao'
  | 'apenas_nome'
  | 'apenas_logo'

export interface BrocheLayout {
  hasDivider?: boolean
  dividerX?: number
  logo?: { x: number; y: number; width: number; height: number }
  name?: { x: number; y: number; size: number }
  nameOnly?: { x: number; y: number; size: number }
  profession?: { x: number; y: number; size: number }
}

export interface BrocheTemplate {
  id: string
  label: string
  types: BrocheType[]
  filters: string[]
  layout: BrocheLayout
}

export const TEMPLATES: BrocheTemplate[] = [
  {
    id: 'ln_traco_padrao',
    label: 'Com traço · padrão',
    types: ['logo_nome', 'logo_nome_profissao'],
    filters: ['com-traço', 'clássico'],
    layout: {
      hasDivider: true, dividerX: 18.7,
      logo:       { x: 4.8,  y: 5.1,  width: 14, height: 14 },
      name:       { x: 38.1, y: 12.5, size: 7.2 },
      profession: { x: 38.1, y: 16.5, size: 2.85 },
      nameOnly:   { x: 38.1, y: 12.5, size: 8.2 },
    },
  },
  {
    id: 'ln_sem_traco',
    label: 'Sem traço · logo grande',
    types: ['logo_nome'],
    filters: ['sem-traço'],
    layout: {
      hasDivider: false,
      logo:   { x: 3.5, y: 4.5, width: 16, height: 16 },
      name:   { x: 40,  y: 12.5, size: 7.0 },
      nameOnly: { x: 40, y: 12.5, size: 7.0 },
    },
  },
  {
    id: 'ln_traco_nome_longo',
    label: 'Com traço · nome longo',
    types: ['logo_nome', 'logo_nome_profissao'],
    filters: ['com-traço', 'nome-longo'],
    layout: {
      hasDivider: true, dividerX: 18.7,
      logo:       { x: 4.8,  y: 7,    width: 11, height: 11 },
      name:       { x: 38.1, y: 12.5, size: 5.2 },
      profession: { x: 38.1, y: 17.5, size: 2.6 },
      nameOnly:   { x: 38.1, y: 12.5, size: 5.6 },
    },
  },
  {
    id: 'ln_logo_esq',
    label: 'Logo esquerda · centralizado',
    types: ['logo_nome'],
    filters: ['sem-traço', 'centralizado'],
    layout: {
      hasDivider: false,
      logo:     { x: 4,   y: 8,    width: 10, height: 10 },
      name:     { x: 35,  y: 12.5, size: 6.5 },
      nameOnly: { x: 35,  y: 12.5, size: 6.5 },
    },
  },
  {
    id: 'lnp_traco_padrao',
    label: 'Com traço · padrão',
    types: ['logo_nome_profissao'],
    filters: ['com-traço', 'clássico'],
    layout: {
      hasDivider: true, dividerX: 18.7,
      logo:       { x: 4.8,  y: 5.1,  width: 13, height: 13 },
      name:       { x: 38.1, y: 10.5, size: 6.5 },
      profession: { x: 38.1, y: 17.0, size: 2.85 },
    },
  },
  {
    id: 'lnp_compacto',
    label: 'Compacto · 3 linhas',
    types: ['logo_nome_profissao'],
    filters: ['sem-traço', 'compacto'],
    layout: {
      hasDivider: false,
      logo:       { x: 3.5, y: 6,    width: 11, height: 11 },
      name:       { x: 38,  y: 9.5,  size: 5.8 },
      profession: { x: 38,  y: 16.5, size: 2.6 },
    },
  },
  {
    id: 'np_centrado',
    label: 'Centrado · clássico',
    types: ['nome_profissao'],
    filters: ['clássico', 'centralizado'],
    layout: {
      hasDivider: false,
      name:       { x: 30, y: 10.5, size: 7.2 },
      profession: { x: 30, y: 17.5, size: 2.85 },
    },
  },
  {
    id: 'np_nome_longo',
    label: 'Nome longo',
    types: ['nome_profissao'],
    filters: ['nome-longo'],
    layout: {
      hasDivider: false,
      name:       { x: 30, y: 10.5, size: 5.2 },
      profession: { x: 30, y: 17.5, size: 2.85 },
    },
  },
  {
    id: 'n_grande',
    label: 'Nome grande · centralizado',
    types: ['apenas_nome'],
    filters: ['centralizado'],
    layout: {
      hasDivider: false,
      name: { x: 30, y: 12.5, size: 9.0 },
    },
  },
  {
    id: 'n_medio',
    label: 'Nome médio',
    types: ['apenas_nome'],
    filters: ['clássico'],
    layout: {
      hasDivider: false,
      name: { x: 30, y: 12.5, size: 7.5 },
    },
  },
  {
    id: 'al_centrado',
    label: 'Logo centrada',
    types: ['apenas_logo'],
    filters: ['centralizado'],
    layout: {
      hasDivider: false,
      logo: { x: 15, y: 4, width: 30, height: 17 },
    },
  },
  {
    id: 'placa_porta_padrao',
    label: 'Placa Porta · padrão',
    types: ['logo_nome', 'logo_nome_profissao'],
    filters: ['clássico', 'com-traço'],
    layout: {
      hasDivider: true, dividerX: 20,
      logo:       { x: 5,    y: 6,    width: 12, height: 12 },
      name:       { x: 40,   y: 11,   size: 6.0 },
      profession: { x: 40,   y: 18,   size: 2.5 },
      nameOnly:   { x: 40,   y: 12.5, size: 7.5 },
    },
  },
  {
    id: 'cracha_horizontal',
    label: 'Crachá · horizontal',
    types: ['logo_nome', 'logo_nome_profissao', 'apenas_nome'],
    filters: ['centralizado', 'sem-traço'],
    layout: {
      hasDivider: false,
      logo:       { x: 3,    y: 7,    width: 11, height: 11 },
      name:       { x: 36,   y: 11.5, size: 6.8 },
      profession: { x: 36,   y: 17.5, size: 2.7 },
      nameOnly:   { x: 30,   y: 12.5, size: 8.5 },
    },
  },
  {
    id: 'ln_dupla_coluna',
    label: 'Dois campos · compacto',
    types: ['logo_nome', 'logo_nome_profissao'],
    filters: ['compacto', 'com-traço'],
    layout: {
      hasDivider: true, dividerX: 17,
      logo:       { x: 4,    y: 6,    width: 10, height: 10 },
      name:       { x: 38.5, y: 9.5,  size: 5.5 },
      profession: { x: 38.5, y: 16.5, size: 2.5 },
      nameOnly:   { x: 38.5, y: 12.5, size: 6.5 },
    },
  },
]

export const FILTERS_BY_TYPE: Record<BrocheType, string[]> = {
  logo_nome:           ['todos', 'com-traço', 'sem-traço', 'nome-longo', 'centralizado', 'compacto'],
  logo_nome_profissao: ['todos', 'com-traço', 'sem-traço', 'compacto', 'clássico'],
  nome_profissao:      ['todos', 'clássico', 'nome-longo', 'centralizado', 'compacto'],
  apenas_nome:         ['todos', 'centralizado', 'clássico'],
  apenas_logo:         ['todos', 'centralizado'],
}
