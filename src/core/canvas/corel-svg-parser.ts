import { MM_TO_PX } from './units';
import { parseAndStripRootDimensions, parseViewBox } from './svg-utils';

/** Relative tolerance for fator_w vs fator_h uniformity check (0.1%). */
const ASPECT_TOLERANCE = 0.001;

/** CSS selector for drawable shape elements. */
const SHAPE_SELECTOR = 'path, rect, circle, ellipse, polygon, polyline, line';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface CorelSvgMeta {
  /** SVG string with root width/height removed — ready for Fabric.loadSVGFromString. */
  svgStripped: string;
  /** Physical width in mm, read from the SVG width="Xmm" attribute. */
  widthMm: number;
  /** Physical height in mm, read from the SVG height="Xmm" attribute. */
  heightMm: number;
  /** viewBox width in SVG user units. */
  viewBoxW: number;
  /** viewBox height in SVG user units. */
  viewBoxH: number;
  /**
   * Scale factor to apply when placing this SVG on the Capi canvas.
   *   scaleFactor = (MM_TO_PX × widthMm) / viewBoxW
   * i.e. canvas pixels per SVG user unit. Apply as Fabric object scaleX/scaleY.
   */
  scaleFactor: number;
  /**
   * Number of drawable shape elements found (path/rect/circle/ellipse/polygon/polyline/line).
   * Always ≥ 1 (zero throws before returning). Informative for future UI.
   */
  pathCount: number;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Parses a Corel-exported SVG and returns normalised metadata for the Capi canvas.
 *
 * Enforces strict quality gates — throws a user-readable Error if any gate fails:
 *   1. width/height must carry the "mm" unit
 *   2. horizontal and vertical scale factors must agree within 0.1%
 *   3. No <image> raster elements
 *   4. No <text> elements (must be converted to curves in Corel — Ctrl+Q)
 *   5. No <use> or <symbol> references (break with Ctrl+K in Corel)
 *   6. At least one drawable shape element must be present
 *
 * Internally calls parseAndStripRootDimensions() from svg-utils — composition,
 * not extension; the svg-utils contract from Onda 3 is preserved unchanged.
 */
export function parseCorelSvg(svgString: string): CorelSvgMeta {
  // ── Parse XML ───────────────────────────────────────────────────────────────
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    const detail = parserError.textContent?.trim().slice(0, 120) ?? 'parse error';
    throw new Error(
      `SVG inválido: não foi possível processar o arquivo. ` +
        `Verifique se o arquivo não está corrompido. (${detail})`
    );
  }

  const root = doc.documentElement;

  // ── Gate 1: mm units ────────────────────────────────────────────────────────
  const widthMm = parseMmAttribute(root.getAttribute('width') ?? '', 'width');
  const heightMm = parseMmAttribute(root.getAttribute('height') ?? '', 'height');

  // ── Parse viewBox ────────────────────────────────────────────────────────────
  const viewBoxAttr = root.getAttribute('viewBox') ?? root.getAttribute('viewbox') ?? '';
  const vb = parseViewBox(viewBoxAttr); // throws on malformed viewBox
  const viewBoxW = vb.width;
  const viewBoxH = vb.height;

  // ── Gate 2: uniform aspect ratio ────────────────────────────────────────────
  const factorW = viewBoxW / widthMm;
  const factorH = viewBoxH / heightMm;
  if (Math.abs(factorW - factorH) / factorW > ASPECT_TOLERANCE) {
    // Log internal values for debug without exposing them to the user.
    console.debug(
      `[parseCorelSvg] aspect ratio distorcido: fator_w=${factorW.toFixed(4)} fator_h=${factorH.toFixed(4)}`
    );
    throw new Error(
      'Esse SVG está esticado — largura e altura foram redimensionadas em escalas diferentes. ' +
        'Provavelmente foi puxado só de um lado no Corel. ' +
        'Selecione o desenho, segure Shift e arraste pelo canto pra ajustar proporção. ' +
        'Depois reexporte.'
    );
  }

  // ── Gate 3: no raster images ─────────────────────────────────────────────────
  if (doc.getElementsByTagName('image').length > 0) {
    throw new Error(
      'SVG contém imagem rasterizada. Capi só aceita vetores. Vetorize antes de importar.'
    );
  }

  // ── Gate 4: no unconverted text ──────────────────────────────────────────────
  if (doc.getElementsByTagName('text').length > 0) {
    throw new Error(
      'SVG tem texto não convertido em curva. No Corel: selecione texto, Ctrl+Q, reexporte.'
    );
  }

  // ── Gate 5: no <use> or <symbol> ────────────────────────────────────────────
  if (doc.getElementsByTagName('use').length > 0 || doc.getElementsByTagName('symbol').length > 0) {
    throw new Error(
      'SVG tem referências internas não suportadas. No Corel: Ctrl+K para quebrar vínculos, reexporte.'
    );
  }

  // ── Gate 6: at least one drawable shape ─────────────────────────────────────
  const shapes = doc.querySelectorAll(SHAPE_SELECTOR);
  if (shapes.length === 0) {
    throw new Error(
      'SVG está vazio. Corel exportou apenas elementos não-suportados. ' +
        'Converta texto em curva (Ctrl+Q) no Corel.'
    );
  }

  // ── Compute derived values ───────────────────────────────────────────────────
  const scaleFactor = (MM_TO_PX * widthMm) / viewBoxW;
  const pathCount = shapes.length;

  // Clean Corel artefacts (ADR 010 §3), then strip root width/height for Fabric.
  const cleanedSvg = cleanCorelSvg(svgString);
  const svgStripped = parseAndStripRootDimensions(cleanedSvg);

  return { svgStripped, widthMm, heightMm, viewBoxW, viewBoxH, scaleFactor, pathCount };
}

