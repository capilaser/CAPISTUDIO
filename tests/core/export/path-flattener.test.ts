/**
 * Testes do path-flattener (Onda 18, Fase B).
 *
 * Cobre:
 *   - Linhas retas: 2 pontos exatos, sem oversample
 *   - Bézier cúbica/quadrática: N pontos dentro de tolerance
 *   - Z fecha polyline (closed=true, último=primeiro)
 *   - Múltiplos subpaths ("M ... Z M ... Z") → array de polylines
 *   - Subpath degenerado (M isolado) descartado
 *   - Tolerance afeta densidade
 */
import { describe, expect, it } from 'vitest';

import { flattenSvgPath, type FlatPolyline } from '@/core/export/path-flattener';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Máxima distância de qualquer ponto da polyline ao segmento real. */
function maxDeviationFromIdeal(
  poly: FlatPolyline,
  idealFn: (t: number) => { x: number; y: number }
): number {
  // Pra cada ponto da polyline, encontra t mais próximo no ideal e mede.
  // Sample do ideal denso pra approx ground truth.
  const idealSamples: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 1000; i++) idealSamples.push(idealFn(i / 1000));
  let maxDev = 0;
  for (const p of poly.points) {
    let min = Infinity;
    for (const q of idealSamples) {
      const d = dist(p, q);
      if (d < min) min = d;
    }
    if (min > maxDev) maxDev = min;
  }
  return maxDev;
}

