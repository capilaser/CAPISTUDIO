/**
 * Formato do arquivo de projeto Capi Studio — `projeto.cps.json`.
 *
 * Filesystem é a fonte de verdade. Toda a persistência de um projeto vive em
 * `<raiz>/<nome-projeto>/projeto.cps.json` + subpastas (ver PROJECT_VISION §10).
 *
 * Versão do schema: bump em mudanças breaking. Reader sempre confere
 * `schemaVersion` antes de interpretar.
 *
 * Invariantes geométricas (PROJECT_VISION §0.2):
 *   - todas as coordenadas em mm
 *   - origem topo-esquerdo (Y cresce para baixo, igual SVG)
 *   - nunca arredondar; usar floats nativos
 *   - objetos importados (DXF base, SVG logo) preservam geometria exata
 */

import type { ProcessType, MachineCode } from '@/data/schema';

export const CPS_SCHEMA_VERSION = 1;

/** Identificador do arquivo. Suffix .cps.json. */
export const CPS_FILE_NAME = 'projeto.cps.json';

/** Cores operacionais para SVG (PROJECT_VISION §0.1 / §14). */
export const OPERATION_SVG_COLOR: Record<ProcessType, string> = {
  corte: '#000000',
  gravacao: '#FF0000',
  marcacao: '#0000FF',
};

/** Cores operacionais para DXF (ACI — ADR 020). */
export const OPERATION_DXF_ACI: Record<ProcessType, number> = {
  corte: 31,
  gravacao: 250,
  marcacao: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// Camadas — Onda 2E vai refatorar consumidores. O tipo já fica aqui.
// ─────────────────────────────────────────────────────────────────────────────

/** Decisão por camada sobre quais formatos de export ela alimenta. */
export interface LayerExportRules {
  /** Aparece no PNG de aprovação (default true). */
  png: boolean;
  /** Vai para o SVG de produção (default false até classificar). */
  svg: boolean;
  /** Vai para o DXF de produção (default false até classificar). */
  dxf: boolean;
}

/** Tag colorida no painel de camadas (referência visual, não cor do desenho). */
export type LayerColorLabel =
  | 'none'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'gray';

/**
 * Camada do projeto. Cada objeto no canvas pertence a uma camada via `layerId`.
 *
 * `operation` e `machines` são opcionais durante edição, mas exportação
 * para SVG/DXF de produção valida que estão presentes (operação obrigatória,
 * pelo menos 1 máquina).
 */
export interface Layer {
  id: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;

  /** Operação de produção. null = ainda não classificada. */
  operation: ProcessType | null;

  /** Máquinas alvo. Vazio = não classificada para produção. */
  machines: MachineCode[];

  /** Regras de exportação por formato. */
  exportTo: LayerExportRules;

  /** Tag de cor para organização visual (default 'none'). */
  colorLabel: LayerColorLabel;

  /** Espaço reservado para tags futuras (busca, agrupamento). */
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Objetos no canvas — serializados via Fabric.js + metadados Capi.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Objeto canvas serializado. Estrutura é o output de `fabric.Canvas.toJSON()`
 * com campos extras Capi (capiId estável, layerId, originalGeometryMm).
 *
 * `originalGeometryMm` preserva a geometria EXATA do arquivo importado
 * (DXF base, logo SVG). Snap nunca toca esse campo. Render usa transform
 * do Fabric; export usa esse campo como fonte de verdade.
 */
export interface CanvasObject {
  /** ID estável do objeto no projeto. */
  capiId: string;

  /** Camada à qual o objeto pertence. */
  layerId: string;

  /** Tipo Fabric.js (rect, circle, path, group, i-text, image…). */
  type: string;

  /** Restante das propriedades Fabric serializadas via toJSON. */
  [fabricKey: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Projeto — top-level do arquivo .cps.json.
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata informativa do projeto. */
export interface ProjectMeta {
  /** Nome humano. Por convenção == nome da pasta, mas o arquivo é a verdade. */
  name: string;

  /** Produto que serve de base (ex: 'broche-60x25'). */
  productId: string;

  /** ISO 8601 — criação do projeto. */
  createdAt: string;

  /** ISO 8601 — última gravação. */
  updatedAt: string;

  /** Versão do app que gerou/atualizou. Útil para diagnóstico de regressão. */
  appVersion?: string;
}

/** Viewport do projeto em mm (define o canvas físico do produto). */
export interface ProjectViewport {
  /** Largura em mm (ex: 60 para broche 60×25). */
  widthMm: number;
  /** Altura em mm (ex: 25). */
  heightMm: number;
  /** ViewBox SVG no formato "minX minY width height". */
  viewBox: string;
}

/**
 * Conteúdo completo do `projeto.cps.json`. Imutável após write (cada save
 * cria um arquivo novo via temp + rename).
 */
export interface ProjectFile {
  /** Versão do schema deste arquivo. */
  schemaVersion: number;

  meta: ProjectMeta;
  viewport: ProjectViewport;
  layers: Layer[];
  objects: CanvasObject[];
}

/** Cria um ProjectFile vazio para um produto. */
export function newProjectFile(args: {
  name: string;
  productId: string;
  widthMm: number;
  heightMm: number;
  viewBox: string;
}): ProjectFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: CPS_SCHEMA_VERSION,
    meta: {
      name: args.name,
      productId: args.productId,
      createdAt: now,
      updatedAt: now,
    },
    viewport: {
      widthMm: args.widthMm,
      heightMm: args.heightMm,
      viewBox: args.viewBox,
    },
    layers: [],
    objects: [],
  };
}