// ─── SVG cleanup (ADR 010 §3) ────────────────────────────────────────────────

/**
 * Removes Corel-specific artefacts from an SVG string, producing a clean
 * vector-only SVG suitable for the Capi canvas.
 *
 * Per ADR 010 §3 — Tratamento de SVG importado:
 *
 *   REMOVES:
 *     - XML comments (<!-- Creator: CorelDRAW… -->)
 *     - `<style>` blocks (CDATA with .fil0/.str0 class rules)
 *     - `<font>` blocks (embedded glyphs exported by Corel)
 *     - `<metadata id="CorelCorpID…">` layer markers
 *     - `<defs>` left empty after the above removals
 *     - Root attributes: `style`, `xml:space`, `xmlns:xodm`, `version`
 *     - Descendant attributes: `fill`, `stroke`, `stroke-width`,
 *       `stroke-miterlimit`, `stroke-linecap`, `stroke-linejoin`,
 *       `class`, `style`
 *
 *   PRESERVES:
 *     - `viewBox` (source of authority — ADR 005)
 *     - `fill-rule` and `clip-rule` promoted from root `style` to proper
 *       SVG presentation attributes (critical for correct path winding)
 *     - `<path d="…">` geometry, `<g>` structure, all shape elements
 *     - `width` / `height` on root (caller strips them via
 *       parseAndStripRootDimensions if needed)
 *
 * Uses DOMParser rather than regex: handles CDATA and arbitrary nesting
 * correctly without brittle pattern matching.
 *
 * Exported so it can be called independently for applique/engraving/marking
 * banks (Onda 6.5) without going through the full validation pipeline.
 *
 * @param svgString  Raw SVG string exported from Corel.
 * @returns  Clean SVG string. Root width/height intentionally preserved.
 */
