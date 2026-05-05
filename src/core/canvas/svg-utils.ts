export interface ParsedViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * Returns the SVG string with `width` and `height` removed from the root
 * <svg> element only. Width/height on child elements (<rect>, <image>, etc.)
 * are preserved.
 *
 * Uses DOMParser, not regex — child width/height in production SVGs (Corel
 * exports in later waves) must not be touched.
 */
export function parseAndStripRootDimensions(svgString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error(`Invalid SVG: ${parserError.textContent ?? 'parse error'}`);
  }

  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') {
    throw new Error(`Expected <svg> root, got <${root.tagName}>`);
  }

  root.removeAttribute('width');
  root.removeAttribute('height');

  return new XMLSerializer().serializeToString(doc);
}

/**
 * Parses an SVG viewBox string ("minX minY width height") into numeric parts.
 * Accepts either space- or comma-separated values per the SVG spec.
 */
export function parseViewBox(viewBox: string): ParsedViewBox {
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid viewBox: "${viewBox}"`);
  }
  const [minX, minY, width, height] = parts;
  return { minX, minY, width, height };
}
