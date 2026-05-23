/**
 * Testes do encoder SPLINE (ADR 020 §2, sub-onda DXF-1).
 *
 * Anatomia esperada (baseada na primeira SPLINE do DXF real de referência):
 *   - Tipo: 0/SPLINE
 *   - Layer: 8/Camada 1
 *   - Cor: 62/{31|250|5} conforme processo
 *   - Subclasses: 100/AcDbEntity + 100/AcDbSpline
 *   - Normal: 210/0 220/0 230/1 (planar)
 *   - Flags 70: 8 (aberta) ou 11 (fechada+periodic+planar)
 *   - Grau 71: 3
 *   - Knot count 72 = n_ctrl + degree + 1
 *   - Ctrl count 73 = n control points
 *   - Fit count 74: 0
 *   - Tolerâncias 42/43: 1e-10
 *   - Knot values 40 × n_knots: clamped [0,1]
 *   - Control points (10, 20, 30) × n_ctrl com Z=0
 */
import { describe, expect, it } from 'vitest';

import {
  encodeSpline,
  generateClampedKnots,
  SINGLE_LAYER_NAME,
  type Point2D,
} from '@/core/export/dxf-spline-encoder';

/**
 * Parser ingênuo: array de linhas (output do encodeSpline) → array de pares.
 */
function parse(lines: string[]): Array<{ code: number; value: string }> {
  const out: Array<{ code: number; value: string }> = [];
  for (let i = 0; i < lines.length; i += 2) {
    out.push({ code: parseInt(lines[i]!.trim(), 10), value: lines[i + 1]! });
  }
  return out;
}

function pair(code: number, value: string) {
  return { code, value };
}

/** 4 control points = mínimo legal para grau 3. Quadrado simples. */
const SQUARE_4: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('encodeSpline — estrutura básica', () => {
  it('emite cabeçalho SPLINE com layer "Camada 1"', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    expect(tokens[0]).toEqual(pair(0, 'SPLINE'));
    expect(tokens.find((t) => t.code === 8)).toEqual(pair(8, SINGLE_LAYER_NAME));
  });

  it('emite as 2 subclasses AcDbEntity e AcDbSpline (código 100)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    const subclasses = tokens.filter((t) => t.code === 100).map((t) => t.value);
    expect(subclasses).toEqual(['AcDbEntity', 'AcDbSpline']);
  });

  it('vetor normal planar (0, 0, 1) via códigos 210/220/230', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    expect(tokens.find((t) => t.code === 210)?.value).toBe('0');
    expect(tokens.find((t) => t.code === 220)?.value).toBe('0');
    expect(tokens.find((t) => t.code === 230)?.value).toBe('1');
  });

  it('grau 71 sempre = 3 (cubic)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    expect(tokens.find((t) => t.code === 71)?.value).toBe('3');
  });

  it('fit points (código 74) sempre = 0 (control-points-only)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    expect(tokens.find((t) => t.code === 74)?.value).toBe('0');
  });

  it('tolerâncias 42/43 = 1e-10 (espelham o DXF real)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    const tol42 = tokens.find((t) => t.code === 42)?.value;
    const tol43 = tokens.find((t) => t.code === 43)?.value;
    expect(parseFloat(tol42!)).toBeCloseTo(1e-10, 15);
    expect(parseFloat(tol43!)).toBeCloseTo(1e-10, 15);
  });
});

describe('encodeSpline — cor por processo (código 62)', () => {
  it('corte → 31', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    expect(parse(lines).find((t) => t.code === 62)?.value).toBe('31');
  });

  it('gravacao → 250', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'gravacao' });
    expect(parse(lines).find((t) => t.code === 62)?.value).toBe('250');
  });

  it('marcacao → 5', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'marcacao' });
    expect(parse(lines).find((t) => t.code === 62)?.value).toBe('5');
  });
});

describe('encodeSpline — flags closed/open (código 70)', () => {
  it('aberta → 8 (planar only)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    expect(parse(lines).find((t) => t.code === 70)?.value).toBe('8');
  });

  it('fechada → 11 (closed + periodic + planar — bate com DXF real)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: true, process: 'corte' });
    expect(parse(lines).find((t) => t.code === 70)?.value).toBe('11');
  });
});

describe('encodeSpline — control points e knots', () => {
  it('control point count (código 73) = n', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    expect(parse(lines).find((t) => t.code === 73)?.value).toBe('4');
  });

  it('knot count (código 72) = n + degree + 1 = 8 para n=4, p=3', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    expect(parse(lines).find((t) => t.code === 72)?.value).toBe('8');
  });

  it('emite exatamente N control points como tríades (10, 20, 30 com Z=0)', () => {
    const lines = encodeSpline({ controlPoints: SQUARE_4, closed: false, process: 'corte' });
    const tokens = parse(lines);
    const x = tokens.filter((t) => t.code === 10).map((t) => parseFloat(t.value));
    const y = tokens.filter((t) => t.code === 20).map((t) => parseFloat(t.value));
    const z = tokens.filter((t) => t.code === 30).map((t) => parseFloat(t.value));
    expect(x).toEqual([0, 10, 10, 0]);
    expect(y).toEqual([0, 0, 10, 10]);
    expect(z).toEqual([0, 0, 0, 0]); // sempre planar
  });

  it('todos os Z dos control points são 0 (planar)', () => {
    const cp: Point2D[] = [
      { x: 1.5, y: 2.5 },
      { x: 3.5, y: 4.5 },
      { x: 5.5, y: 6.5 },
      { x: 7.5, y: 8.5 },
    ];
    const lines = encodeSpline({ controlPoints: cp, closed: false, process: 'gravacao' });
    const z = parse(lines)
      .filter((t) => t.code === 30)
      .map((t) => parseFloat(t.value));
    expect(z.every((v) => v === 0)).toBe(true);
  });

  it('rejeita SPLINE com menos de degree+1 control points', () => {
    expect(() =>
      encodeSpline({
        controlPoints: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        closed: false,
        process: 'corte',
      })
    ).toThrow(/no mínimo 4/);
  });
});

describe('generateClampedKnots — propriedades matemáticas', () => {
  it('total = n + p + 1', () => {
    expect(generateClampedKnots(4, 3, false).length).toBe(8);
    expect(generateClampedKnots(25, 3, true).length).toBe(29); // ← bate com 1ª SPLINE real
    expect(generateClampedKnots(10, 3, false).length).toBe(14);
  });

  it('primeiros p+1 knots = 0 (clamping na origem)', () => {
    const knots = generateClampedKnots(10, 3, false);
    expect(knots.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it('últimos p+1 knots = 1 (clamping no fim, normalizado)', () => {
    const knots = generateClampedKnots(10, 3, false);
    expect(knots.slice(-4)).toEqual([1, 1, 1, 1]);
  });

  it('knots são monotonicamente crescentes (não-decrescentes)', () => {
    const knots = generateClampedKnots(25, 3, true);
    for (let i = 1; i < knots.length; i++) {
      expect(knots[i]).toBeGreaterThanOrEqual(knots[i - 1]!);
    }
  });

  it('knots internos estão estritamente em (0, 1)', () => {
    const knots = generateClampedKnots(10, 3, false);
    const internal = knots.slice(4, -4);
    for (const k of internal) {
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThan(1);
    }
  });

  it('caso degenerado: n = p+1 → todos knots em {0, 1} (sem internos)', () => {
    const knots = generateClampedKnots(4, 3, false);
    expect(knots).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });
});
