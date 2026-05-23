/**
 * Testes do conversor path SVG → SplineInput[] (Sub-onda DXF-2 + stitching).
 *
 * SEMÂNTICA STITCHED (DXF text/shape contour stitching):
 *   - 1 subpath SVG (entre M..Z ou M..M) = 1 SplineInput
 *   - Control points consolidados = 3N + 1 para N segmentos Bézier
 *   - Knot vector com multiplicidade 3 nas junções (preserva cantos)
 *
 * Cobre:
 *   - L/Q/C como segmento único (1 SPLINE, 4 ctrl points)
 *   - Múltiplos segmentos no mesmo subpath (1 SPLINE, 3N+1 ctrl points)
 *   - Z fechando o subpath (closed: true)
 *   - Múltiplos subpaths (M..M, M..Z M..Z) → múltiplas SPLINEs
 *   - Arco A → cubic Béziers via expandArcsInPath + stitch
 *   - Conversões matemáticas exatas (Q→C, L→cubic degenerada)
 *   - Knot vector com multiplicidade 3
 */
import { describe, expect, it } from 'vitest';

import {
  arcToCubics,
  buildBezierKnotVector,
  expandArcsInPath,
  stitchCubicsIntoSpline,
  svgPathToSplines,
  type CubicSegment,
  type PathToSplinesOptions,
} from '@/core/export/dxf-path-to-splines';
import type { Point2D } from '@/core/export/dxf-spline-encoder';

const CORTE: PathToSplinesOptions = { process: 'corte' };
const GRAVACAO: PathToSplinesOptions = { process: 'gravacao' };

/** Amostra ponto em t ∈ [0,1] de cubic Bézier (definida por 4 control points). */
function cubicAt(cp: Point2D[], t: number): Point2D {
  const [p0, p1, p2, p3] = cp as [Point2D, Point2D, Point2D, Point2D];
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

/** Amostra ponto em quadratic Bézier para validar conversão Q → C. */
function quadAt(p0: Point2D, cp: Point2D, p2: Point2D, t: number): Point2D {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
  };
}

// ── Cenário 1 — L (linha) vira cubic degenerada ─────────────────────────────
describe('cenário 1 — L (linha) vira cubic degenerada', () => {
  it('"M 0 0 L 30 0" produz 1 SPLINE com 4 control points colineares', () => {
    const splines = svgPathToSplines('M 0 0 L 30 0', CORTE);
    expect(splines.length).toBe(1);
    const cp = splines[0]!.controlPoints;
    expect(cp.length).toBe(4); // 3·1 + 1 = 4 (1 segmento)
    expect(cp[0]).toEqual({ x: 0, y: 0 });
    expect(cp[3]).toEqual({ x: 30, y: 0 });
    // Control points 1 e 2 em 1/3 e 2/3 do caminho.
    expect(cp[1]!.x).toBeCloseTo(10, 9);
    expect(cp[2]!.x).toBeCloseTo(20, 9);
    expect(cp[1]!.y).toBe(0);
    expect(cp[2]!.y).toBe(0);
  });

  it('linha resultante é geometricamente reta (sample em t=0.5 cai no ponto médio)', () => {
    const splines = svgPathToSplines('M 0 0 L 60 25', CORTE);
    const mid = cubicAt(splines[0]!.controlPoints, 0.5);
    expect(mid.x).toBeCloseTo(30, 9);
    expect(mid.y).toBeCloseTo(12.5, 9);
  });

  it('linha com comprimento zero é descartada (não emite SPLINE)', () => {
    const splines = svgPathToSplines('M 5 5 L 5 5', CORTE);
    expect(splines.length).toBe(0);
  });
});

