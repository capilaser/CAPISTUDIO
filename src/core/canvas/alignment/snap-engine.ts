/**
 * snap-engine.ts — Núcleo matemático do sistema de snap.
 *
 * INTENCIONALMENTE SEM DEPENDÊNCIAS EXTERNAS.
 * Não importa Fabric, DOM, React, nem nada de src/ui/.
 * Toda lógica é função pura — testável em Node sem canvas.
 *
 * Invariantes (documentadas aqui e no ADR 013):
 *   - Todos os valores em milímetros.
 *   - Alt pressionado durante drag desliga snap inteiro (retorna {x:null, y:null}).
 *   - Tolerância padrão: 1mm (= 4px no DPI=4 do sistema).
 *   - Grade: 1mm, sempre ativa (invisível por default). Toggle só afeta visibilidade.
 *   - "Pai" do objeto = parentBounds passado pelo caller (snap-engine não faz lookup).
 *   - Em múltipla seleção, caller passa bounding box do grupo como movingRect.
 *   - Snap em grade NÃO conflita com Alt+Setas futuro (ADR 013): gestos distintos.
 */

import type {
  CanvasDimsMm,
  RectBounds,
  RectMm,
  SnapCandidate,
  SnapOptions,
  SnapResult,
  SnapTarget,
} from './snap-targets';

// ─── Helpers internos ─────────────────────────────────────────────────────────

function bounds(r: RectMm): RectBounds {
  return {
    left: r.left,
    right: r.left + r.width,
    top: r.top,
    bottom: r.top + r.height,
    centerX: r.left + r.width / 2,
    centerY: r.top + r.height / 2,
  };
}

/**
 * Retorna o snap mais próximo entre dois candidatos.
 * Se distâncias iguais, mantém o atual (estabilidade).
 */
function closer(a: SnapTarget | null, b: SnapTarget | null): SnapTarget | null {
  if (!a) return b;
  if (!b) return a;
  return b.distance < a.distance ? b : a;
}

/**
 * Tenta snap de um valor móvel (`moving`) a um alvo (`target`).
 * Retorna SnapTarget se dentro da tolerância, null caso contrário.
 *
 * `guideSpanMm` define o comprimento perpendicular da linha-guia visual (Fase C).
 * Convenção: linha vai do topo ao fundo do canvas (eixo X) ou da esquerda à direita (eixo Y).
 */
