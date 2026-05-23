/**
 * dxf-spline-encoder.ts — Encoder de entidade SPLINE para DXF AC1032 (R2018).
 *
 * Sub-onda DXF-1. Encoder PURO: não conhece SVG, paths, fontes, ou Fabric.
 * Recebe control points + processo + flags → devolve linhas DXF prontas para
 * concatenar no bloco ENTITIES.
 *
 * Anatomia baseada no DXF de referência (ADR 020 §2):
 *   - Grau 3 (cubic) sempre.
 *   - Planar Z=0 (normal vector 0,0,1).
 *   - Control-points-only (zero fit points).
 *   - Knots clamped + normalizados em [0,1].
 *   - Layer "Camada 1" (cor por entidade via código 62).
 *
 * Convenções DXF:
 *   - Formato texto, pares (código, valor) em linhas alternadas.
 *   - CRLF entre tokens (alguns parsers antigos quebram com LF puro).
 *   - Códigos 10/20/30 = X/Y/Z; 40 = double; 62 = color; 70/71/72/73/74 = int.
 */

import { type DxfProcess, processColor } from './dxf-process-color';

/** Ponto 2D em mm. Z é implícito = 0 (toda geometria planar). */
export interface Point2D {
  x: number;
  y: number;
}

export interface SplineInput {
  /** Control points em mm. Mínimo: degree+1 = 4 para grau 3. */
  controlPoints: Point2D[];
  /** Curva fechada? Afeta flag 70 (closed bit) e geração de knots. */
  closed: boolean;
  /** Processo de produção → vira cor 62 (corte=31, gravacao=250, marcacao=5). */
  process: DxfProcess;
  /**
   * Knot vector explícito (opcional). Quando ausente, o encoder gera um
   * knot vector clamped uniforme (multiplicidade p+1 nos extremos, uniforme
   * nos internos).
   *
   * Quando fornecido, é usado direto — necessário para B-splines que
   * representam piecewise Bézier com multiplicidade 3 nas junções (preserva
   * cantos). Caller é responsável por garantir:
   *   - length = controlPoints.length + degree + 1
   *   - monotonicamente não-decrescente
   *   - normalizado em [0, 1] (convenção do exporter)
   */
  knots?: number[];
}

/**
 * Layer única conforme ADR 020 §5. Processo é codificado por cor de entidade,
 * não por layer — então o nome é fixo.
 */
export const SINGLE_LAYER_NAME = 'Camada 1' as const;

/** Grau fixo da SPLINE. Grau 3 = cubic, único usado no DXF real. */
const SPLINE_DEGREE = 3;

/**
 * Flag 70 — bits AcDbSpline:
 *   1  = closed
 *   2  = periodic
 *   4  = rational
 *   8  = planar
 *   16 = linear
 *
 * Aberta planar = 8; Fechada planar = 1+8 = 9 (mas o DXF real usa 11 = 1+2+8,
 * sinalizando "closed + periodic + planar" — replicamos exatamente).
 */
const FLAG_OPEN_PLANAR = 8;
const FLAG_CLOSED_PLANAR_PERIODIC = 11;

/** Tolerâncias do DXF real (espelhadas exatamente). */
const KNOT_TOLERANCE = 1e-10;
const CTRL_TOLERANCE = 1e-10;

/**
 * Emite as linhas DXF para uma SPLINE. Resultado: array de strings sem CRLF
 * final (o caller concatena com `\r\n`).
 *
 * @throws Error se controlPoints.length < degree+1 (4 para grau 3).
 */
