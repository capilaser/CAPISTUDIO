/**
 * format-metrics.ts (Onda 26) — formatadores puros pro LiveMetricsOverlay.
 *
 * Mantidos em core/ pra serem testáveis sem jsdom/Fabric. UI consome estes
 * formatadores e cuida só de posicionamento/eventos.
 */

/**
 * Formata um delta em mm com sinal explícito e 1 casa decimal.
 *
 * Exemplos:
 *   formatDeltaMm(2.13)  // '+2.1'
 *   formatDeltaMm(-0.04) // '-0.0'
 *   formatDeltaMm(0)     // '+0.0'
 *
 * Nota: '-0.0' é cosmético — para o operador, "Δ ≈ 0" é o que importa, e o
 * sinal mostra que o gesto teve direção. Limpar isso exigiria condicional
 * em torno de Math.abs() < 0.05, sem ganho prático.
 */
export function formatDeltaMm(mm: number): string {
  const sign = mm >= 0 ? '+' : '-';
  return `${sign}${Math.abs(mm).toFixed(1)}`;
}

/**
 * Formata uma medida absoluta em mm com 1 casa decimal e sufixo ' mm'.
 *
 * Exemplos:
 *   formatMm(12.34) // '12.3 mm'
 *   formatMm(0)     // '0.0 mm'
 */
export function formatMm(mm: number): string {
  return `${mm.toFixed(1)} mm`;
}

/**
 * Compõe a linha do HUD durante drag.
 * `dx`/`dy` são opcionais — quando ausentes, mostra só posição absoluta
 * (ex.: primeiro frame, antes de gestureRef ter o ponto inicial).
 */
export function composeDragLine(cxMm: number, cyMm: number, dxMm?: number, dyMm?: number): string {
  const base = `x: ${formatMm(cxMm)}   y: ${formatMm(cyMm)}`;
  if (dxMm === undefined || dyMm === undefined) return base;
  return `${base}   Δx: ${formatDeltaMm(dxMm)}   Δy: ${formatDeltaMm(dyMm)}`;
}

/**
 * Compõe a linha do HUD durante resize.
 */
export function composeResizeLine(widthMm: number, heightMm: number): string {
  return `w: ${formatMm(widthMm)}   h: ${formatMm(heightMm)}`;
}
