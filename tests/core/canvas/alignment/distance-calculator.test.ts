import { describe, expect, it } from 'vitest';

import { computeDistance } from '@/core/canvas/alignment/distance-calculator';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';

function rect(left: number, top: number, width = 20, height = 10): RectMm {
  return { left, top, width, height };
}

describe('distance-calculator — computeDistance', () => {
  it('1: V puro — mesmo X, Y diferente → v > 0, h = 0', () => {
    // A: center = (10, 5);  B: center = (10, 55)
    const a = rect(0, 0);
    const b = rect(0, 50);
    const result = computeDistance(a, b);
    expect(result.v).toBe(50);
    expect(result.h).toBe(0);
  });

  it('2: H puro — mesmo Y, X diferente → v = 0, h > 0', () => {
    // A: center = (10, 5);  B: center = (90, 5)
    const a = rect(0, 0);
    const b = rect(80, 0);
    const result = computeDistance(a, b);
    expect(result.v).toBe(0);
    expect(result.h).toBe(80);
  });

  it('3: V + H combinados — diagonal → ambos > 0', () => {
    // A: center = (10, 5);  B: center = (40, 35)
    const a = rect(0, 0);
    const b = rect(30, 30);
    const result = computeDistance(a, b);
    expect(result.v).toBe(30);
    expect(result.h).toBe(30);
  });

  it('4: distância zero — 2 rects no mesmo lugar → {v:0, h:0}', () => {
    const a = rect(50, 25);
    const b = rect(50, 25);
    const result = computeDistance(a, b);
    expect(result.v).toBe(0);
    expect(result.h).toBe(0);
  });

  it('5: sobreposição parcial — centros distintos calculados sobre top + height/2', () => {
    // A: 40×40 em (0,0) → center (20, 20)
    // B: 40×40 em (10,10) → center (30, 30)  — sobrepõe metade da área de A
    const a = rect(0, 0, 40, 40);
    const b = rect(10, 10, 40, 40);
    const result = computeDistance(a, b);
    expect(result.v).toBe(10);
    expect(result.h).toBe(10);
  });

  it('6: comutatividade — compute(a,b) === compute(b,a) (valor absoluto)', () => {
    const a = rect(0, 0, 20, 10);
    const b = rect(80, 50, 30, 20);
    const ab = computeDistance(a, b);
    const ba = computeDistance(b, a);
    expect(ab.v).toBe(ba.v);
    expect(ab.h).toBe(ba.h);
    // Sanidade: B fica abaixo-direita de A → ambos > 0.
    expect(ab.v).toBeGreaterThan(0);
    expect(ab.h).toBeGreaterThan(0);
  });
});