export function encodeSpline(input: SplineInput): string[] {
  const { controlPoints, closed, process } = input;

  if (controlPoints.length < SPLINE_DEGREE + 1) {
    throw new Error(
      `[dxf-spline-encoder] SPLINE grau ${SPLINE_DEGREE} exige no mínimo ` +
        `${SPLINE_DEGREE + 1} control points, recebeu ${controlPoints.length}`
    );
  }

  const color = processColor(process);
  const flag = closed ? FLAG_CLOSED_PLANAR_PERIODIC : FLAG_OPEN_PLANAR;

  // Knot vector: usa explícito se fornecido (caller já calculou com
  // multiplicidade 3 nas junções de Bézier, por exemplo); senão gera
  // clamped uniforme como antes.
  const expectedKnotCount = controlPoints.length + SPLINE_DEGREE + 1;
  let knots: number[];
  if (input.knots) {
    if (input.knots.length !== expectedKnotCount) {
      throw new Error(
        `[dxf-spline-encoder] knot vector com tamanho incorreto: ` +
          `esperado ${expectedKnotCount}, recebeu ${input.knots.length}`
      );
    }
    knots = input.knots;
  } else {
    knots = generateClampedKnots(controlPoints.length, SPLINE_DEGREE, closed);
  }

  const lines: string[] = [];

  // Cabeçalho da entidade.
  push(lines, 0, 'SPLINE');
  push(lines, 8, SINGLE_LAYER_NAME);
  push(lines, 62, String(color));
  push(lines, 100, 'AcDbEntity');
  push(lines, 100, 'AcDbSpline');

  // Vetor normal (planar Z+1).
  push(lines, 210, num(0));
  push(lines, 220, num(0));
  push(lines, 230, num(1));

  // Flags + dimensões.
  push(lines, 70, String(flag));
  push(lines, 71, String(SPLINE_DEGREE));
  push(lines, 72, String(knots.length));
  push(lines, 73, String(controlPoints.length));
  push(lines, 74, '0'); // sempre control-points-only

  // Tolerâncias.
  push(lines, 42, num(KNOT_TOLERANCE));
  push(lines, 43, num(CTRL_TOLERANCE));

  // Knot values.
  for (const k of knots) {
    push(lines, 40, num(k));
  }

  // Control points (X, Y, Z=0).
  for (const p of controlPoints) {
    push(lines, 10, num(p.x));
    push(lines, 20, num(p.y));
    push(lines, 30, num(0));
  }

  return lines;
}

/**
 * Gera knot vector clamped + normalizado em [0, 1].
 *
 * Para curva ABERTA grau p com n control points: n + p + 1 knots, com
 * multiplicidade p+1 nos extremos (clamping) e distribuição uniforme nos
 * internos.
 *
 * Para curva FECHADA: o DXF real usa o mesmo esquema clamped do aberto
 * (multiplicidade p+1 nos extremos) — não periodic-uniform. O "closed"
 * fica marcado só no flag 70. Validado pela primeira SPLINE do arquivo
 * referência (25 control points, 29 knots, grau 3, flag 11=closed).
 *
 * @param n Número de control points
 * @param p Grau (3 fixo neste exporter)
 * @param _closed Reservado — atualmente o esquema é o mesmo open/closed
 *                porque o DXF real assim faz. Mantido como parâmetro para
 *                evolução futura sem quebra de API.
 */
export function generateClampedKnots(n: number, p: number, _closed: boolean): number[] {
  // Total: n + p + 1 knots.
  const total = n + p + 1;
  const knots: number[] = [];

  // Primeiros p+1 = 0.
  for (let i = 0; i <= p; i++) {
    knots.push(0);
  }

  // Internos: (total - 2*(p+1)) valores igualmente espaçados em (0, 1).
  const internalCount = total - 2 * (p + 1);
  for (let i = 1; i <= internalCount; i++) {
    knots.push(i / (internalCount + 1));
  }

  // Últimos p+1 = 1.
  for (let i = 0; i <= p; i++) {
    knots.push(1);
  }

  return knots;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Adiciona par (code, value) como 2 linhas no array. Código é left-padded
 * em 3 chars (estilo AutoCAD canônico — parsers ignoram, mas convenção).
 */
function push(lines: string[], code: number, value: string): void {
  lines.push(String(code).padStart(3, ' '));
  lines.push(value);
}

/**
 * Formata número para DXF: ponto decimal, sem expoente, sem locale.
 * Knots/coords usam 16 casas (precisão do double) para preservar o esquema
 * do arquivo referência que tem valores como "1e-10" e fractions exatos.
 *
 * `Number.toString()` em JS já é locale-independent e usa "." sempre.
 * Para inteiros como 0/1 isso produz "0"/"1" (sem ".0"), o que o DXF aceita.
 */
function num(n: number): string {
  // Usar notação científica quando o número é muito pequeno (como o DXF real,
  // que tem "1e-10" nos campos de tolerância 42/43). toString() já faz isso
  // automaticamente para valores < ~1e-7.
  return n.toString();
}
