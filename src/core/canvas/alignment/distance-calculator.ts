/**
 * Distance calculator (Onda 7b, Fase E) — função pura.
 *
 * Distância entre os centros de 2 retângulos em mm. Sem dependência de
 * Fabric, DOM ou React — testável em Node.
 *
 * V (vertical)   = |centerY_A - centerY_B|
 * H (horizontal) = |centerX_A - centerX_B|
 *
 * Sempre positivo (valor absoluto). Comutativa: f(a,b) === f(b,a).
 */

import type { RectMm } from './snap-targets';

export interface Distance {
  /** Distância vertical em mm entre os centros. Sempre ≥ 0. */
  v: number;
  /** Distância horizontal em mm entre os centros. Sempre ≥ 0. */
  h: number;
}

export function computeDistance(a: RectMm, b: RectMm): Distance {
  const centerYA = a.top + a.height / 2;
  const centerYB = b.top + b.height / 2;
  const centerXA = a.left + a.width / 2;
  const centerXB = b.left + b.width / 2;
  return {
    v: Math.abs(centerYA - centerYB),
    h: Math.abs(centerXA - centerXB),
  };
}
