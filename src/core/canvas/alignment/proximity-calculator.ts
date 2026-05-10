/**
 * Proximity calculator (Onda 7b, Fase E2) — função pura.
 *
 * Para um único objeto selecionado (target), calcula a distância em mm
 * até o obstáculo mais próximo em cada uma das 4 direções (acima, abaixo,
 * esquerda, direita). Quando não há obstáculo válido naquela direção,
 * cai pra borda do canvas (placa).
 *
 * Definição de "válido":
 *   - ACIMA:    other.bottom < target.top  E  interseção horizontal
 *   - ABAIXO:   other.top    > target.bottom  E  interseção horizontal
 *   - ESQUERDA: other.right  < target.left  E  interseção vertical
 *   - DIREITA:  other.left   > target.right  E  interseção vertical
 *
 * Interseção horizontal: target.left < other.right E target.right > other.left
 * Interseção vertical:  target.top  < other.bottom E target.bottom > other.top
 *
 * Sobreposição parcial → nenhum lado captura (sem interseção estrita do
 * lado oposto). Decisão tomada na calibração da Fase E2: mostrar "0mm"
 * em sobreposto seria confuso; preferimos cair pra borda da placa.
 *
 * Sem dependência de Fabric, DOM ou React — testável em Node.
 */

import type { RectMm } from './snap-targets';

export interface ProximityResult {
  /** Distância em mm até a primeira coisa acima OU borda superior da placa. ≥ 0. */
  top: number;
  /** Distância em mm até a primeira coisa abaixo OU borda inferior da placa. ≥ 0. */
  bottom: number;
  /** Distância em mm até a primeira coisa à esquerda OU borda esquerda da placa. ≥ 0. */
  left: number;
  /** Distância em mm até a primeira coisa à direita OU borda direita da placa. ≥ 0. */
  right: number;
}

export interface ProximityContext {
  /** Objeto selecionado, em mm. */
  target: RectMm;
  /** Outros objetos do canvas (já filtrados, sem o target nem a base SVG). */
  others: RectMm[];
  /** Bounds do canvas/produto em mm — usado como fallback quando nada existe na direção. */
  canvasBounds: RectMm;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intersectsHorizontally(a: RectMm, b: RectMm): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left;
}

function intersectsVertically(a: RectMm, b: RectMm): boolean {
  return a.top < b.top + b.height && a.top + a.height > b.top;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function computeProximity(ctx: ProximityContext): ProximityResult {
  const { target, others, canvasBounds } = ctx;
  const targetRight = target.left + target.width;
  const targetBottom = target.top + target.height;

  // Bordas da placa (em coordenadas absolutas no espaço do produto).
  const canvasLeft = canvasBounds.left;
  const canvasTop = canvasBounds.top;
  const canvasRight = canvasBounds.left + canvasBounds.width;
  const canvasBottom = canvasBounds.top + canvasBounds.height;

  // Fallbacks: distâncias até as bordas do canvas. Sempre ≥ 0 quando o
  // target está dentro do canvas; clamping preventivo cobre casos de borda.
  let topDist = Math.max(0, target.top - canvasTop);
  let bottomDist = Math.max(0, canvasBottom - targetBottom);
  let leftDist = Math.max(0, target.left - canvasLeft);
  let rightDist = Math.max(0, canvasRight - targetRight);

  for (const other of others) {
    const otherRight = other.left + other.width;
    const otherBottom = other.top + other.height;

    // ACIMA: other está estritamente acima E intercepta horizontalmente.
    if (otherBottom < target.top && intersectsHorizontally(target, other)) {
      const d = target.top - otherBottom;
      if (d < topDist) topDist = d;
    }

    // ABAIXO: other está estritamente abaixo E intercepta horizontalmente.
    if (other.top > targetBottom && intersectsHorizontally(target, other)) {
      const d = other.top - targetBottom;
      if (d < bottomDist) bottomDist = d;
    }

    // ESQUERDA: other está estritamente à esquerda E intercepta verticalmente.
    if (otherRight < target.left && intersectsVertically(target, other)) {
      const d = target.left - otherRight;
      if (d < leftDist) leftDist = d;
    }

    // DIREITA: other está estritamente à direita E intercepta verticalmente.
    if (other.left > targetRight && intersectsVertically(target, other)) {
      const d = other.left - targetRight;
      if (d < rightDist) rightDist = d;
    }
  }

  return { top: topDist, bottom: bottomDist, left: leftDist, right: rightDist };
}
