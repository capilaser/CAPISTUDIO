/**
 * Testes do flip Y SVG → DXF (Onda DXF-2.5, ADR 020 §6 revisada).
 *
 * Verifica:
 *   - y' = bounds.maxY - y (fórmula básica)
 *   - X preservado
 *   - process e closed preservados
 *   - bbox preservado (Y continua em [0, maxY])
 *   - involution: flip duas vezes = identidade
 *   - integração com svgPathToSplines: texto desenhado para baixo no SVG fica
 *     orientado para cima no DXF
 */
import { describe, expect, it } from 'vitest';

import type { DxfBounds } from '@/core/export/dxf-document';
import { flipYInSpline, normalizeForDxf } from '@/core/export/dxf-coordinate-normalize';
import { svgPathToSplines } from '@/core/export/dxf-path-to-splines';
import type { SplineInput } from '@/core/export/dxf-spline-encoder';

const BOUNDS_60x25: DxfBounds = { minX: 0, minY: 0, maxX: 60, maxY: 25 };

const SAMPLE_SPLINE: SplineInput = {
  controlPoints: [
    { x: 0, y: 0 },
    { x: 20, y: 5 },
    { x: 40, y: 20 },
    { x: 60, y: 25 },
  ],
  closed: false,
  process: 'corte',
};

describe('flipYInSpline — flip de uma SPLINE individual', () => {
  it('y = 0 vira y = bounds.maxY (topo SVG → topo DXF)', () => {
    const flipped = flipYInSpline(SAMPLE_SPLINE, BOUNDS_60x25);
    expect(flipped.controlPoints[0]!.y).toBe(25);
  });

  it('y = bounds.maxY vira y = 0 (base SVG → base DXF)', () => {
    const flipped = flipYInSpline(SAMPLE_SPLINE, BOUNDS_60x25);
    expect(flipped.controlPoints[3]!.y).toBe(0);
  });

  it('y no meio fica no meio (y = maxY/2)', () => {
    const mid: SplineInput = {
      ...SAMPLE_SPLINE,
      controlPoints: [{ x: 30, y: 12.5 }, ...SAMPLE_SPLINE.controlPoints.slice(1)],
    };
    const flipped = flipYInSpline(mid, BOUNDS_60x25);
    expect(flipped.controlPoints[0]!.y).toBe(12.5);
  });

  it('X é preservado (sem transformação horizontal)', () => {
    const flipped = flipYInSpline(SAMPLE_SPLINE, BOUNDS_60x25);
    expect(flipped.controlPoints.map((p) => p.x)).toEqual([0, 20, 40, 60]);
  });

  it('process e closed são preservados', () => {
    const closed: SplineInput = { ...SAMPLE_SPLINE, closed: true, process: 'gravacao' };
    const flipped = flipYInSpline(closed, BOUNDS_60x25);
    expect(flipped.closed).toBe(true);
    expect(flipped.process).toBe('gravacao');
  });

  it('ordem dos control points é preservada (não inverte)', () => {
    const flipped = flipYInSpline(SAMPLE_SPLINE, BOUNDS_60x25);
    // cp[0] depois do flip ainda é o transformado do cp[0] original.
    expect(flipped.controlPoints[0]).toEqual({ x: 0, y: 25 });
    expect(flipped.controlPoints[3]).toEqual({ x: 60, y: 0 });
  });

  it('flip duas vezes recupera a SPLINE original (involution)', () => {
    const once = flipYInSpline(SAMPLE_SPLINE, BOUNDS_60x25);
    const twice = flipYInSpline(once, BOUNDS_60x25);
    expect(twice.controlPoints).toEqual(SAMPLE_SPLINE.controlPoints);
  });

  it('bounds com maxY diferente espelha em torno do meio correto', () => {
    const bounds100: DxfBounds = { minX: 0, minY: 0, maxX: 60, maxY: 100 };
    const flipped = flipYInSpline(SAMPLE_SPLINE, bounds100);
    // y=0 → 100, y=5 → 95, y=20 → 80, y=25 → 75
    expect(flipped.controlPoints.map((p) => p.y)).toEqual([100, 95, 80, 75]);
  });
});

