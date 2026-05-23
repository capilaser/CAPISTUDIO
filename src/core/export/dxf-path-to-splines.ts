/**
 * dxf-path-to-splines.ts — Converte SVG path `d` em SplineInputs (Sub-onda DXF-2 + stitching).
 *
 * Ponte entre o pipeline visual (SVG paths do Fabric + opentype) e o encoder
 * SPLINE (DXF-1).
 *
 * UMA SPLINE POR SUBPATH (Stitching — DXF text/shape contour stitching):
 *   Cada subpath contínuo do path SVG (de `M` até o próximo `M` ou `Z`) vira
 *   UMA ÚNICA SplineInput, com control points e knots que reproduzem todos
 *   os segmentos Bézier consecutivos como uma B-spline cubic única.
 *
 *   Antes (DXF-2 inicial): 1 SPLINE por segmento Bézier → "5" virava dezenas
 *   de SPLINEs separadas no RDWorks/EZCAD Object List. Inviável operacionalmente.
 *
 *   Agora: 1 SPLINE por subpath. Letra "O" = 2 SPLINEs (externo + hole).
 *   Letra "5" = 1 SPLINE com contorno fechado. Broche arredondado = 1 SPLINE.
 *
 * Estratégia interna:
 *   - Pré-processador `expandArcsInPath` substitui cada A/a por sequência
 *     de cubic Béziers de no máximo 45° (split adaptativo) usando kappa
 *     ótimo. Erro de aproximação < 0.001mm para raios típicos.
 *   - `fabric.util.parsePath` + `makePathSimpler` normaliza H/V/S/T em M/L/C/Q/Z.
 *   - L vira cubic degenerada (control points colineares igualmente espaçados).
 *   - Q vira C via elevação de grau exata.
 *   - C passa direto.
 *   - Acumula segmentos em buffer por subpath; `stitchCubicsIntoSpline`
 *     converte N cubics consecutivos em UMA B-spline cubic com knots de
 *     multiplicidade 3 em cada junção (transformação canônica "piecewise
 *     Bézier → single B-spline" que preserva cantos exatos).
 *   - Z fecha o subpath: se o cursor não coincide com subpathStart, emite
 *     segmento reto extra fechando o gap antes do stitch.
 *
 * Multiplicidade 3 garante que toda junção entre 2 cubics consecutivos
 * preserva o canto/curvatura original — reta vira reta, canto vira canto,
 * curva suave vira curva suave. Geometria 1:1 ao input SVG.
 *
 * Coordenadas:
 *   - Entram em mm (caller é responsável por converter px→mm antes).
 *   - Y é preservado como vem do SVG (Y positivo para baixo). O flip para
 *     o sistema DXF (Y para cima, conforme ADR 020 §6 revisada) é
 *     responsabilidade do `normalizeForDxf` no pipeline. Isso mantém este
 *     módulo como geometria SVG pura.
 *   - Sem normalização de offset aqui — caller decide bbox (DXF-3/4 normaliza
 *     antes de gerar o documento).
 *
 * Conformidade ADR 020:
 *   - §2: SAÍDA SÓ TEM SplineInput → nunca POLYLINE/LINE/etc.
 *   - §3: caller para text→path (opentype) já fez o passo; aqui é só geometria.
 */

import * as fabric from 'fabric';

import type { DxfProcess } from './dxf-process-color';
import type { Point2D, SplineInput } from './dxf-spline-encoder';

export interface PathToSplinesOptions {
  /** Processo de produção → cor da SPLINE. */
  process: DxfProcess;
  /**
   * Tolerância em mm para fechamento de subpath (Z). Default 1e-6.
   * Se o último endpoint estiver dentro desta tolerância de subpathStart,
   * consideramos já fechado — não emite segmento de fechamento extra.
   */
  closeToleranceMm?: number;
}

/**
 * Segmento Bézier cubic — representação interna durante acumulação por subpath.
 * Cada segmento tem 4 control points (P0..P3). Continuidade C0 entre
 * segmentos consecutivos é garantida pelo cursor do parser (P3 do anterior =
 * P0 do seguinte).
 */
interface CubicSegment {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
}

