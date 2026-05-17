import DOMPurify, { type Config } from 'dompurify';

// SVG é XML executável: <script>, <foreignObject>, onload=, xlink:href="javascript:".
// Operador importa logo de terceiro → injetar cru no DOM seria XSS persistente com
// acesso ao bridge Tauri (invoke → FS + SQLite).
const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
};

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, SVG_CONFIG);
}
