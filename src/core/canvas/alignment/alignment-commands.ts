/**
 * alignment-commands.ts — 6 comandos puros de alinhamento (Onda 7b, Fase D).
 *
 * INTENCIONALMENTE SEM DEPENDÊNCIAS EXTERNAS.
 * Não importa Fabric, DOM, React. Toda lógica é função pura — testável em Node.
 *
 * Convenções:
 *   - Todos os valores em milímetros.
 *   - `referenceBounds` é o retângulo que serve de referência quando há 1 só objeto.
 *     Caller é responsável por escolher: canvas inteiro, ou bounds do pai imediato
 *     (slot dentro de aplique → aplique). Decisão alinhada com ADR 014 §6.
 *   - Com 2+ objetos, referência é a borda mais externa (Figma-style):
 *       alignLeft   → min(left)        alignRight  → max(right)
 *       alignTop    → min(top)         alignBottom → max(bottom)
 *       alignCenterH → média dos centerX dos objetos
 *       alignCenterV → média dos centerY dos objetos
 *
 * Sem mutação — cada função retorna lista nova com posições atualizadas;
 * width/height nunca mudam.
 */
import type { RectMm } from './snap-targets';

export type { RectMm };

// ─── Helpers internos ─────────────────────────────────────────────────────────

function rectRight(r: RectMm): number {
  return r.left + r.width;
}

function rectBottom(r: RectMm): number {
  return r.top + r.height;
}

function rectCenterX(r: RectMm): number {
  return r.left + r.width / 2;
}

function rectCenterY(r: RectMm): number {
  return r.top + r.height / 2;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Retorna o "alvo" do eixo horizontal de acordo com o comando.
 * Quando `rects.length === 1`, usa `referenceBounds`. Caso contrário, calcula
 * a borda mais externa (ou média) dos próprios rects.
 */
function targetX(
  command: 'left' | 'right' | 'centerH',
  rects: RectMm[],
  referenceBounds: RectMm
): number {
  if (rects.length === 1) {
    if (command === 'left') return referenceBounds.left;
    if (command === 'right') return rectRight(referenceBounds);
    return rectCenterX(referenceBounds);
  }
  if (command === 'left') return Math.min(...rects.map((r) => r.left));
  if (command === 'right') return Math.max(...rects.map(rectRight));
  return average(rects.map(rectCenterX));
}

function targetY(
  command: 'top' | 'bottom' | 'centerV',
  rects: RectMm[],
  referenceBounds: RectMm
): number {
  if (rects.length === 1) {
    if (command === 'top') return referenceBounds.top;
    if (command === 'bottom') return rectBottom(referenceBounds);
    return rectCenterY(referenceBounds);
  }
  if (command === 'top') return Math.min(...rects.map((r) => r.top));
  if (command === 'bottom') return Math.max(...rects.map(rectBottom));
  return average(rects.map(rectCenterY));
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Alinha bordas esquerdas. */
export function alignLeft(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const x = targetX('left', rects, referenceBounds);
  return rects.map((r) => ({ ...r, left: x }));
}

/** Centraliza horizontalmente (centro X). */
export function alignCenterH(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const cx = targetX('centerH', rects, referenceBounds);
  return rects.map((r) => ({ ...r, left: cx - r.width / 2 }));
}

/** Alinha bordas direitas. */
export function alignRight(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const x = targetX('right', rects, referenceBounds);
  return rects.map((r) => ({ ...r, left: x - r.width }));
}

/** Alinha bordas superiores. */
export function alignTop(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const y = targetY('top', rects, referenceBounds);
  return rects.map((r) => ({ ...r, top: y }));
}

/** Centraliza verticalmente (centro Y). */
export function alignCenterV(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const cy = targetY('centerV', rects, referenceBounds);
  return rects.map((r) => ({ ...r, top: cy - r.height / 2 }));
}

/** Alinha bordas inferiores. */
export function alignBottom(rects: RectMm[], referenceBounds: RectMm): RectMm[] {
  const y = targetY('bottom', rects, referenceBounds);
  return rects.map((r) => ({ ...r, top: y - r.height }));
}

/** Identificadores estáveis dos comandos — usados pela UI e pelos logs. */
export type AlignmentCommand =
  | 'alignLeft'
  | 'alignCenterH'
  | 'alignRight'
  | 'alignTop'
  | 'alignCenterV'
  | 'alignBottom';

/** Despachador conveniente — caller passa o nome do comando. */
export function applyAlignment(
  command: AlignmentCommand,
  rects: RectMm[],
  referenceBounds: RectMm
): RectMm[] {
  switch (command) {
    case 'alignLeft':
      return alignLeft(rects, referenceBounds);
    case 'alignCenterH':
      return alignCenterH(rects, referenceBounds);
    case 'alignRight':
      return alignRight(rects, referenceBounds);
    case 'alignTop':
      return alignTop(rects, referenceBounds);
    case 'alignCenterV':
      return alignCenterV(rects, referenceBounds);
    case 'alignBottom':
      return alignBottom(rects, referenceBounds);
  }
}