/**
 * Converte um path SVG `d` em uma lista de SplineInputs (UMA por subpath).
 *
 * Cada subpath terminado por `Z` vira UMA SplineInput com `closed: true`;
 * subpaths abertos viram UMA SplineInput com `closed: false`. O stitch
 * preserva geometria 1:1 via knots de multiplicidade 3 em cada junção.
 *
 * Retorno vazio para path malformado ou sem conteúdo geométrico válido.
 */
export function svgPathToSplines(d: string, opts: PathToSplinesOptions): SplineInput[] {
  const { process, closeToleranceMm = 1e-6 } = opts;

  // Pré-processa o `d` substituindo arcos (A/a) por sequências de cubic Béziers.
  const expandedD = expandArcsInPath(d);

  const parsed = fabric.util.parsePath(expandedD);
  if (!parsed || parsed.length === 0) return [];

  // makePathSimpler normaliza H/V/S/T → M/L/C/Q/Z.
  const simple = fabric.util.makePathSimpler(parsed);

  const result: SplineInput[] = [];

  // Buffer de segmentos do subpath corrente. Cada segmento = 1 cubic Bézier
  // com 4 control points. Ao Z (ou novo M), flush via stitch → 1 SPLINE.
  let currentSegments: CubicSegment[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;

  const flushSubpath = (closed: boolean) => {
    if (currentSegments.length === 0) return;
    const stitched = stitchCubicsIntoSpline(currentSegments, closed, process);
    if (stitched) result.push(stitched);
    currentSegments = [];
  };

  for (let i = 0; i < simple.length; i++) {
    const cmd = simple[i]!;
    const op = cmd[0] as string;

    if (op === 'M') {
      // Novo subpath. O anterior (se aberto) é flushado sem fechar.
      flushSubpath(false);
      cursorX = cmd[1] as number;
      cursorY = cmd[2] as number;
      subpathStartX = cursorX;
      subpathStartY = cursorY;
      continue;
    }

    if (op === 'L') {
      const endX = cmd[1] as number;
      const endY = cmd[2] as number;
      const seg = lineToCubic({ x: cursorX, y: cursorY }, { x: endX, y: endY });
      if (seg) currentSegments.push(seg);
      cursorX = endX;
      cursorY = endY;
      continue;
    }

    if (op === 'Q') {
      const cpX = cmd[1] as number;
      const cpY = cmd[2] as number;
      const endX = cmd[3] as number;
      const endY = cmd[4] as number;
      currentSegments.push(
        quadraticToCubic({ x: cursorX, y: cursorY }, { x: cpX, y: cpY }, { x: endX, y: endY })
      );
      cursorX = endX;
      cursorY = endY;
      continue;
    }

    if (op === 'C') {
      const cp1X = cmd[1] as number;
      const cp1Y = cmd[2] as number;
      const cp2X = cmd[3] as number;
      const cp2Y = cmd[4] as number;
      const endX = cmd[5] as number;
      const endY = cmd[6] as number;
      currentSegments.push({
        p0: { x: cursorX, y: cursorY },
        p1: { x: cp1X, y: cp1Y },
        p2: { x: cp2X, y: cp2Y },
        p3: { x: endX, y: endY },
      });
      cursorX = endX;
      cursorY = endY;
      continue;
    }

    if (op === 'Z' || op === 'z') {
      // Fecha subpath. Se o cursor não está em subpathStart, emite um
      // segmento reto adicional fechando o gap (comportamento SVG canônico).
      const dx = subpathStartX - cursorX;
      const dy = subpathStartY - cursorY;
      const gap = Math.sqrt(dx * dx + dy * dy);
      if (gap > closeToleranceMm) {
        const closer = lineToCubic(
          { x: cursorX, y: cursorY },
          { x: subpathStartX, y: subpathStartY }
        );
        if (closer) currentSegments.push(closer);
      }
      cursorX = subpathStartX;
      cursorY = subpathStartY;
      flushSubpath(true);
      continue;
    }

    if (typeof console !== 'undefined') {
      console.warn(`[dxf-path-to-splines] comando SVG inesperado pós-simplify: "${op}"`);
    }
  }

  // Subpath final sem Z — flush aberto.
  flushSubpath(false);

  return result;
}

// ── Conversores por comando ──────────────────────────────────────────────────

/**
 * Linha reta → cubic Bézier degenerada com 4 control points colineares,
 * igualmente espaçados (1/3 e 2/3 do caminho).
 *
 * Retorna `null` se a "linha" tem comprimento zero — evita gerar segmento
 * inútil com 4 pontos coincidentes.
 */
function lineToCubic(p0: Point2D, p3: Point2D): CubicSegment | null {
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return null;
  return {
    p0: { x: p0.x, y: p0.y },
    p1: { x: p0.x + dx / 3, y: p0.y + dy / 3 },
    p2: { x: p0.x + (2 * dx) / 3, y: p0.y + (2 * dy) / 3 },
    p3: { x: p3.x, y: p3.y },
  };
}

/**
 * Quadratic Bézier (3 pontos) → Cubic Bézier (4 pontos) por elevação de grau:
 *   cp1' = p0 + (2/3)(cp − p0)
 *   cp2' = p2 + (2/3)(cp − p2)
 *
 * A curva resultante é IDÊNTICA à original — não é aproximação, é
 * conversão exata entre formas paramétricas.
 */
function quadraticToCubic(p0: Point2D, cp: Point2D, p2: Point2D): CubicSegment {
  return {
    p0,
    p1: {
      x: p0.x + (2 / 3) * (cp.x - p0.x),
      y: p0.y + (2 / 3) * (cp.y - p0.y),
    },
    p2: {
      x: p2.x + (2 / 3) * (cp.x - p2.x),
      y: p2.y + (2 / 3) * (cp.y - p2.y),
    },
    p3: p2,
  };
}

// ── Stitch: N segmentos cubic → 1 B-spline cubic ────────────────────────────

/**
 * Une N segmentos cubic Bézier consecutivos (C0-contínuos) numa única
 * B-spline cubic, preservando geometria 1:1.
 *
 * Algoritmo canônico "piecewise Bézier → single B-spline":
 *
 *   Control points (n = 3N + 1 pontos para N segmentos):
 *     [B₀.P₀, B₀.P₁, B₀.P₂, B₀.P₃, B₁.P₁, B₁.P₂, B₁.P₃, B₂.P₁, ..., B_{N-1}.P₃]
 *
 *     Cada segmento Bᵢ contribui 4 pontos no início; segmentos seguintes
 *     contribuem 3 (P₁, P₂, P₃) — o P₀ deles é o P₃ do anterior.
 *
 *   Knot vector (total = n + p + 1 = 3N + 5 knots, grau p = 3):
 *     - 4 knots = 0 no início (multiplicidade p+1)
 *     - Para cada uma das N-1 junções: 3 knots iguais a (i+1)/N (multiplicidade 3)
 *     - 4 knots = 1 no final (multiplicidade p+1, após normalização)
 *
 *   Multiplicidade 3 nas junções preserva CANTOS (descontinuidade C2):
 *   reta vira reta, canto vira canto, curva suave vira curva suave.
 *
 * Para curva FECHADA (Z), o último segmento já termina em subpathStart (o
 * loop principal injetou segmento extra se houvesse gap). O `closed: true`
 * marca a flag — não duplicamos control points.
 *
 * Retorna `null` se a lista de segmentos é vazia.
 */
export function stitchCubicsIntoSpline(
  segments: CubicSegment[],
  closed: boolean,
  process: DxfProcess
): SplineInput | null {
  if (segments.length === 0) return null;

  // Control points consolidados: P0 do primeiro + (P1, P2, P3) de cada.
  const controlPoints: Point2D[] = [];
  const first = segments[0]!;
  controlPoints.push(first.p0);
  for (const seg of segments) {
    controlPoints.push(seg.p1, seg.p2, seg.p3);
  }
  // Total: 1 + 3N = 3N + 1 control points

  const knots = buildBezierKnotVector(segments.length);

  return {
    controlPoints,
    closed,
    process,
    knots,
  };
}

/**
 * Constrói o knot vector para N segmentos Bézier cubic concatenados como
 * UMA B-spline cubic. Multiplicidade 3 em cada uma das N-1 junções entre
 * segmentos consecutivos (preserva cantos / descontinuidade C2).
 *
 * Para grau 3 com n = 3N + 1 control points:
 *   - Total knots = n + p + 1 = 3N + 5
 *   - Primeiros p+1 = 4 knots = 0     (clamping na origem)
 *   - Para junção i (1 ≤ i ≤ N-1): 3 knots iguais a i/N (multiplicidade 3)
 *   - Últimos p+1 = 4 knots = 1       (clamping no fim, normalizado)
 *
 * Verificação de tamanho:
 *   4 (start) + 3·(N-1) (junções) + 4 (end) = 3N + 5 ✓
 *
 * Casos especiais:
 *   - N = 1 (1 segmento, 4 control points): knots = [0,0,0,0, 1,1,1,1]
 *     (sem junções internas). Total = 8 = 4 + 3 + 1 ✓
 */
export function buildBezierKnotVector(segmentCount: number): number[] {
  if (segmentCount <= 0) {
    throw new Error(`[dxf-path-to-splines] segmentCount precisa ser >= 1, recebeu ${segmentCount}`);
  }
  const knots: number[] = [];
  // 4 knots = 0 (multiplicidade p+1 nos extremos).
  for (let i = 0; i < 4; i++) knots.push(0);
  // 3 knots por junção interna (multiplicidade 3 = preserva canto).
  for (let i = 1; i < segmentCount; i++) {
    const t = i / segmentCount;
    knots.push(t, t, t);
  }
  // 4 knots = 1 (clamping final, normalizado).
  for (let i = 0; i < 4; i++) knots.push(1);
  return knots;
}

// Re-export interno para testes diretos.
export type { CubicSegment };

// ── Expansão de arco A → sequência de cubic Béziers ─────────────────────────

/**
 * Tokeniza um `d` SVG em pares (comando, números). Tolerante a vírgulas,
 * espaços, sinais grudados (-) e notação científica. Suficiente para o
 * formato emitido por opentype.js e SVGs típicos de produtos.
 */
function tokenizePath(d: string): Array<{ op: string; args: number[] }> {
  const result: Array<{ op: string; args: number[] }> = [];
  // Regex separados: 1 letra de comando, OU 1 número (com sinais/decimal/exp).
  const tokenRe = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  let current: { op: string; args: number[] } | null = null;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(d)) !== null) {
    if (match[1]) {
      if (current) result.push(current);
      current = { op: match[1], args: [] };
    } else if (match[2] && current) {
      current.args.push(parseFloat(match[2]));
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Re-serializa um stream de tokens em `d` SVG.
 */
function serializePath(tokens: Array<{ op: string; args: number[] }>): string {
  return tokens.map((t) => `${t.op} ${t.args.join(' ')}`).join(' ');
}

/**
 * Substitui cada comando A/a no path por uma sequência equivalente de C
 * (cubic Bézier absoluto). Mantém todos os outros comandos intactos.
 *
 * Estratégia:
 *   1. Tokeniza o `d` em pares (op, args).
 *   2. Acompanha o cursor (current point) atualizado por cada comando.
 *   3. Em cada A/a: converte endpoint→center parameterization (algoritmo
 *      W3C §F.6.5), split o intervalo angular em N segmentos ≤ π/2 cada,
 *      gera 1 C por segmento usando kappa ótimo, e substitui o A no stream.
 *
 * Não modifica nenhum outro comando — comportamento idempotente para paths
 * sem A.
 */
export function expandArcsInPath(d: string): string {
  const tokens = tokenizePath(d);
  const output: Array<{ op: string; args: number[] }> = [];

  let cursorX = 0;
  let cursorY = 0;
  let subpathStartX = 0;
  let subpathStartY = 0;

  for (const tok of tokens) {
    const { op, args } = tok;

    if (op === 'M' || op === 'm') {
      const relative = op === 'm';
      // SVG: M/m pode ter pontos extras (tratados como L/l implícitos).
      for (let i = 0; i + 1 < args.length; i += 2) {
        const dxArg = args[i]!;
        const dyArg = args[i + 1]!;
        if (relative) {
          cursorX += dxArg;
          cursorY += dyArg;
        } else {
          cursorX = dxArg;
          cursorY = dyArg;
        }
        if (i === 0) {
          subpathStartX = cursorX;
          subpathStartY = cursorY;
        }
      }
      output.push(tok);
      continue;
    }

    if (op === 'Z' || op === 'z') {
      cursorX = subpathStartX;
      cursorY = subpathStartY;
      output.push(tok);
      continue;
    }

    if (op === 'A' || op === 'a') {
      // A/a aceita múltiplos sets de 7 args. Cada set é um arco.
      const relative = op === 'a';
      for (let i = 0; i < args.length; i += 7) {
        const rx = Math.abs(args[i]!);
        const ry = Math.abs(args[i + 1]!);
        const xAxisRotDeg = args[i + 2]!;
        const largeArcFlag = args[i + 3]! !== 0;
        const sweepFlag = args[i + 4]! !== 0;
        let endX = args[i + 5]!;
        let endY = args[i + 6]!;
        if (relative) {
          endX += cursorX;
          endY += cursorY;
        }
        const cubicSegments = arcToCubics(
          cursorX,
          cursorY,
          rx,
          ry,
          xAxisRotDeg,
          largeArcFlag,
          sweepFlag,
          endX,
          endY
        );
        for (const seg of cubicSegments) {
          output.push({
            op: 'C',
            args: [seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.end.x, seg.end.y],
          });
        }
        cursorX = endX;
        cursorY = endY;
      }
      continue;
    }

    // Comandos sem A — atualiza cursor consumindo cada sub-segmento e passa adiante.
    const updated = advanceCursor(op, args, cursorX, cursorY);
    cursorX = updated.x;
    cursorY = updated.y;
    output.push(tok);
  }

  return serializePath(output);
}

/**
 * Avança o cursor ao consumir TODOS os sub-segmentos de um comando SVG
 * (exceto A/M/Z que são tratados separadamente). Retorna o cursor final.
 *
 * Tabela de strides (números por sub-segmento) e índices do endpoint dentro
 * do sub-segmento:
 *   L/l: 2 nums  [x y]            → endpoint (0, 1)
 *   H/h: 1 num   [x]              → atualiza só X
 *   V/v: 1 num   [y]              → atualiza só Y
 *   C/c: 6 nums  [x1 y1 x2 y2 x y] → endpoint (4, 5)
 *   S/s: 4 nums  [x2 y2 x y]      → endpoint (2, 3)
 *   Q/q: 4 nums  [x1 y1 x y]      → endpoint (2, 3)
 *   T/t: 2 nums  [x y]            → endpoint (0, 1)
 *
 * Para comandos minúsculos (relativos), o sub-segmento é relativo ao cursor
 * IMEDIATAMENTE anterior (que pode ser o cursor da sub-segmento anterior do
 * mesmo comando).
 */
function advanceCursor(op: string, args: number[], startX: number, startY: number): Point2D {
  let x = startX;
  let y = startY;
  const lower = op.toLowerCase();
  const relative = op === lower;

  if (lower === 'h') {
    for (const v of args) x = relative ? x + v : v;
    return { x, y };
  }
  if (lower === 'v') {
    for (const v of args) y = relative ? y + v : v;
    return { x, y };
  }

  const layout = COMMAND_LAYOUT[lower];
  if (!layout) return { x, y };
  const { size, endX, endY } = layout;
  for (let i = 0; i + size <= args.length; i += size) {
    const dxArg = args[i + endX]!;
    const dyArg = args[i + endY]!;
    if (relative) {
      x += dxArg;
      y += dyArg;
    } else {
      x = dxArg;
      y = dyArg;
    }
  }
  return { x, y };
}

const COMMAND_LAYOUT: Record<string, { size: number; endX: number; endY: number }> = {
  l: { size: 2, endX: 0, endY: 1 },
  c: { size: 6, endX: 4, endY: 5 },
  s: { size: 4, endX: 2, endY: 3 },
  q: { size: 4, endX: 2, endY: 3 },
  t: { size: 2, endX: 0, endY: 1 },
};

/**
 * Converte um único arco SVG (endpoint parameterization) em N cubic Béziers,
 * onde N é tal que cada Bézier cobre no máximo 90° (split sempre que necessário).
 *
 * Algoritmo: W3C SVG 1.1 §F.6.5 (endpoint → center) + kappa ótimo para
 * aproximação cubic-Bézier de arco circular/elíptico.
 *
 * Retorna lista de segmentos cubic. Lista vazia se o arco é degenerado
 * (raio zero, endpoints coincidentes, etc).
 */
export function arcToCubics(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  xAxisRotDeg: number,
  largeArcFlag: boolean,
  sweepFlag: boolean,
  x2: number,
  y2: number
): Array<{ cp1: Point2D; cp2: Point2D; end: Point2D }> {
  // Degenerate: endpoints coincidentes → arco vira ponto, ignora.
  if (Math.abs(x1 - x2) < 1e-12 && Math.abs(y1 - y2) < 1e-12) return [];
  // Degenerate: raio zero → SVG spec diz tratar como linha reta.
  if (rxIn === 0 || ryIn === 0) {
    // Emite cubic degenerada (linha).
    const dx = x2 - x1;
    const dy = y2 - y1;
    return [
      {
        cp1: { x: x1 + dx / 3, y: y1 + dy / 3 },
        cp2: { x: x1 + (2 * dx) / 3, y: y1 + (2 * dy) / 3 },
        end: { x: x2, y: y2 },
      },
    ];
  }

  const phi = (xAxisRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Passo 1: ponto médio em sistema de coordenadas rotacionado.
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Passo 2: corrige raios se necessário (W3C §F.6.6).
  let rx = rxIn;
  let ry = ryIn;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Passo 3: centro em sistema rotacionado.
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (factor * (rx * y1p)) / ry;
  const cyp = (factor * (-ry * x1p)) / rx;

  // Passo 4: centro em sistema original.
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Passo 5: ângulos inicial e delta.
  const startAngle = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let deltaAngle = angleBetween(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );
  if (!sweepFlag && deltaAngle > 0) deltaAngle -= 2 * Math.PI;
  if (sweepFlag && deltaAngle < 0) deltaAngle += 2 * Math.PI;

  // Passo 6: split em segmentos ≤ π/4 (45°).
  // Limite mais estrito que π/2 — 1 cubic para 90° tem erro ~0.027 × r
  // (vários mm em raios grandes); para 45° o erro cai para ~0.00027 × r
  // (sub-micron para raios de broche). Para um quarto-círculo isso resulta
  // em split em 2 segmentos de 45° cada.
  const segments = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 4)));
  const segAngle = deltaAngle / segments;

  // kappa ótimo para um segmento de ângulo θ:
  //   k = (4/3) * tan(θ/4)
  // Para θ=π/2 isso dá k ≈ 0.5523 (a constante "kappa clássica").
  // Para θ menores o erro cai rapidamente.
  const result: Array<{ cp1: Point2D; cp2: Point2D; end: Point2D }> = [];
  for (let i = 0; i < segments; i++) {
    const a0 = startAngle + i * segAngle;
    const a1 = a0 + segAngle;
    const k = (4 / 3) * Math.tan(segAngle / 4);

    // Pontos no círculo unitário (sistema rotacionado).
    const cosA0 = Math.cos(a0);
    const sinA0 = Math.sin(a0);
    const cosA1 = Math.cos(a1);
    const sinA1 = Math.sin(a1);

    // Control points e endpoint em ELÍPSE rotacionada (sistema unitário).
    // p1 = (cosA0, sinA0) é o endpoint inicial — já está no cursor, omitido aqui.
    const p2xUnit = cosA0 - k * sinA0;
    const p2yUnit = sinA0 + k * cosA0;
    const p3xUnit = cosA1 + k * sinA1;
    const p3yUnit = sinA1 - k * cosA1;
    const p4xUnit = cosA1;
    const p4yUnit = sinA1;

    // Aplica raios + rotação + translação.
    const transform = (xu: number, yu: number): Point2D => {
      const xe = xu * rx;
      const ye = yu * ry;
      const xr = cosPhi * xe - sinPhi * ye;
      const yr = sinPhi * xe + cosPhi * ye;
      return { x: xr + cx, y: yr + cy };
    };

    // p1 é o endpoint inicial (cursor atual no path) — não vai no output, só
    // confirma que coincide com cursor; aqui usamos só cp1/cp2/end.
    const cp1 = transform(p2xUnit, p2yUnit);
    const cp2 = transform(p3xUnit, p3yUnit);
    const end = transform(p4xUnit, p4yUnit);
    result.push({ cp1, cp2, end });
  }

  return result;
}

/** Ângulo (em rad) entre dois vetores 2D, com sinal. */
function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
  if (ux * vy - uy * vx < 0) ang = -ang;
  return ang;
}

// ── Re-exports para tornar este módulo "auto-suficiente" como ponte ──────────

export type { SplineInput } from './dxf-spline-encoder';
export type { DxfProcess } from './dxf-process-color';