// ── Cenário 2 — Q vira C equivalente ────────────────────────────────────────
describe('cenário 2 — Q (quadratic) vira C equivalente sem perda', () => {
  it('Q vira 1 SPLINE de 4 control points', () => {
    const splines = svgPathToSplines('M 0 0 Q 10 20 20 0', CORTE);
    expect(splines.length).toBe(1);
    expect(splines[0]!.controlPoints.length).toBe(4);
  });

  it('elevação de grau preserva a curva (sample em t=0.5 idêntico)', () => {
    const splines = svgPathToSplines('M 0 0 Q 10 20 20 0', CORTE);
    const cubic = splines[0]!.controlPoints;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const fromCubic = cubicAt(cubic, t);
      const fromQuad = quadAt({ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 0 }, t);
      expect(fromCubic.x).toBeCloseTo(fromQuad.x, 9);
      expect(fromCubic.y).toBeCloseTo(fromQuad.y, 9);
    }
  });

  it('control points cp1 e cp2 obedecem a fórmula de elevação', () => {
    // Q p0=(0,0) cp=(6,9) p2=(12,0):
    //   cp1' = (0,0) + (2/3)(6,9)   = (4, 6)
    //   cp2' = (12,0) + (2/3)(-6,9) = (8, 6)
    const splines = svgPathToSplines('M 0 0 Q 6 9 12 0', CORTE);
    const cp = splines[0]!.controlPoints;
    expect(cp[1]!.x).toBeCloseTo(4, 9);
    expect(cp[1]!.y).toBeCloseTo(6, 9);
    expect(cp[2]!.x).toBeCloseTo(8, 9);
    expect(cp[2]!.y).toBeCloseTo(6, 9);
  });
});

// ── Cenário 3 — C passa direto ───────────────────────────────────────────────
describe('cenário 3 — C (cubic) passa direto preservando pontos', () => {
  it('C produz SPLINE com exatamente os 4 control points originais', () => {
    const splines = svgPathToSplines('M 0 0 C 5 10 15 10 20 0', CORTE);
    expect(splines.length).toBe(1);
    const cp = splines[0]!.controlPoints;
    expect(cp[0]).toEqual({ x: 0, y: 0 });
    expect(cp[1]).toEqual({ x: 5, y: 10 });
    expect(cp[2]).toEqual({ x: 15, y: 10 });
    expect(cp[3]).toEqual({ x: 20, y: 0 });
  });

  it('múltiplos C em cadeia geram 1 SPLINE com 3N+1 control points', () => {
    // 2 segmentos C → 1 SPLINE com 7 control points
    const splines = svgPathToSplines('M 0 0 C 5 10 15 10 20 0 C 25 -10 35 -10 40 0', CORTE);
    expect(splines.length).toBe(1);
    const cp = splines[0]!.controlPoints;
    expect(cp.length).toBe(7); // 3·2 + 1
    expect(cp[0]).toEqual({ x: 0, y: 0 });
    expect(cp[3]).toEqual({ x: 20, y: 0 }); // endpoint do 1º segmento
    expect(cp[4]).toEqual({ x: 25, y: -10 });
    expect(cp[5]).toEqual({ x: 35, y: -10 });
    expect(cp[6]).toEqual({ x: 40, y: 0 });
  });
});

// ── Cenário 4 — H/V vira linha cubic ────────────────────────────────────────
describe('cenário 4 — H/V (horizontal/vertical) vira cubic degenerada', () => {
  it('H simplifica para L e vira cubic horizontal', () => {
    const splines = svgPathToSplines('M 0 0 H 50', CORTE);
    expect(splines.length).toBe(1);
    const cp = splines[0]!.controlPoints;
    expect(cp.length).toBe(4);
    expect(cp[0]).toEqual({ x: 0, y: 0 });
    expect(cp[3]).toEqual({ x: 50, y: 0 });
    expect(cp.every((p) => p.y === 0)).toBe(true);
  });

  it('V simplifica para L e vira cubic vertical', () => {
    const splines = svgPathToSplines('M 10 0 V 25', CORTE);
    expect(splines.length).toBe(1);
    const cp = splines[0]!.controlPoints;
    expect(cp[0]).toEqual({ x: 10, y: 0 });
    expect(cp[3]).toEqual({ x: 10, y: 25 });
    expect(cp.every((p) => p.x === 10)).toBe(true);
  });
});