describe('normalizeForDxf — aplica flip Y a uma lista de SPLINEs', () => {
  it('lista vazia retorna lista vazia', () => {
    expect(normalizeForDxf([], BOUNDS_60x25)).toEqual([]);
  });

  it('preserva ordem e quantidade', () => {
    const splines = [
      { ...SAMPLE_SPLINE, process: 'corte' as const },
      { ...SAMPLE_SPLINE, process: 'gravacao' as const },
      { ...SAMPLE_SPLINE, process: 'marcacao' as const },
    ];
    const flipped = normalizeForDxf(splines, BOUNDS_60x25);
    expect(flipped.length).toBe(3);
    expect(flipped.map((s) => s.process)).toEqual(['corte', 'gravacao', 'marcacao']);
  });

  it('cada SPLINE é flipada individualmente', () => {
    const splines = [
      SAMPLE_SPLINE,
      {
        ...SAMPLE_SPLINE,
        controlPoints: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 30, y: 10 },
          { x: 40, y: 10 },
        ],
      },
    ];
    const flipped = normalizeForDxf(splines, BOUNDS_60x25);
    expect(flipped[1]!.controlPoints.every((p) => p.y === 15)).toBe(true); // 25-10
  });
});

describe('integração — texto desenhado para baixo no SVG fica para cima no DXF', () => {
  it('"L" desenhado da esquerda-baixo para esquerda-cima em SVG aparece invertido após flip', () => {
    // L em SVG: começa em (10, 5) [topo da haste vertical] e desce até (10, 20)
    // [base da haste]. No SVG, Y cresce para baixo, então a haste vai DE CIMA
    // PARA BAIXO. Depois do flip, deve ir DE BAIXO PARA CIMA.
    const splines = svgPathToSplines('M 10 5 L 10 20', { process: 'gravacao' });
    const flipped = normalizeForDxf(splines, BOUNDS_60x25);
    // O 1º control point original em y=5 → após flip = 25-5 = 20.
    // O último em y=20 → 25-20 = 5.
    expect(flipped[0]!.controlPoints[0]).toEqual({ x: 10, y: 20 });
    expect(flipped[0]!.controlPoints[3]).toEqual({ x: 10, y: 5 });
  });

  it('texto "T" (subpath barra superior + subpath haste) preserva alinhamento relativo após flip', () => {
    // T: barra de (0,6)-(8,6) + haste de (4,6)-(4,18). Letter height = 12mm.
    const d = 'M 0 6 L 8 6 M 4 6 L 4 18';
    const splines = svgPathToSplines(d, { process: 'gravacao' });
    const flipped = normalizeForDxf(splines, BOUNDS_60x25);

    // No SVG, barra está em Y=6 (acima da haste que vai de Y=6 a Y=18).
    // No DXF flipado: barra vira Y=25-6=19; haste vira Y entre 25-6=19 e 25-18=7.
    // Resultado: barra em Y=19 (acima), haste pendurada para baixo Y=7..19.
    // RDWorks lê Y para cima → barra fica visualmente no TOPO, haste pra BAIXO.
    // Isso é o "T" orientado CORRETAMENTE.
    const barra = flipped[0]!; // 1ª SPLINE = barra horizontal
    const haste = flipped[1]!; // 2ª SPLINE = haste vertical
    expect(barra.controlPoints.every((p) => p.y === 19)).toBe(true);
    expect(haste.controlPoints[0]!.y).toBe(19); // ponto de cima da haste
    expect(haste.controlPoints[3]!.y).toBe(7); // ponto de baixo da haste
    // Ambos compartilham Y=19 (barra inteira + topo da haste = junção do T).
  });

  it('bbox da geometria após flip continua dentro de [0, maxY]', () => {
    const splines = svgPathToSplines('M 0 0 L 60 0 L 60 25 L 0 25 Z', { process: 'corte' });
    const flipped = normalizeForDxf(splines, BOUNDS_60x25);
    for (const s of flipped) {
      for (const p of s.controlPoints) {
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(25);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(60);
      }
    }
  });
});