function trySnap(
  axis: 'x' | 'y',
  movingValue: number,
  targetValue: number,
  tolerance: number,
  source: SnapTarget['source'],
  canvasDims: CanvasDimsMm,
  perpendicularValue: number,
  sourceObjectId?: string
): SnapTarget | null {
  const distance = Math.abs(movingValue - targetValue);
  if (distance > tolerance) return null;

  const guideStart = axis === 'x' ? { x: targetValue, y: 0 } : { x: 0, y: targetValue };
  const guideEnd =
    axis === 'x'
      ? { x: targetValue, y: canvasDims.height }
      : { x: canvasDims.width, y: targetValue };

  // perpendicularValue não é usado para o endpoint da guia de canvas-center/parent-center/grid,
  // mas é relevante para object-edge/object-center onde a guia deve cruzar ambos os objetos.
  // Para simplificar (Fase C vai refinar), toda guia vai de borda a borda do canvas.
  void perpendicularValue;

  return {
    axis,
    value: targetValue,
    distance,
    source,
    guideStart,
    guideEnd,
    sourceObjectId,
  };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Calcula candidatos de snap para o objeto em movimento.
 *
 * @param movingRect   Bounding box do objeto (ou seleção múltipla) em movimento, em mm.
 * @param candidates   Outros objetos no canvas (não inclui o próprio `movingRect`).
 * @param canvasDims   Dimensões do produto em mm (fonte autoritativa — ADR 005).
 * @param options      Configurações de snap.
 * @returns            O snap mais próximo por eixo, ou null quando fora de tolerância.
 *
 * Ordem de prioridade (desempate por distância — vence o mais próximo):
 *   1. Centro do pai (parent-center)
 *   2. Centro do canvas (canvas-center)
 *   3. Bordas e centros de outros objetos (object-edge / object-center)
 *   4. Grade (grid) — resolução 1mm
 *
 * Quando altKeyDown === true, retorna imediatamente {x: null, y: null}.
 */
export function computeSnapCandidates(
  movingRect: RectMm,
  candidates: SnapCandidate[],
  canvasDims: CanvasDimsMm,
  options: SnapOptions
): SnapResult {
  if (options.altKeyDown) {
    return { x: null, y: null };
  }

  const tol = options.toleranceMm;
  const mov = bounds(movingRect);
  const canvasCenter = { x: canvasDims.width / 2, y: canvasDims.height / 2 };

  // Ponto de referência do objeto em movimento para snap:
  // comparamos centro do objeto com centro do alvo (para centros)
  // e bordas do objeto com bordas do alvo (para edges).
  const movCenterX = mov.centerX;
  const movCenterY = mov.centerY;

  let bestX: SnapTarget | null = null;
  let bestY: SnapTarget | null = null;

  // ── 1. Snap ao centro do pai ──────────────────────────────────────────────
  // parentBounds === null → pai é o canvas inteiro (usa canvasDims).
  const parentRect: RectMm = options.parentBounds ?? {
    left: 0,
    top: 0,
    width: canvasDims.width,
    height: canvasDims.height,
  };
  const parentB = bounds(parentRect);

  const snapParentX = trySnap(
    'x',
    movCenterX,
    parentB.centerX,
    tol,
    'parent-center',
    canvasDims,
    movCenterY
  );
  const snapParentY = trySnap(
    'y',
    movCenterY,
    parentB.centerY,
    tol,
    'parent-center',
    canvasDims,
    movCenterX
  );
  bestX = closer(bestX, snapParentX);
  bestY = closer(bestY, snapParentY);

  // ── 2. Snap ao centro do canvas ───────────────────────────────────────────
  // Quando pai === canvas, este snap é idêntico ao anterior; closer() resolve o empate
  // mantendo o atual (sem diferença prática).
  const snapCanvasX = trySnap(
    'x',
    movCenterX,
    canvasCenter.x,
    tol,
    'canvas-center',
    canvasDims,
    movCenterY
  );
  const snapCanvasY = trySnap(
    'y',
    movCenterY,
    canvasCenter.y,
    tol,
    'canvas-center',
    canvasDims,
    movCenterX
  );
  bestX = closer(bestX, snapCanvasX);
  bestY = closer(bestY, snapCanvasY);

  // ── 3. Snap entre objetos (bordas + centros) ──────────────────────────────
  for (const candidate of candidates) {
    const cb = bounds(candidate.rect);
    const id = candidate.id;

    // Centro X do objeto movido → centro X do candidato
    bestX = closer(
      bestX,
      trySnap('x', movCenterX, cb.centerX, tol, 'object-center', canvasDims, movCenterY, id)
    );
    // Centro Y do objeto movido → centro Y do candidato
    bestY = closer(
      bestY,
      trySnap('y', movCenterY, cb.centerY, tol, 'object-center', canvasDims, movCenterX, id)
    );

    // Borda esquerda do movido → borda esquerda do candidato
    bestX = closer(
      bestX,
      trySnap('x', mov.left, cb.left, tol, 'object-edge', canvasDims, movCenterY, id)
    );
    // Borda direita do movido → borda direita do candidato
    bestX = closer(
      bestX,
      trySnap('x', mov.right, cb.right, tol, 'object-edge', canvasDims, movCenterY, id)
    );
    // Borda esquerda do movido → borda direita do candidato (encosta)
    bestX = closer(
      bestX,
      trySnap('x', mov.left, cb.right, tol, 'object-edge', canvasDims, movCenterY, id)
    );
    // Borda direita do movido → borda esquerda do candidato (encosta)
    bestX = closer(
      bestX,
      trySnap('x', mov.right, cb.left, tol, 'object-edge', canvasDims, movCenterY, id)
    );

    // Borda topo do movido → borda topo do candidato
    bestY = closer(
      bestY,
      trySnap('y', mov.top, cb.top, tol, 'object-edge', canvasDims, movCenterX, id)
    );
    // Borda base do movido → borda base do candidato
    bestY = closer(
      bestY,
      trySnap('y', mov.bottom, cb.bottom, tol, 'object-edge', canvasDims, movCenterX, id)
    );
    // Borda topo do movido → borda base do candidato (encosta)
    bestY = closer(
      bestY,
      trySnap('y', mov.top, cb.bottom, tol, 'object-edge', canvasDims, movCenterX, id)
    );
    // Borda base do movido → borda topo do candidato (encosta)
    bestY = closer(
      bestY,
      trySnap('y', mov.bottom, cb.top, tol, 'object-edge', canvasDims, movCenterX, id)
    );
  }

  // ── 4. Snap em grade ──────────────────────────────────────────────────────
  // Grade de `gridMm` mm. Snapa a borda esquerda e topo do objeto ao tick mais próximo.
  // Usa left/top (não centro) para consistência: objeto "encaixa" na grade pelo canto.
  const gridMm = options.gridMm;

  const nearestGridX = Math.round(mov.left / gridMm) * gridMm;
  const snapGridX = trySnap('x', mov.left, nearestGridX, tol, 'grid', canvasDims, movCenterY);
  // Para grade, o valor retornado é a posição do LEFT (não do centro).
  // O caller deve aplicar o delta: newLeft = snapResult.x.value, newTop = snapResult.y.value.
  // Mas precisamos ajustar: se snapGridX snapa left→nearestGridX, o objeto se move
  // leftDelta = nearestGridX - mov.left. Retornamos o targetValue como nearestGridX
  // e o caller usa o mesmo delta para todos os pontos do objeto.
  bestX = closer(bestX, snapGridX);

  const nearestGridY = Math.round(mov.top / gridMm) * gridMm;
  const snapGridY = trySnap('y', mov.top, nearestGridY, tol, 'grid', canvasDims, movCenterX);
  bestY = closer(bestY, snapGridY);

  return { x: bestX, y: bestY };
}

/**
 * Aplica o resultado do snap ao retângulo em movimento, retornando a nova posição.
 *
 * O snap no eixo X pode ser baseado em `centerX` (canvas-center, parent-center, object-center)
 * ou em `left`/`right` (object-edge, grid). O `source` determina qual ponto do objeto
 * foi alinhado ao `value`, e por isso precisa calcular o novo `left` corretamente.
 *
 * Regra:
 *   - canvas-center, parent-center, object-center → value é o novo centerX/centerY
 *   - object-edge → value é a nova borda que snappou (left/right/top/bottom)
 *   - grid → value é o novo left/top
 *
 * Retorna `{ left, top }` em mm para o objeto em movimento.
 */
export function applySnapResult(
  movingRect: RectMm,
  result: SnapResult
): { left: number; top: number } {
  let newLeft = movingRect.left;
  let newTop = movingRect.top;

  if (result.x) {
    const snap = result.x;
    const mov = bounds(movingRect);
    if (
      snap.source === 'canvas-center' ||
      snap.source === 'parent-center' ||
      snap.source === 'object-center'
    ) {
      // value = novo centerX → left = value - width/2
      newLeft = snap.value - movingRect.width / 2;
    } else if (snap.source === 'grid') {
      // value = novo left
      newLeft = snap.value;
    } else {
      // object-edge: descobre qual borda snappou pelo delta menor
      // O snap foi feito: mov.left→value ou mov.right→value ou mov.left→cb.right ou mov.right→cb.left
      // Reconstrói pelo que estava mais perto:
      const dLeft = Math.abs(mov.left - snap.value);
      const dRight = Math.abs(mov.right - snap.value);
      if (dLeft <= dRight) {
        newLeft = snap.value; // left snappou
      } else {
        newLeft = snap.value - movingRect.width; // right snappou
      }
    }
  }

  if (result.y) {
    const snap = result.y;
    const mov = bounds(movingRect);
    if (
      snap.source === 'canvas-center' ||
      snap.source === 'parent-center' ||
      snap.source === 'object-center'
    ) {
      // value = novo centerY → top = value - height/2
      newTop = snap.value - movingRect.height / 2;
    } else if (snap.source === 'grid') {
      // value = novo top
      newTop = snap.value;
    } else {
      // object-edge
      const dTop = Math.abs(mov.top - snap.value);
      const dBottom = Math.abs(mov.bottom - snap.value);
      if (dTop <= dBottom) {
        newTop = snap.value;
      } else {
        newTop = snap.value - movingRect.height;
      }
    }
  }

  return { left: newLeft, top: newTop };
}