// ── Cenário 5 — Z fecha o subpath ────────────────────────────────────────────
describe('cenário 5 — Z fecha o subpath corretamente', () => {
  it('"M 0 0 L 10 0 L 10 10 L 0 10 Z" → 1 SPLINE com 13 ctrl points, closed=true', () => {
    // 4 segmentos (3 L + 1 fechamento implícito do Z) → 1 SPLINE, 3·4+1 = 13 ctrl pts
    const splines = svgPathToSplines('M 0 0 L 10 0 L 10 10 L 0 10 Z', CORTE);
    expect(splines.length).toBe(1);
    const sp = splines[0]!;
    expect(sp.closed).toBe(true);
    expect(sp.controlPoints.length).toBe(13);
    // Primeiro e último control points devem coincidir nas duas pontas.
    expect(sp.controlPoints[0]).toEqual({ x: 0, y: 0 });
    expect(sp.controlPoints[12]).toEqual({ x: 0, y: 0 }); // Z fecha em (0,0)
  });

  it('Z imediato (cursor já em subpathStart) não gera segmento extra', () => {
    // 2 L explícitos. Cursor após 2º L = subpathStart → Z não emite segmento.
    const splines = svgPathToSplines('M 5 5 L 15 5 L 5 5 Z', CORTE);
    expect(splines.length).toBe(1);
    const sp = splines[0]!;
    expect(sp.closed).toBe(true);
    expect(sp.controlPoints.length).toBe(7); // 3·2 + 1 = 7 (apenas 2 segmentos)
  });

  it('subpath sem Z mantém SPLINE com closed=false', () => {
    const splines = svgPathToSplines('M 0 0 L 10 0 L 10 10', CORTE);
    expect(splines.length).toBe(1);
    expect(splines[0]!.closed).toBe(false);
    expect(splines[0]!.controlPoints.length).toBe(7); // 2 segmentos
  });
});

// ── Cenário 6 — múltiplos subpaths geram múltiplas SPLINEs ──────────────────
describe('cenário 6 — múltiplos subpaths (M..Z M..Z) geram múltiplas SPLINEs', () => {
  it('2 quadrados separados → 2 SPLINEs (1 por subpath, contornos preservados)', () => {
    const d =
      'M 0 0 L 10 0 L 10 10 L 0 10 Z ' + // quadrado pequeno
      'M 20 20 L 40 20 L 40 40 L 20 40 Z'; // quadrado grande
    const splines = svgPathToSplines(d, CORTE);
    expect(splines.length).toBe(2);
    // Cada quadrado: 4 segmentos (3 L + Z fechando) → 13 ctrl pts
    expect(splines[0]!.controlPoints.length).toBe(13);
    expect(splines[0]!.closed).toBe(true);
    expect(splines[1]!.controlPoints.length).toBe(13);
    expect(splines[1]!.closed).toBe(true);
    // 2º subpath começa em (20, 20)
    expect(splines[1]!.controlPoints[0]).toEqual({ x: 20, y: 20 });
  });

  it('subpath aberto + subpath fechado: 2 SPLINEs com flags diferentes', () => {
    const d = 'M 0 0 L 10 0 M 20 0 L 30 0 L 30 10 Z';
    const splines = svgPathToSplines(d, CORTE);
    expect(splines.length).toBe(2);
    expect(splines[0]!.closed).toBe(false); // 1º subpath aberto
    expect(splines[1]!.closed).toBe(true); // 2º subpath fechado
  });

  it('letra "O" simulada (contorno externo + hole interno) → 2 SPLINEs fechadas', () => {
    const d =
      'M 0 0 L 20 0 L 20 20 L 0 20 Z ' + // contorno externo
      'M 5 5 L 15 5 L 15 15 L 5 15 Z'; // hole
    const splines = svgPathToSplines(d, GRAVACAO);
    expect(splines.length).toBe(2);
    for (const s of splines) {
      expect(s.closed).toBe(true);
      expect(s.process).toBe('gravacao');
    }
  });
});

