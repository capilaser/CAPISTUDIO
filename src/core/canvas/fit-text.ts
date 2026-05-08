import type { FitTextOptions, FitTextResult } from './types';

const DEFAULT_MAX_FONT_SIZE = 24;
const DEFAULT_MIN_FONT_SIZE = 6;
const DEFAULT_STEP = 0.5;

/**
 * Finds the largest font size (in pt) at which `text` fits within `maxWidth`
 * on a single line, decrementing by `step` from `maxFontSize` down to
 * `minFontSize`. Never wraps text.
 *
 * DOM-free: text measurement is delegated to the injected `measureFn`.
 * In production, `measureFn` wraps a Fabric canvas context.
 * In tests, a deterministic mock is used.
 */
export function fitText(opts: FitTextOptions): FitTextResult {
  const { text, maxWidth, fontFamily, measureFn } = opts;

  const maxFontSize = opts.maxFontSize ?? DEFAULT_MAX_FONT_SIZE;
  const minFontSize = opts.minFontSize ?? DEFAULT_MIN_FONT_SIZE;
  const step = opts.step ?? DEFAULT_STEP;

  // Start from the larger of the two bounds to handle inverted inputs gracefully.
  const startSize = Math.max(maxFontSize, minFontSize);

  for (let fs = startSize; ; fs = roundPt(fs - step)) {
    const clampedFs = Math.max(fs, minFontSize);
    const measured = measureFn(text, fontFamily, clampedFs);

    if (measured.width <= maxWidth) {
      return {
        fontSize: clampedFs,
        fits: true,
        measuredWidth: measured.width,
        measuredHeight: measured.height,
      };
    }

    if (clampedFs <= minFontSize) {
      return {
        fontSize: minFontSize,
        fits: false,
        measuredWidth: measured.width,
        measuredHeight: measured.height,
      };
    }
  }
}

/** Rounds to 6 decimal places to avoid floating-point drift during iteration. */
function roundPt(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
