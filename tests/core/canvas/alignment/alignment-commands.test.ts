import { describe, expect, it } from 'vitest';

import {
  alignBottom,
  alignCenterH,
  alignCenterV,
  alignLeft,
  alignRight,
  alignTop,
  applyAlignment,
} from '@/core/canvas/alignment/alignment-commands';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CANVAS: RectMm = { left: 0, top: 0, width: 300, height: 90 };

/** Aplique posicionado dentro da placa — usado para o cenário "slot dentro de aplique". */
const APLIQUE: RectMm = { left: 50, top: 10, width: 100, height: 40 };

function rect(left: number, top: number, width = 20, height = 10): RectMm {
  return { left, top, width, height };
}

// ─── Com 1 objeto, referência = canvas ──────────────────────────────────────

describe('alignment-commands — 1 objeto, referência = canvas', () => {
  it('1: alignLeft → left = canvas.left (0)', () => {
    const result = alignLeft([rect(120, 30)], CANVAS);
    expect(result).toHaveLength(1);
    expect(result[0].left).toBe(0);
    // top, width, height permanecem
    expect(result[0].top).toBe(30);
    expect(result[0].width).toBe(20);
    expect(result[0].height).toBe(10);
  });

  it('2: alignCenterH → centerX = canvas.centerX (150)', () => {
    const result = alignCenterH([rect(120, 30)], CANVAS);
    // left = 150 - 20/2 = 140
    expect(result[0].left).toBe(140);
    expect(result[0].top).toBe(30);
  });

  it('3: alignRight → right = canvas.width (300)', () => {
    const result = alignRight([rect(120, 30)], CANVAS);
    // left = 300 - 20 = 280
    expect(result[0].left).toBe(280);
  });

  it('4: alignTop → top = canvas.top (0)', () => {
    const result = alignTop([rect(120, 30)], CANVAS);
    expect(result[0].top).toBe(0);
    expect(result[0].left).toBe(120); // X intacto
  });

  it('5: alignCenterV → centerY = canvas.centerY (45)', () => {
    const result = alignCenterV([rect(120, 30)], CANVAS);
    // top = 45 - 10/2 = 40
    expect(result[0].top).toBe(40);
  });

  it('6: alignBottom → bottom = canvas.height (90)', () => {
    const result = alignBottom([rect(120, 30)], CANVAS);
    // top = 90 - 10 = 80
    expect(result[0].top).toBe(80);
  });
});

// ─── Com 3 objetos, referência = borda mais externa do conjunto ─────────────

describe('alignment-commands — 3 objetos, Figma-style (borda externa)', () => {
  // Posições escolhidas para que cada eixo tenha valores claros e distintos.
  // r1: left=10, top=10  (borda esquerda mais externa, topo mais externo)
  // r2: left=50, top=30
  // r3: left=80, top=60  (borda direita mais externa após +width=100, base mais externa após +height=70)
  const rects = [rect(10, 10), rect(50, 30), rect(80, 60)];

  it('7: alignLeft com 3 → todos ficam com left = min(left) = 10', () => {
    const result = alignLeft(rects, CANVAS);
    expect(result.map((r) => r.left)).toEqual([10, 10, 10]);
    // tops intactos
    expect(result.map((r) => r.top)).toEqual([10, 30, 60]);
  });

  it('8: alignCenterH com 3 → todos com mesmo centerX = média(centerX)', () => {
    const result = alignCenterH(rects, CANVAS);
    // centros originais: 20, 60, 90 → média = 56.6666...
    const expectedCenter = (20 + 60 + 90) / 3;
    result.forEach((r) => {
      expect(r.left + r.width / 2).toBeCloseTo(expectedCenter);
    });
  });

  it('9: alignRight com 3 → todos com right = max(right)', () => {
    const result = alignRight(rects, CANVAS);
    // rights originais: 30, 70, 100 → max = 100
    result.forEach((r) => {
      expect(r.left + r.width).toBe(100);
    });
  });

  it('10: alignTop com 3 → todos com top = min(top) = 10', () => {
    const result = alignTop(rects, CANVAS);
    expect(result.map((r) => r.top)).toEqual([10, 10, 10]);
  });

  it('11: alignCenterV com 3 → todos com centerY = média(centerY)', () => {
    const result = alignCenterV(rects, CANVAS);
    // centros originais Y: 15, 35, 65 → média = 38.333...
    const expectedCenter = (15 + 35 + 65) / 3;
    result.forEach((r) => {
      expect(r.top + r.height / 2).toBeCloseTo(expectedCenter);
    });
  });

  it('12: alignBottom com 3 → todos com bottom = max(bottom)', () => {
    const result = alignBottom(rects, CANVAS);
    // bottoms originais: 20, 40, 70 → max = 70
    result.forEach((r) => {
      expect(r.top + r.height).toBe(70);
    });
  });
});

// ─── Cenário ADR 014 §6 — pai imediato como referência ──────────────────────

describe('alignment-commands — referência = pai imediato (slot dentro de aplique)', () => {
  it('13: alignCenterH com 1 obj e referenceBounds = aplique → centra no aplique', () => {
    // APLIQUE: left=50, width=100 → centerX=100. Slot 20mm dentro do aplique:
    const slot = rect(60, 20);
    const result = alignCenterH([slot], APLIQUE);
    // novo left = 100 - 20/2 = 90
    expect(result[0].left).toBe(90);
    expect(result[0].left + result[0].width / 2).toBe(100);
    // confirma que NÃO usou canvas (centro 150)
    expect(result[0].left + result[0].width / 2).not.toBe(150);
  });

  it('14: alignCenterH com 1 obj e referenceBounds = canvas → centra no canvas', () => {
    const slot = rect(60, 20);
    const result = alignCenterH([slot], CANVAS);
    // canvas.centerX = 150, novo left = 150 - 20/2 = 140
    expect(result[0].left).toBe(140);
    expect(result[0].left + result[0].width / 2).toBe(150);
  });
});

// ─── Imutabilidade + applyAlignment dispatcher ──────────────────────────────

describe('alignment-commands — imutabilidade e dispatcher', () => {
  it('não muta a entrada (retorna nova lista, novos objetos)', () => {
    const input = [rect(10, 10), rect(50, 30)];
    const before = JSON.parse(JSON.stringify(input));
    alignLeft(input, CANVAS);
    expect(input).toEqual(before);
  });

  it('applyAlignment despacha para o comando correto', () => {
    const r = [rect(120, 30)];
    expect(applyAlignment('alignLeft', r, CANVAS)).toEqual(alignLeft(r, CANVAS));
    expect(applyAlignment('alignRight', r, CANVAS)).toEqual(alignRight(r, CANVAS));
    expect(applyAlignment('alignCenterH', r, CANVAS)).toEqual(alignCenterH(r, CANVAS));
    expect(applyAlignment('alignTop', r, CANVAS)).toEqual(alignTop(r, CANVAS));
    expect(applyAlignment('alignBottom', r, CANVAS)).toEqual(alignBottom(r, CANVAS));
    expect(applyAlignment('alignCenterV', r, CANVAS)).toEqual(alignCenterV(r, CANVAS));
  });
});