// ── Cenário 7 — arco A vira SPLINE via expand + stitch ──────────────────────
describe('cenário 7 — arco A vira SPLINE única com vários control points', () => {
  it('arco gera SPLINE única (não múltiplas SPLINEs por segmento)', () => {
    const splines = svgPathToSplines('M 0 0 A 10 10 0 0 1 10 10', CORTE);
    expect(splines.length).toBe(1);
    // 1 quarto-círculo split em 2×45° (expandArcsInPath usa π/4) = 2 cubics
    // → 3·2 + 1 = 7 control points
    expect(splines[0]!.controlPoints.length).toBe(7);
  });

  it('arco aproxima um quarto-círculo com erro < 0.005mm', () => {
    const splines = svgPathToSplines('M 0 0 A 10 10 0 0 1 10 10', CORTE);
    const sp = splines[0]!;
    // Amostra os 2 segmentos cubic individuais (control points [0..3] e [3..6]).
    const seg1 = sp.controlPoints.slice(0, 4);
    const seg2 = sp.controlPoints.slice(3, 7);
    const cx = 0;
    const cy = 10;
    const r = 10;
    for (const cp of [seg1, seg2]) {
      for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const pt = cubicAt(cp, t);
        const dist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
        expect(Math.abs(dist - r)).toBeLessThan(0.005);
      }
    }
  });
});

// ── Cenário 8 — paths típicos de glyph de opentype.js ───────────────────────
describe('cenário 8 — paths típicos de glyph com mistura de comandos', () => {
  it('path letra com 2 contornos → 2 SPLINEs (não 8)', () => {
    const d =
      'M 0 0 L 20 0 L 20 20 L 0 20 Z ' + // externo
      'M 5 5 L 15 5 L 15 15 L 5 15 Z'; // hole
    const splines = svgPathToSplines(d, GRAVACAO);
    expect(splines.length).toBe(2);
  });

  it('path com mistura C + L (curva real de letra) → 1 SPLINE única', () => {
    // M C L C Z. Segmentos: C, L, C, fechamento_implícito (cursor (0,20) → start (0,10))
    // = 4 segmentos → 3·4 + 1 = 13 control points.
    const d = 'M 0 10 C 0 0 10 0 10 10 L 10 20 C 10 30 0 30 0 20 Z';
    const splines = svgPathToSplines(d, GRAVACAO);
    expect(splines.length).toBe(1);
    expect(splines[0]!.closed).toBe(true);
    expect(splines[0]!.controlPoints.length).toBe(13);
  });
});

// ── Cenário 9 — anti-regressão (ADR 020 §2, §3) ──────────────────────────────
describe('cenário 9 — invariantes anti-regressão (ADR 020 §2, §3)', () => {
  it('SplineInput tem APENAS controlPoints / closed / process / knots', () => {
    const splines = svgPathToSplines('M 0 0 L 10 10 C 15 10 15 20 10 20 Z', CORTE);
    for (const s of splines) {
      const keys = Object.keys(s).sort();
      // Schema novo (stitched): inclui `knots` opcional preenchido.
      expect(keys).toEqual(['closed', 'controlPoints', 'knots', 'process']);
    }
  });

  it('control points sempre = 3N + 1 para N segmentos', () => {
    const cases: Array<{ d: string; expectedN: number }> = [
      { d: 'M 0 0 L 10 0', expectedN: 1 },
      { d: 'M 0 0 Q 5 10 10 0', expectedN: 1 },
      { d: 'M 0 0 C 5 10 15 10 20 0', expectedN: 1 },
      { d: 'M 0 0 H 10', expectedN: 1 },
      { d: 'M 0 0 V 10', expectedN: 1 },
      { d: 'M 0 0 L 10 0 L 10 10 L 0 10 Z', expectedN: 4 }, // 3 L + Z(close)
    ];
    for (const { d, expectedN } of cases) {
      const splines = svgPathToSplines(d, CORTE);
      for (const s of splines) {
        expect(s.controlPoints.length).toBe(3 * expectedN + 1);
      }
    }
  });

  it('knot vector tem tamanho correto: n + p + 1', () => {
    const splines = svgPathToSplines('M 0 0 L 10 0 L 10 10 Z', CORTE);
    const sp = splines[0]!;
    const n = sp.controlPoints.length;
    expect(sp.knots).toBeDefined();
    expect(sp.knots!.length).toBe(n + 3 + 1);
  });
});

