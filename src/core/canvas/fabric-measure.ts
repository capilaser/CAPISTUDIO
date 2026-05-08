import * as fabric from 'fabric';

import { MM_TO_PX } from './units';

// 1 pt = (1/72) inch × 25.4 mm/inch = 0.35278 mm; at DPI=4 px/mm → 1.4111 px/pt
export const PT_TO_PX = (25.4 / 72) * MM_TO_PX;

/**
 * Measures rendered text dimensions using a temporary fabric.Text object.
 * Returns dimensions in mm (matching the mm coordinate system used by SlotMeta).
 *
 * NOTE: In jsdom (test environment) font metrics return approximate values since
 * there is no real font rasterizer. Fabric uses internal approximations that are
 * sufficient for fitText stepping logic. In the real Tauri WebView (Chromium),
 * measurements reflect the actual rendered glyph widths.
 */
export function fabricMeasure(
  text: string,
  fontFamily: string,
  fontSize: number
): { width: number; height: number } {
  const t = new fabric.Text(text, {
    fontFamily,
    fontSize: fontSize * PT_TO_PX,
  });
  return {
    width: t.width / MM_TO_PX,
    height: t.height / MM_TO_PX,
  };
}
