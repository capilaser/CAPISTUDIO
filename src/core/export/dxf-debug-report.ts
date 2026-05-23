/**
 * dxf-debug-report.ts — Telemetria geométrica do pipeline DXF v2.
 *
 * Sub-onda DXF-PRODUCTION-ALIGNMENT.
 *
 * Coleta, para cada objeto exportado, snapshots das 8 etapas do pipeline:
 *   1. Bbox px Fabric original (obj.getBoundingRect() — pré-transform externa)
 *   2. Bbox px após calcTransformMatrix (no contexto do canvas inteiro)
 *   3. `d` SVG bruto em px local (antes de shapeToFlatPathD)
 *   4. `d` SVG após shapeToFlatPathD (em mm finais)
 *   5. Bbox mm do `d` (calculado parseando os números do d)
 *   6. SplineInputs pré-flip (saída de svgPathToSplines)
 *   7. SplineInputs pós-flip (saída de normalizeForDxf)
 *   8. Bbox mm final emitido (calculado dos splines pós-flip)
 *
 * Cada snapshot inclui também transforms aplicadas e contexto (offset de label,
 * origem do produto, scale fator, etc).
 *
 * Esta telemetria é OPT-IN: o exporter principal não paga nenhum custo quando
 * `debug` é falso. Quando `true`, popula o report durante o pipeline.
 *
 * Saída é serializável (JSON.stringify-safe) para que o painel UI consuma sem
 * conhecer nada do exporter.
 */

import type { AffineMatrix } from './svg-path-transform';
import type { SplineInput } from './dxf-spline-encoder';
import type { Operation } from '@/data/repositories/_export-validation';

/** Bbox 2D em qualquer unidade. */
export interface DebugBbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** width = maxX - minX. */
  width: number;
  /** height = maxY - minY. */
  height: number;
}

export interface DebugObjectSnapshot {
  /** Id capi do objeto (LayerMeta.id). */
  id: string;
  /** Nome legível da camada (LayerMeta.name). */
  name: string;
  /** Tipo Fabric (rect/path/group/textbox/i-text/...). */
  fabricType: string;
  /** Texto convertido se for text-like, senão null. */
  textContent: string | null;
  /** Operação roteada (corte/gravacao/marcacao). */
  operation: Operation;
  /** Máquinas roteadas. */
  machines: string[];

  // ── Etapas do pipeline ─────────────────────────────────────────────────────

  /** 1. Bbox px no canvas Fabric (obj.getBoundingRect()). null para texto. */
  fabricBoundingRectPx: DebugBbox | null;
  /** 2. Matrix de transform absoluta (calcTransformMatrix do Fabric). null para texto. */
  fabricTransformMatrix: AffineMatrix | null;
  /** 3. Path `d` SVG em px local (antes de aplicar frame externo). null para texto. */
  localPathD: string | null;
  /**
   * 4. Path `d` SVG após aplicar frame externo (px→mm + offset). Sempre em mm.
   * Para texto, é o `d` retornado por opentype.js (já em mm via frame).
   */
  worldPathDmm: string;
  /** 5. Bbox mm do d final (parsing dos números). */
  worldPathBboxMm: DebugBbox;
  /** 6. SplineInputs antes do flip Y (saída de svgPathToSplines). */
  splinesPreFlip: SplineInput[];
  /** Bbox mm dos splines pré-flip (mesmo Y do canvas SVG). */
  splinesPreFlipBboxMm: DebugBbox;
  /** 7. SplineInputs depois do flip Y (saída de normalizeForDxf). */
  splinesPostFlip: SplineInput[];
  /** 8. Bbox mm final emitido (mesmo dos splines pós-flip). */
  splinesPostFlipBboxMm: DebugBbox;
}

export interface DxfDebugReport {
  /** Quando o report foi gerado. */
  generatedAt: string;
  /** Dimensão do produto em mm (do options). */
  productMm: { widthMm: number; heightMm: number };
  /** Offset aplicado em cada coordenada (label de chapa, etc). */
  contentOffsetMm: { xMm: number; yMm: number };
  /** Frame matricial composto (scale × translate). */
  frame: AffineMatrix;
  /** PX_PER_MM constante usada. */
  pxPerMm: number;

  /** Snapshots por objeto, em ordem de processamento do canvas (z-order). */
  objects: DebugObjectSnapshot[];

  /** Bbox global da arte no canvas (em px) — soma dos fabricBoundingRectPx. */
  canvasBoundingBoxPx: DebugBbox | null;
  /** Bbox global final emitido no DXF (em mm). */
  dxfFinalBoundingBoxMm: DebugBbox | null;
}

/** Helper: cria bbox vazio (preparado para receber pontos via expandBbox). */
export function emptyBbox(): DebugBbox {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    width: 0,
    height: 0,
  };
}

/** Mutator: expande bbox para incluir (x, y). */
export function expandBbox(b: DebugBbox, x: number, y: number): void {
  if (x < b.minX) b.minX = x;
  if (y < b.minY) b.minY = y;
  if (x > b.maxX) b.maxX = x;
  if (y > b.maxY) b.maxY = y;
  b.width = b.maxX - b.minX;
  b.height = b.maxY - b.minY;
}

/** Helper: bbox de uma lista de splines (varre todos os control points). */
export function bboxOfSplines(splines: SplineInput[]): DebugBbox {
  const b = emptyBbox();
  for (const s of splines) {
    for (const p of s.controlPoints) {
      expandBbox(b, p.x, p.y);
    }
  }
  if (!Number.isFinite(b.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return b;
}

/**
 * Helper: bbox de um path SVG `d` parseando os números (heurística — ignora
 * comandos relativos para simplicidade; usado só em debug, não em produção).
 *
 * Para um cálculo exato em todos os casos seria preciso reusar parsePath +
 * tracking de cursor. Como esse bbox é apenas DIAGNÓSTICO, a heurística de
 * "todos os pares de números são x,y" basta — é o que está no `d` emitido por
 * `shapeToFlatPathD` (que produz só comandos absolutos M/L/C/Q/Z).
 */
export function bboxOfPathD(d: string): DebugBbox {
  const b = emptyBbox();
  const tokens = d.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g) ?? [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const x = parseFloat(tokens[i]!);
    const y = parseFloat(tokens[i + 1]!);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      expandBbox(b, x, y);
    }
  }
  if (!Number.isFinite(b.minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return b;
}

/**
 * União de bboxes (todos os snapshots). Retorna null se a lista é vazia ou
 * todos os bboxes são degenerados.
 */
export function unionBboxes(bboxes: (DebugBbox | null)[]): DebugBbox | null {
  const u = emptyBbox();
  let touched = false;
  for (const b of bboxes) {
    if (!b) continue;
    if (b.width === 0 && b.height === 0 && b.minX === 0 && b.minY === 0) continue;
    expandBbox(u, b.minX, b.minY);
    expandBbox(u, b.maxX, b.maxY);
    touched = true;
  }
  if (!touched) return null;
  return u;
}
