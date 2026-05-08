export interface ParsedViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

// ─── Shape → Path D converters ───────────────────────────────────────────────
// Pure functions: convert SVG shape elements to equivalent path `d` strings so
// that all shapes can be fed into Path2D (which only accepts path commands).
//
// Each function is exported for unit testing.  extractClipShapes() is the main
// consumer — it walks a full SVG string and delegates to these converters.

/**
 * Converts a `<rect>` (optionally with rounded corners) to a path `d` string.
 * `rx` / `ry` may be 0 for a sharp-cornered rectangle.
 * The radius is clamped to half the smaller dimension per the SVG spec.
 */
export function rectToPathD(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: number,
  ry: number
): string {
  // SVG spec: use the larger of rx/ry as uniform radius, clamped to half-side.
  const r = Math.min(Math.max(rx, ry), w / 2, h / 2);
  if (r <= 0) {
    return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return (
    `M ${x + r},${y} ` +
    `H ${x + w - r} ` +
    `A ${r},${r} 0 0 1 ${x + w},${y + r} ` +
    `V ${y + h - r} ` +
    `A ${r},${r} 0 0 1 ${x + w - r},${y + h} ` +
    `H ${x + r} ` +
    `A ${r},${r} 0 0 1 ${x},${y + h - r} ` +
    `V ${y + r} ` +
    `A ${r},${r} 0 0 1 ${x + r},${y} Z`
  );
}

/**
 * Converts a `<circle cx cy r>` to a path `d` string.
 * Uses two semicircular arcs (start ≠ end is required for arcs to render).
 */
export function circleToPathD(cx: number, cy: number, r: number): string {
  return (
    `M ${cx - r},${cy} ` +
    `A ${r},${r} 0 1 0 ${cx + r},${cy} ` +
    `A ${r},${r} 0 1 0 ${cx - r},${cy} Z`
  );
}

/**
 * Converts an `<ellipse cx cy rx ry>` to a path `d` string.
 * Same two-arc strategy as circleToPathD.
 */
export function ellipseToPathD(cx: number, cy: number, rx: number, ry: number): string {
  return (
    `M ${cx - rx},${cy} ` +
    `A ${rx},${ry} 0 1 0 ${cx + rx},${cy} ` +
    `A ${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`
  );
}

/**
 * Converts a `<polygon points="x1,y1 x2,y2 …">` to a path `d` string.
 * Returns an empty string if fewer than 2 points are found (degenerate shape).
 */
export function polygonToPathD(points: string): string {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  if (nums.length < 4) return '';
  let d = `M ${nums[0]},${nums[1]}`;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    d += ` L ${nums[i]},${nums[i + 1]}`;
  }
  return d + ' Z';
}

// ─── extractClipShapes ────────────────────────────────────────────────────────

/**
 * Parses an SVG string and extracts path `d` strings for every filled shape
 * element (`<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`).
 *
 * The returned strings are in SVG user-unit coordinates (typically mm for
 * Capi products).  Callers must apply the svg→px scale before feeding the
 * result to `Path2D`.
 *
 * Returns an empty array on parse error or when no filled shapes are found.
 *
 * NOTE: `<polyline>` and `<line>` are intentionally excluded — they are open
 * paths that cannot define a filled clip region.
 */
export function extractClipShapes(svgString: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return [];

  const ds: string[] = [];

  doc.querySelectorAll('path').forEach((el) => {
    const d = el.getAttribute('d');
    if (d && d.length > 0) ds.push(d);
  });

  doc.querySelectorAll('rect').forEach((el) => {
    const x = parseFloat(el.getAttribute('x') ?? '0');
    const y = parseFloat(el.getAttribute('y') ?? '0');
    const w = parseFloat(el.getAttribute('width') ?? '0');
    const h = parseFloat(el.getAttribute('height') ?? '0');
    // SVG spec: if only one of rx/ry is set, the other inherits its value.
    const rxAttr = el.getAttribute('rx');
    const ryAttr = el.getAttribute('ry');
    const rx = parseFloat(rxAttr ?? ryAttr ?? '0');
    const ry = parseFloat(ryAttr ?? rxAttr ?? '0');
    if (w > 0 && h > 0) ds.push(rectToPathD(x, y, w, h, rx, ry));
  });

  doc.querySelectorAll('circle').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') ?? '0');
    const cy = parseFloat(el.getAttribute('cy') ?? '0');
    const r = parseFloat(el.getAttribute('r') ?? '0');
    if (r > 0) ds.push(circleToPathD(cx, cy, r));
  });

  doc.querySelectorAll('ellipse').forEach((el) => {
    const cx = parseFloat(el.getAttribute('cx') ?? '0');
    const cy = parseFloat(el.getAttribute('cy') ?? '0');
    const rx = parseFloat(el.getAttribute('rx') ?? '0');
    const ry = parseFloat(el.getAttribute('ry') ?? '0');
    if (rx > 0 && ry > 0) ds.push(ellipseToPathD(cx, cy, rx, ry));
  });

  doc.querySelectorAll('polygon').forEach((el) => {
    const points = el.getAttribute('points') ?? '';
    const d = polygonToPathD(points);
    if (d) ds.push(d);
  });

  return ds;
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
