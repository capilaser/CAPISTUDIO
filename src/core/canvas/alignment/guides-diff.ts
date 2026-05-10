/**
 * guides-diff.ts — Diff lógico puro entre dois SnapResults consecutivos.
 *
 * Decide qual ação aplicar a cada eixo da guia visual (Fase C):
 *   - 'create' : eixo passou de null para um SnapTarget — desenhar nova linha
 *   - 'update' : eixo já tinha guia e o value/source mudou — mover linha existente
 *   - 'remove' : eixo passou de SnapTarget para null — apagar linha (hard, sem fade)
 *   - 'noop'   : nenhuma mudança visual no eixo — não tocar
 *
 * Sem dependência de Fabric/DOM. Testável em Node.
 */
import type { SnapResult, SnapTarget } from './snap-targets';

export type GuideAction = 'create' | 'update' | 'remove' | 'noop';

export interface GuidesDiff {
  x: GuideAction;
  y: GuideAction;
}

/**
 * Compara dois targets do mesmo eixo. Retorna a ação a aplicar.
 *
 * Critérios:
 *   - prev nulo,  next nulo   → noop
 *   - prev nulo,  next target → create
 *   - prev target, next nulo  → remove (instantâneo, sem fade)
 *   - ambos targets:
 *       value diferente OU source diferente → update
 *       caso contrário                       → noop
 */
function diffAxis(prev: SnapTarget | null, next: SnapTarget | null): GuideAction {
  if (prev === null && next === null) return 'noop';
  if (prev === null && next !== null) return 'create';
  if (prev !== null && next === null) return 'remove';
  // Ambos não-nulos:
  if (prev!.value !== next!.value) return 'update';
  if (prev!.source !== next!.source) return 'update';
  return 'noop';
}

/**
 * Compara dois SnapResults consecutivos e diz o que fazer com cada eixo.
 * `prev` pode ser null para representar "ainda não havia snap algum"
 * (estado inicial do drag).
 */
export function guidesShouldChange(prev: SnapResult | null, next: SnapResult | null): GuidesDiff {
  const px = prev?.x ?? null;
  const py = prev?.y ?? null;
  const nx = next?.x ?? null;
  const ny = next?.y ?? null;
  return {
    x: diffAxis(px, nx),
    y: diffAxis(py, ny),
  };
}