describe('path-flattener (Onda 18 Fase B)', () => {
  describe('linhas retas', () => {
    it('"M 0 0 L 100 0" → 1 polyline com 2 pontos', () => {
      const result = flattenSvgPath('M 0 0 L 100 0');
      expect(result).toHaveLength(1);
      expect(result[0]!.points).toHaveLength(2);
      expect(result[0]!.points[0]).toEqual({ x: 0, y: 0 });
      expect(result[0]!.points[1]).toEqual({ x: 100, y: 0 });
      expect(result[0]!.closed).toBe(false);
    });

    it('retângulo "M 0 0 L 60 0 L 60 25 L 0 25 Z" → 1 polyline fechada com 5 pontos (4 cantos + fechamento)', () => {
      const result = flattenSvgPath('M 0 0 L 60 0 L 60 25 L 0 25 Z');
      expect(result).toHaveLength(1);
      expect(result[0]!.closed).toBe(true);
      // 4 cantos + 1 ponto de fechamento idêntico ao 1º
      expect(result[0]!.points).toHaveLength(5);
      expect(result[0]!.points[4]).toEqual(result[0]!.points[0]);
    });
  });

  describe('curvas Bézier', () => {
    it('cúbica "M 0 0 C 50 0 50 100 100 100" gera muitos pontos', () => {
      const result = flattenSvgPath('M 0 0 C 50 0 50 100 100 100');
      expect(result).toHaveLength(1);
      // Comprimento ~149mm / step 0.2 → ~745 segmentos = 746 pontos
      expect(result[0]!.points.length).toBeGreaterThan(500);
      // 1º ponto exato
      expect(result[0]!.points[0]).toEqual({ x: 0, y: 0 });
      // Último ponto ~ (100, 100) com tolerância < 0.1mm
      const last = result[0]!.points[result[0]!.points.length - 1]!;
      expect(dist(last, { x: 100, y: 100 })).toBeLessThan(0.5);
    });

    it('cúbica fica dentro de 0.1mm do path ideal', () => {
      const result = flattenSvgPath('M 0 0 C 30 0 30 60 60 60', { toleranceMm: 0.1 });
      expect(result).toHaveLength(1);
      // Função paramétrica da cúbica B(t)
      const cubic = (t: number) => {
        const u = 1 - t;
        const x = u * u * u * 0 + 3 * u * u * t * 30 + 3 * u * t * t * 30 + t * t * t * 60;
        const y = u * u * u * 0 + 3 * u * u * t * 0 + 3 * u * t * t * 60 + t * t * t * 60;
        return { x, y };
      };
      const dev = maxDeviationFromIdeal(result[0]!, cubic);
      // step = tolerance × 2 = 0.2; chord error num passo cabe < tolerance
      expect(dev).toBeLessThan(0.1);
    });

    it('tolerance menor → mais pontos', () => {
      const r1 = flattenSvgPath('M 0 0 C 50 0 50 100 100 100', { toleranceMm: 0.5 });
      const r2 = flattenSvgPath('M 0 0 C 50 0 50 100 100 100', { toleranceMm: 0.05 });
      expect(r2[0]!.points.length).toBeGreaterThan(r1[0]!.points.length * 5);
    });

    it('quadrática "M 0 0 Q 50 100 100 0" gera polyline densa', () => {
      const result = flattenSvgPath('M 0 0 Q 50 100 100 0');
      expect(result).toHaveLength(1);
      expect(result[0]!.points.length).toBeGreaterThan(100);
      // Endpoints
      expect(result[0]!.points[0]).toEqual({ x: 0, y: 0 });
      const last = result[0]!.points[result[0]!.points.length - 1]!;
      expect(dist(last, { x: 100, y: 0 })).toBeLessThan(0.5);
    });
  });

  describe('múltiplos subpaths (path com furo)', () => {
    it('"M 0 0 L 60 0 L 60 25 L 0 25 Z M 10 5 L 20 5 L 20 15 L 10 15 Z" → 2 polylines fechadas', () => {
      const result = flattenSvgPath(
        'M 0 0 L 60 0 L 60 25 L 0 25 Z M 10 5 L 20 5 L 20 15 L 10 15 Z'
      );
      expect(result).toHaveLength(2);
      expect(result[0]!.closed).toBe(true);
      expect(result[1]!.closed).toBe(true);
      // 1ª polyline: borda externa (60×25)
      expect(result[0]!.points[0]).toEqual({ x: 0, y: 0 });
      // 2ª polyline: furo interno (10..20 × 5..15)
      expect(result[1]!.points[0]).toEqual({ x: 10, y: 5 });
    });

    it('subpath sem Z final no último → ainda flush', () => {
      const result = flattenSvgPath('M 0 0 L 10 10 M 20 20 L 30 30');
      expect(result).toHaveLength(2);
      expect(result[0]!.closed).toBe(false);
      expect(result[1]!.closed).toBe(false);
      expect(result[1]!.points).toEqual([
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ]);
    });
  });

  describe('casos degenerados', () => {
    it('path vazio → array vazio', () => {
      expect(flattenSvgPath('')).toEqual([]);
    });

    it('só "M 0 0" (ponto solto) → descartado (< 2 pontos)', () => {
      expect(flattenSvgPath('M 0 0')).toEqual([]);
    });

    it('"M 0 0 Z" (M+Z sem L/C) → polyline degenerada descartada', () => {
      // Após Z, current tem só [{0,0}] + possivelmente fechamento.
      // Fechamento adiciona o subpathStart se != último → mas é o mesmo ponto,
      // então pushDistinct rejeita. Resultado: 1 ponto, descartado.
      expect(flattenSvgPath('M 0 0 Z')).toEqual([]);
    });

    it('pontos duplicados consecutivos são colapsados', () => {
      // "L 50 0 L 50 0 L 100 0" → o L duplicado vira ponto idêntico.
      const result = flattenSvgPath('M 0 0 L 50 0 L 50 0 L 100 0');
      expect(result).toHaveLength(1);
      expect(result[0]!.points).toEqual([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]);
    });
  });

  describe('uso realista — outline de broche', () => {
    it('círculo aproximado (4 béziers) gera polyline densa fechada', () => {
      // Círculo SVG canônico: 4 cúbicas com c ≈ 0.5523
      const r = 10;
      const c = r * 0.5522847498;
      const d = `M ${r} 0 C ${r} ${c} ${c} ${r} 0 ${r} C ${-c} ${r} ${-r} ${c} ${-r} 0 C ${-r} ${-c} ${-c} ${-r} 0 ${-r} C ${c} ${-r} ${r} ${-c} ${r} 0 Z`;
      const result = flattenSvgPath(d);
      expect(result).toHaveLength(1);
      expect(result[0]!.closed).toBe(true);
      // Cada ponto da polyline deve estar a ~r=10 da origem (tolerância < 0.1mm)
      for (const p of result[0]!.points) {
        const distFromCenter = Math.sqrt(p.x * p.x + p.y * p.y);
        expect(Math.abs(distFromCenter - r)).toBeLessThan(0.1);
      }
    });
  });
});