export function cleanCorelSvg(svgString: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const root = doc.documentElement;

  // ── 1. Remove all XML comments ─────────────────────────────────────────────
  // Corel inserts "<!-- Creator: CorelDRAW (Versão OEM) -->" before <svg>.
  // TreeWalker collects all comment nodes; batch-remove to avoid live-list issues.
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  let commentNode = walker.nextNode();
  while (commentNode) {
    comments.push(commentNode as Comment);
    commentNode = walker.nextNode();
  }
  for (const c of comments) c.parentNode?.removeChild(c);

  // ── 2. Promote fill-rule / clip-rule from root style → SVG attributes ──────
  // Corel bakes these into `style="… fill-rule:evenodd; clip-rule:evenodd"`.
  // Promoting them to presentation attributes ensures Fabric respects path
  // winding even after the style block is discarded (critical for letters with
  // inner holes, compound paths, etc.).
  const rootStyle = root.getAttribute('style') ?? '';
  const fillRule = /fill-rule\s*:\s*([^;]+)/i.exec(rootStyle)?.[1]?.trim();
  const clipRule = /clip-rule\s*:\s*([^;]+)/i.exec(rootStyle)?.[1]?.trim();
  if (fillRule) root.setAttribute('fill-rule', fillRule);
  if (clipRule) root.setAttribute('clip-rule', clipRule);
  root.removeAttribute('style');

  // ── 3. Remove Corel-specific root attributes ───────────────────────────────
  root.removeAttribute('xml:space');
  root.removeAttribute('xmlns:xodm');
  root.removeAttribute('version');
  // xmlns:xlink intentionally kept — Fabric may reference it for clip/marker.

  // ── 4. Remove <style> elements (CDATA class rules: .fil0, .str0, etc.) ─────
  for (const el of Array.from(doc.getElementsByTagName('style'))) {
    el.parentNode?.removeChild(el);
  }

  // ── 5. Remove <font> elements (embedded glyph data from unconverted text) ──
  for (const el of Array.from(doc.getElementsByTagName('font'))) {
    el.parentNode?.removeChild(el);
  }

  // ── 6. Remove <metadata id="CorelCorpID…"> layer markers ──────────────────
  for (const el of Array.from(doc.getElementsByTagName('metadata'))) {
    if ((el.getAttribute('id') ?? '').startsWith('CorelCorpID')) {
      el.parentNode?.removeChild(el);
    }
  }

  // ── 7. Remove <defs> left empty after steps 4–5 ────────────────────────────
  for (const el of Array.from(doc.getElementsByTagName('defs'))) {
    if (el.children.length === 0) el.parentNode?.removeChild(el);
  }

  // ── 8. Strip colour / class / style attributes from all descendants ─────────
  // fill / stroke / stroke-* → canvas engine applies its own (ADR 010 §3).
  // class / style → Corel CSS rules; meaningless after <style> is removed.
  const STRIP_ATTRS = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-miterlimit',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'class',
    'style',
  ];
  for (const el of Array.from(root.getElementsByTagName('*'))) {
    for (const attr of STRIP_ATTRS) el.removeAttribute(attr);
  }

  // ── 9. Inject fill="none" on all shape elements ───────────────────────────
  // ADR 010 §3: Capi is authoritative for colour. Passo 8 strips fill attrs;
  // without an explicit fill Fabric 6 defaults to black (rgb(0,0,0)) when
  // parsing via loadSVGFromString. fabric.util.groupSVGElements re-parses the
  // SVG source directly and discards any post-parse obj.set() overrides.
  // Injecting fill="none" here guarantees the parsed objects carry the correct
  // Capi default from the moment Fabric reads the SVG — before grouping.
  const shapeEls = Array.from(root.querySelectorAll(SHAPE_SELECTOR));
  for (const el of shapeEls) {
    (el as Element).setAttribute('fill', 'none');
  }

  return new XMLSerializer().serializeToString(root);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Maps a raw SVG unit token to a human-readable Portuguese label.
 */
function humanUnit(unit: string): string {
  switch (unit.toLowerCase()) {
    case 'px':
      return 'pixels';
    case 'in':
      return 'polegadas';
    case 'cm':
      return 'centímetros';
    case 'pt':
      return 'pontos';
    case 'em':
      return 'em';
    case '%':
      return 'porcentagem';
    default:
      return 'sem unidade';
  }
}

/**
 * Parses a raw SVG dimension attribute (e.g. "60.0759mm", "300.2mm") into
 * a positive number of millimetres.
 *
 * Throws a user-readable Error when the unit is absent or not "mm".
 */
function parseMmAttribute(raw: string, attr: 'width' | 'height'): number {
  const trimmed = raw.trim();
  // Match optional leading number followed by an optional unit string.
  const match = trimmed.match(/^([\d.]+)\s*(mm|px|in|cm|pt|em|%)?$/i);

  if (!match) {
    throw new Error(
      'SVG precisa estar em milímetros (recebemos sem unidade). ' +
        'No Corel: Layout > Page Setup > Units: Millimeters. Depois exporte de novo.'
    );
  }

  const [, valueStr, unit = ''] = match;

  if (unit.toLowerCase() !== 'mm') {
    throw new Error(
      `SVG precisa estar em milímetros (recebemos ${humanUnit(unit)}). ` +
        'No Corel: Layout > Page Setup > Units: Millimeters. Depois exporte de novo.'
    );
  }

  const value = parseFloat(valueStr);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`SVG com dimensão inválida no header: ${attr}="${raw}".`);
  }

  return value;
}
