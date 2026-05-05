import { describe, expect, it } from 'vitest';

import { MM_TO_PX, mmToPx, pxToMm } from '@/core/canvas/units';

describe('units', () => {
  it('uses 4 px/mm DPI', () => {
    expect(MM_TO_PX).toBe(4);
  });

  it('mmToPx(60) === 240', () => {
    expect(mmToPx(60)).toBe(240);
  });

  it('pxToMm(240) === 60', () => {
    expect(pxToMm(240)).toBe(60);
  });

  it('round-trips integer mm values', () => {
    for (const mm of [0, 1, 25, 60, 300, 999]) {
      expect(pxToMm(mmToPx(mm))).toBe(mm);
    }
  });

  it('round-trips fractional mm values within FP precision', () => {
    for (const mm of [0.1, 0.25, 12.5, 60.0]) {
      expect(pxToMm(mmToPx(mm))).toBeCloseTo(mm, 10);
    }
  });
});