// ── Cenário 10 — coordenadas em mm preservadas ──────────────────────────────
describe('cenário 10 — coordenadas em mm preservadas', () => {
  it('valores numéricos do path entram inalterados como mm', () => {
    const splines = svgPathToSplines('M 0 0 L 60 25', CORTE);
    expect(splines[0]!.controlPoints[0]).toEqual({ x: 0, y: 0 });
    expect(splines[0]!.controlPoints[3]).toEqual({ x: 60, y: 25 });
  });

  it('Y preservado SEM flip (svgPathToSplines é geometria pura)', () => {
    const splines = svgPathToSplines('M 0 0 L 30 25', CORTE);
    expect(splines[0]!.controlPoints[3]!.y).toBe(25);
  });

  it('coordenadas fracionárias preservadas exatamente', () => {
    const splines = svgPathToSplines('M 0.123 4.567 L 8.901 23.456', CORTE);
    expect(splines[0]!.controlPoints[0]).toEqual({ x: 0.123, y: 4.567 });
    expect(splines[0]!.controlPoints[3]).toEqual({ x: 8.901, y: 23.456 });
  });
});

// ── Expansão de arco — testes diretos do helper ─────────────────────────────
describe('expandArcsInPath — substitui A/a por sequência de C', () => {
  it('path sem arco passa idêntico (idempotente em estrutura)', () => {
    const out = expandArcsInPath('M 0 0 L 10 0 C 5 5 8 8 10 10 Z');
    expect(out).not.toContain(' A ');
    expect(out).not.toContain(' a ');
    expect(out).toContain('M');
    expect(out).toContain('L');
    expect(out).toContain('C');
    expect(out).toContain('Z');
  });

  it('arco absoluto A é substituído por C(s)', () => {
    const out = expandArcsInPath('M 0 0 A 10 10 0 0 1 10 10');
    expect(out).not.toContain(' A ');
    expect(out).toContain('C');
  });

  it('arco relativo a é substituído por C absoluto (cursor rastreado)', () => {
    const out = expandArcsInPath('M 5 5 a 10 10 0 0 1 10 10');
    expect(out).not.toContain(' a ');
    expect(out).toContain('C');
    const lastNumbers = out.match(/-?\d+\.?\d*/g);
    const lastY = parseFloat(lastNumbers![lastNumbers!.length - 1]!);
    expect(lastY).toBeCloseTo(15, 6);
  });

  it('múltiplos arcos em sequência todos são expandidos', () => {
    const out = expandArcsInPath('M 0 0 A 5 5 0 0 1 5 5 A 5 5 0 0 1 10 0');
    expect(out).not.toMatch(/[Aa] /);
    const cCount = (out.match(/\bC\b/g) ?? []).length;
    expect(cCount).toBeGreaterThanOrEqual(2);
  });

  it('rastreia cursor após L antes do arco', () => {
    const out = expandArcsInPath('M 0 0 L 20 20 A 5 5 0 0 1 25 25');
    const nums = out.match(/-?\d+\.?\d*/g)!;
    const lastY = parseFloat(nums[nums.length - 1]!);
    expect(lastY).toBeCloseTo(25, 6);
  });
});

