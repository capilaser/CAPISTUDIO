import { describe, expect, it } from 'vitest';

import { fitText } from '@/core/canvas/fit-text';
import type { FitTextOptions } from '@/core/canvas/types';

/**
 * Deterministic mock: width = text.length * fontSize * 0.6 mm
 *                     height = fontSize * 1.2 mm
 *
 * This gives predictable behaviour without any DOM / canvas involvement:
 *   - Short text (≤ N chars) will fit at a large font size.
 *   - Long text forces the algorithm to shrink the font.
 */
function mockMeasure(text: string, _fontFamily: string, fontSize: number) {
  return {
    width: text.length * fontSize * 0.6,
    height: fontSize * 1.2,
  };
}

function baseOpts(overrides: Partial<FitTextOptions> = {}): FitTextOptions {
  return {
    text: 'Teste',
    maxWidth: 40,
    maxHeight: 10,
    fontFamily: 'Arial',
    measureFn: mockMeasure,
    ...overrides,
  };
}

describe('fitText', () => {
  // ── 1. Short text fits at maxFontSize ────────────────────────────────────
  it('returns maxFontSize when text already fits at the largest size', () => {
    // 'A' (1 char) × 24pt × 0.6 = 14.4 mm ≤ 40 mm → fits immediately
    const result = fitText(baseOpts({ text: 'A', maxFontSize: 24 }));
    expect(result.fontSize).toBe(24);
    expect(result.fits).toBe(true);
  });

  // ── 2. Medium text → algorithm reduces font until it fits ─────────────
  it('reduces font size until text fits within maxWidth', () => {
    // 'Flavinha' = 8 chars. At 24pt: 8 × 24 × 0.6 = 115.2 mm > 40 mm
    // Needs: fontSize ≤ 40 / (8 × 0.6) = 8.333... → 8.0 pt (stepping by 0.5)
    const result = fitText(baseOpts({ text: 'Flavinha', maxWidth: 40 }));
    expect(result.fits).toBe(true);
    expect(result.fontSize).toBeLessThan(24);
    expect(result.fontSize).toBeGreaterThanOrEqual(6);
    expect(result.measuredWidth).toBeLessThanOrEqual(40);
  });

  // ── 3. Huge text → hits minFontSize, fits=false ───────────────────────
  it('returns fits=false with fontSize=minFontSize when text overflows even at minimum', () => {
    // 200 chars × 6pt × 0.6 = 720 mm — way beyond any maxWidth
    const result = fitText(baseOpts({ text: 'x'.repeat(200), maxWidth: 40, minFontSize: 6 }));
    expect(result.fits).toBe(false);
    expect(result.fontSize).toBe(6);
  });

  // ── 4. Defaults: maxFontSize=24, minFontSize=6, step=0.5 ─────────────
  it('uses correct defaults when optional params are omitted', () => {
    // Text that forces a reduction — check it starts from 24 and can go to 6
    const longText = 'x'.repeat(20); // 20 × 24 × 0.6 = 288 mm > 40
    const result = fitText({
      ...baseOpts({ text: longText }),
      maxFontSize: undefined,
      minFontSize: undefined,
      step: undefined,
    });
    // Must have started at 24, ended at 6 (doesn't fit)
    expect(result.fontSize).toBe(6);
    expect(result.fits).toBe(false);
  });

  // ── 5. Custom step is respected ─────────────────────────────────────────
  it('decrements by the custom step value', () => {
    // Text that fits at 20pt but not at 24pt:
    // fits when: text.length × fs × 0.6 ≤ 40  → fs ≤ 40 / (text.length × 0.6)
    // Use 12 chars: fits when fs ≤ 40 / 7.2 ≈ 5.55 pt — too small.
    // Use 5 chars: fits when fs ≤ 40 / 3 ≈ 13.33 → step=2 means 24,22,20,18,16,14,12
    const result = fitText(baseOpts({ text: 'Hello', maxWidth: 40, maxFontSize: 24, step: 2 }));
    // 5 × 12 × 0.6 = 36 ≤ 40 → fontSize=12 with step=2 (24→22→20→18→16→14→12)
    expect(result.fits).toBe(true);
    // fontSize must be a multiple of 2pt away from 24
    const diff = 24 - result.fontSize;
    expect(diff % 2).toBe(0);
  });

  // ── 6. Empty string → returns maxFontSize, fits=true ─────────────────
  it('handles empty text: fits at maxFontSize (width=0)', () => {
    const result = fitText(baseOpts({ text: '' }));
    // '' has length 0 → width = 0 × anything = 0, always fits
    expect(result.fits).toBe(true);
    expect(result.fontSize).toBe(24);
    expect(result.measuredWidth).toBe(0);
  });

  // ── 7. Text that fits exactly at the boundary ─────────────────────────
  it('accepts text that measures exactly at maxWidth', () => {
    // We need text.length × fontSize × 0.6 === maxWidth exactly.
    // Choose: text='AAAA' (4 chars), maxWidth=48, fontSize=20
    // 4 × 20 × 0.6 = 48 → exact fit at 20pt (after stepping from 24)
    const result = fitText(baseOpts({ text: 'AAAA', maxWidth: 48, maxFontSize: 24, step: 1 }));
    expect(result.fits).toBe(true);
    expect(result.measuredWidth).toBeLessThanOrEqual(48);
  });

  // ── 8. maxFontSize < minFontSize → clamps gracefully, tests at minFontSize ─
  it('handles inverted bounds (maxFontSize < minFontSize) without throwing', () => {
    const result = fitText(baseOpts({ text: 'A', maxWidth: 40, maxFontSize: 4, minFontSize: 6 }));
    // startSize = max(4, 6) = 6 → tests at 6pt: 1 × 6 × 0.6 = 3.6 ≤ 40 → fits
    expect(result.fontSize).toBe(6);
    expect(result.fits).toBe(true);
  });

  // ── 9. Verifies measuredWidth/Height are from the chosen fontSize ──────
  it('returns measuredWidth and measuredHeight consistent with the chosen fontSize', () => {
    const result = fitText(baseOpts({ text: 'AB', maxWidth: 40 }));
    const expected = mockMeasure('AB', 'Arial', result.fontSize);
    expect(result.measuredWidth).toBeCloseTo(expected.width, 5);
    expect(result.measuredHeight).toBeCloseTo(expected.height, 5);
  });

  // ── 10. Step stops precisely at minFontSize, not below ────────────────
  it('never returns a fontSize below minFontSize', () => {
    const result = fitText(baseOpts({ text: 'x'.repeat(100), maxWidth: 10, minFontSize: 8 }));
    expect(result.fontSize).toBeGreaterThanOrEqual(8);
  });
});