describe('arcToCubics — algoritmo W3C §F.6.5 + split em ≤ π/4', () => {
  it('quarto-círculo (90°) gera 2 segmentos (split em 45°)', () => {
    const segs = arcToCubics(0, 0, 10, 10, 0, false, true, 10, 10);
    expect(segs.length).toBe(2);
  });

  it('semi-círculo (180°) gera 4 segmentos', () => {
    const segs = arcToCubics(0, 0, 10, 10, 0, false, true, 20, 0);
    expect(segs.length).toBe(4);
  });

  it('arco de 270° (large-arc) gera 6 segmentos', () => {
    const segs = arcToCubics(0, 0, 10, 10, 0, true, true, 10, 10);
    expect(segs.length).toBe(6);
  });

  it('endpoint do último segmento bate com o endpoint solicitado', () => {
    const segs = arcToCubics(0, 0, 10, 10, 0, false, true, 10, 10);
    const lastEnd = segs[segs.length - 1]!.end;
    expect(lastEnd.x).toBeCloseTo(10, 9);
    expect(lastEnd.y).toBeCloseTo(10, 9);
  });

  it('arco degenerado (endpoints coincidentes) retorna []', () => {
    const segs = arcToCubics(5, 5, 10, 10, 0, false, true, 5, 5);
    expect(segs).toEqual([]);
  });

  it('raio zero é tratado como linha reta (1 cubic degenerada)', () => {
    const segs = arcToCubics(0, 0, 0, 0, 0, false, true, 10, 0);
    expect(segs.length).toBe(1);
    expect(segs[0]!.end).toEqual({ x: 10, y: 0 });
  });
});

// ── stitchCubicsIntoSpline + buildBezierKnotVector ──────────────────────────
describe('stitchCubicsIntoSpline — agrupa N cubics em 1 SPLINE com knots multiplicidade 3', () => {
  const mkSeg = (a: number): CubicSegment => ({
    p0: { x: a, y: 0 },
    p1: { x: a + 1, y: 1 },
    p2: { x: a + 2, y: 1 },
    p3: { x: a + 3, y: 0 },
  });

  it('1 segmento → 4 control points, 8 knots clamped', () => {
    const s = stitchCubicsIntoSpline([mkSeg(0)], false, 'corte')!;
    expect(s.controlPoints.length).toBe(4);
    expect(s.knots!.length).toBe(8);
    // Clamped padrão: [0,0,0,0,1,1,1,1]
    expect(s.knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('2 segmentos → 7 control points, 11 knots com junção em 0.5 multiplicidade 3', () => {
    const s = stitchCubicsIntoSpline([mkSeg(0), mkSeg(3)], false, 'corte')!;
    expect(s.controlPoints.length).toBe(7);
    expect(s.knots!.length).toBe(11);
    expect(s.knots).toEqual([0, 0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1, 1]);
  });

  it('3 segmentos → 10 control points, 14 knots com junções 1/3 e 2/3', () => {
    const s = stitchCubicsIntoSpline([mkSeg(0), mkSeg(3), mkSeg(6)], false, 'corte')!;
    expect(s.controlPoints.length).toBe(10);
    expect(s.knots!.length).toBe(14);
    // [0,0,0,0, 1/3,1/3,1/3, 2/3,2/3,2/3, 1,1,1,1]
    expect(s.knots!.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(s.knots!.slice(-4)).toEqual([1, 1, 1, 1]);
    expect(s.knots!.slice(4, 7).every((k) => Math.abs(k - 1 / 3) < 1e-12)).toBe(true);
    expect(s.knots!.slice(7, 10).every((k) => Math.abs(k - 2 / 3) < 1e-12)).toBe(true);
  });

  it('closed flag propagada', () => {
    const s = stitchCubicsIntoSpline([mkSeg(0)], true, 'gravacao')!;
    expect(s.closed).toBe(true);
    expect(s.process).toBe('gravacao');
  });

  it('lista vazia → null', () => {
    expect(stitchCubicsIntoSpline([], false, 'corte')).toBeNull();
  });
});

describe('buildBezierKnotVector — propriedades', () => {
  it('para 1 segmento: [0,0,0,0,1,1,1,1] (8 knots)', () => {
    expect(buildBezierKnotVector(1)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('para N segmentos: tamanho = 3N + 5', () => {
    for (const n of [1, 2, 3, 5, 10]) {
      expect(buildBezierKnotVector(n).length).toBe(3 * n + 5);
    }
  });

  it('para N segmentos: primeiros e últimos 4 knots são 0 e 1', () => {
    const k = buildBezierKnotVector(5);
    expect(k.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(k.slice(-4)).toEqual([1, 1, 1, 1]);
  });

  it('knots monotonicamente não-decrescentes', () => {
    const k = buildBezierKnotVector(7);
    for (let i = 1; i < k.length; i++) {
      expect(k[i]).toBeGreaterThanOrEqual(k[i - 1]!);
    }
  });

  it('segmentCount = 0 throw', () => {
    expect(() => buildBezierKnotVector(0)).toThrow();
  });
});

// ── Robustez ────────────────────────────────────────────────────────────────
describe('robustez', () => {
  it('path vazio retorna []', () => {
    expect(svgPathToSplines('', CORTE)).toEqual([]);
  });

  it('path com só M (sem segmento) retorna []', () => {
    expect(svgPathToSplines('M 10 10', CORTE)).toEqual([]);
  });

  it('process é propagado para todas as SPLINEs', () => {
    const splines = svgPathToSplines('M 0 0 L 10 0 C 15 0 20 5 20 10 Q 10 15 0 10 Z', {
      process: 'marcacao',
    });
    expect(splines.length).toBe(1);
    expect(splines[0]!.process).toBe('marcacao');
  });

  it('saída passa para encodeSpline sem throw (smoke integration)', async () => {
    const { encodeSpline } = await import('@/core/export/dxf-spline-encoder');
    const splines = svgPathToSplines('M 0 0 L 60 0 L 60 25 L 0 25 Z', CORTE);
    expect(splines.length).toBe(1);
    const lines = encodeSpline(splines[0]!);
    expect(lines[0]!.trim()).toBe('0');
    expect(lines[1]).toBe('SPLINE');
  });

  it('preserva subpathStart após múltiplos M consecutivos', () => {
    // 2 subpaths separados: M..L (aberto) + M..L..Z (fechado).
    const d = 'M 0 0 L 5 5 M 10 10 L 15 15 Z';
    const splines = svgPathToSplines(d, CORTE);
    expect(splines.length).toBe(2);
    expect(splines[0]!.closed).toBe(false);
    expect(splines[1]!.closed).toBe(true);
    // 2º subpath fechado: L (10,10)→(15,15) + Z fechando (15,15)→(10,10) = 2 segs = 7 ctrl pts
    expect(splines[1]!.controlPoints.length).toBe(7);
    // Último control point volta para (10, 10) (subpathStart).
    expect(splines[1]!.controlPoints[6]).toEqual({ x: 10, y: 10 });
  });
});

// ── Conformidade ADR 020 §2 — gera APENAS SPLINE no document final ──────────
describe('conformidade ADR 020 §2 (re-anchored com stitching)', () => {
  it('encode → document gera APENAS SPLINE (sem POLYLINE/LINE/etc)', async () => {
    const { encodeSpline } = await import('@/core/export/dxf-spline-encoder');
    const { buildDxfDocument } = await import('@/core/export/dxf-document');
    const splines = svgPathToSplines('M 0 0 L 60 0 L 60 25 L 0 25 Z', CORTE);
    const splineLines = splines.map((s) => encodeSpline(s));
    const dxf = buildDxfDocument({
      bounds: { minX: 0, minY: 0, maxX: 60, maxY: 25 },
      splineEntities: splineLines,
    });
    expect(dxf).not.toContain('\nPOLYLINE\r\n');
    expect(dxf).not.toContain('\nLWPOLYLINE\r\n');
    expect(dxf).not.toContain('\nTEXT\r\n');
    expect(dxf).not.toContain('\nMTEXT\r\n');
    expect(dxf).not.toContain('\nLINE\r\n');
    expect(dxf).not.toContain('\nARC\r\n');
    expect(dxf).not.toContain('\nCIRCLE\r\n');
    expect(dxf).toContain('SPLINE');
    // STITCHING: 1 contorno fechado = 1 SPLINE (não 4 do quadrado).
    const splineMatches = dxf.match(/\r\n\s*0\r\nSPLINE\r\n/g);
    expect(splineMatches?.length).toBe(1);
  });
});
