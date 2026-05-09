import { describe, expect, it } from 'vitest';

import { applySnapResult, computeSnapCandidates } from '@/core/canvas/alignment/snap-engine';
import type {
  CanvasDimsMm,
  RectMm,
  SnapCandidate,
  SnapOptions,
} from '@/core/canvas/alignment/snap-targets';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CANVAS: CanvasDimsMm = { width: 300, height: 90 };

const DEFAULT_OPTS: SnapOptions = {
  toleranceMm: 1,
  gridMm: 1,
  altKeyDown: false,
  parentBounds: null,
};

/**
 * Opções sem grade e sem pai — isola snap para testar canvas-center e object-edge.
 * gridMm=999 efetivamente desativa a grade (nenhum ponto fica dentro de 1mm de tolerância).
 */
const OPTS_NO_GRID: SnapOptions = { ...DEFAULT_OPTS, gridMm: 999 };

/**
 * Opções sem grade e com pai diferente do canvas — isola parent-center.
 */
const APLIQUE: RectMm = { left: 100, top: 20, width: 80, height: 50 };
const OPTS_WITH_PARENT: SnapOptions = { ...OPTS_NO_GRID, parentBounds: APLIQUE };

function movingRect(left: number, top: number, width = 20, height = 10): RectMm {
  return { left, top, width, height };
}

function candidate(id: string, rect: RectMm): SnapCandidate {
  return { id, rect };
}

// ─── Cenário 1: Snap no centro X do canvas ───────────────────────────────────
// Canvas center X = 150mm.
// Desativa grade (gridMm=999) para testar só canvas-center.
// parentBounds=null → pai = canvas → parent-center e canvas-center são IDÊNTICOS.
// Testamos que value=150 e que o snap ocorre, independente de source ser
// 'parent-center' ou 'canvas-center' (as duas apontam para o mesmo alvo).

describe('Snap ao centro X do canvas', () => {
  it('gruda quando centro do objeto está a 0.5mm do centro X do canvas', () => {
    // centerX = 150.5mm → left = 140.5
    const moving = movingRect(140.5, 40);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).not.toBeNull();
    // value deve ser o canvas center X
    expect(result.x?.value).toBe(150);
    // source é parent-center ou canvas-center (ambas apontam para o centro do canvas
    // quando parentBounds=null — comportamento documentado no snap-engine)
    expect(['canvas-center', 'parent-center']).toContain(result.x?.source);
  });

  it('NÃO gruda quando centro do objeto está a 1.5mm do centro X (fora da tolerância)', () => {
    // centerX = 151.5mm → left = 141.5. Sem grade efetiva.
    const moving = movingRect(141.5, 40);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).toBeNull();
  });
});

// ─── Cenário 2: Snap no centro Y do canvas ───────────────────────────────────

describe('Snap ao centro Y do canvas', () => {
  it('gruda quando centro do objeto está a 0.8mm do centro Y do canvas', () => {
    // Canvas center Y = 45mm. centerY = 45.8mm → top = 40.8. Sem grade.
    const moving = movingRect(10, 40.8); // centerX=20, longe do center X=150
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.y).not.toBeNull();
    expect(result.y?.value).toBe(45);
    expect(['canvas-center', 'parent-center']).toContain(result.y?.source);
  });

  it('NÃO gruda quando centro do objeto está a 1.5mm do centro Y', () => {
    // centerY = 46.5mm → top = 41.5. Sem grade.
    const moving = movingRect(10, 41.5);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.y).toBeNull();
  });
});

// ─── Cenário 3: Snap na borda esquerda de outro objeto ───────────────────────
// Usa OPTS_NO_GRID para isolar object-edge do snap de grade.

describe('Snap na borda de outro objeto', () => {
  it('borda esquerda do movido gruda na borda esquerda do candidato', () => {
    // Candidato com left=100. Objeto movido com left=100.7 → dist=0.7mm ≤ 1mm.
    // Sem grade. Candidato longe do centro do canvas.
    const moving = movingRect(100.7, 5); // fora do centro Y=45
    const other = candidate('obj-1', { left: 100, top: 3, width: 50, height: 4 });
    const result = computeSnapCandidates(moving, [other], CANVAS, OPTS_NO_GRID);

    expect(result.x).not.toBeNull();
    expect(result.x?.source).toBe('object-edge');
    expect(result.x?.value).toBe(100);
  });

  it('borda base do movido gruda na borda topo do candidato (encosta por baixo)', () => {
    // Candidato com top=30. Objeto movido com bottom=30.7 → top=20.7 (height=10).
    // Sem grade. Longe do centro.
    const moving = movingRect(10, 20.7); // bottom=30.7, top candidato=30 → dist=0.7mm
    const other = candidate('obj-2', { left: 5, top: 30, width: 30, height: 10 });
    const result = computeSnapCandidates(moving, [other], CANVAS, OPTS_NO_GRID);

    expect(result.y).not.toBeNull();
    expect(result.y?.source).toBe('object-edge');
    expect(result.y?.value).toBe(30);
  });
});

// ─── Cenário 4: Snap ao centro do pai (aplique) ──────────────────────────────
// APLIQUE = { left: 100, top: 20, width: 80, height: 50 }
// centerX = 140mm, centerY = 45mm

describe('Snap ao centro do pai', () => {
  it('snapa no centro X do aplique pai', () => {
    // centerX do objeto = 140.6mm → left = 130.6. Sem grade.
    // parentBounds = APLIQUE (centerX=140) → dist=0.6mm ≤ 1mm
    const moving = movingRect(130.6, 5); // centerY=10, longe do centerY pai=45
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_WITH_PARENT);

    expect(result.x).not.toBeNull();
    expect(result.x?.source).toBe('parent-center');
    expect(result.x?.value).toBe(140);
  });

  it('snapa no centro Y do aplique pai', () => {
    // centerY do objeto = 44.5mm → top = 39.5. Sem grade.
    const moving = movingRect(10, 39.5); // centerX=20, longe do centerX pai=140
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_WITH_PARENT);

    expect(result.y).not.toBeNull();
    expect(result.y?.source).toBe('parent-center');
    expect(result.y?.value).toBe(45);
  });
});

// ─── Cenário 5: Snap em grade 1mm ────────────────────────────────────────────

describe('Snap em grade', () => {
  it('left a 0.4mm do tick gruda no tick (dentro de tolerância 1mm)', () => {
    // left = 10.4mm → tick mais próximo = 10mm → distância = 0.4mm ≤ 1mm
    const moving = movingRect(10.4, 5);
    const result = computeSnapCandidates(moving, [], CANVAS, DEFAULT_OPTS);

    expect(result.x).not.toBeNull();
    // grid tem distância 0.4mm. canvas-center: dist = |10.4+10 - 150| = 129.6mm >> 1mm
    // Portanto grid vence.
    expect(result.x?.source).toBe('grid');
    expect(result.x?.value).toBe(10);
  });

  it('top a 0.3mm do tick gruda no tick', () => {
    // top = 5.7mm → tick mais próximo = 6mm → distância = 0.3mm ≤ 1mm
    const moving = movingRect(10, 5.7);
    const result = computeSnapCandidates(moving, [], CANVAS, DEFAULT_OPTS);

    expect(result.y).not.toBeNull();
    expect(result.y?.source).toBe('grid');
    expect(result.y?.value).toBe(6);
  });
});

// ─── Cenário 6: Zona morta — sem snap quando distância > tolerância ───────────

describe('Zona morta', () => {
  it('não snapa em nenhum alvo quando objeto está longe de tudo (sem grade efetiva)', () => {
    // Sem grade (gridMm=999). Sem candidatos. Objeto longe do centro.
    // centerX=20 (longe de 150). centerY=10 (longe de 45).
    const moving = movingRect(10, 5); // centerX=20, centerY=10
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).toBeNull();
    expect(result.y).toBeNull();
  });

  it('não snapa quando objeto está a exatamente 1.1mm do centro do canvas', () => {
    // dist = 1.1mm > tolerância 1mm → sem snap
    // centerX = 150 + 1.1 = 151.1 → left = 141.1
    const moving = movingRect(141.1, 5);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).toBeNull();
  });
});

// ─── Cenário 7: Alt desativa snap inteiro ────────────────────────────────────

describe('Alt desativa snap', () => {
  it('retorna {x: null, y: null} quando altKeyDown = true, mesmo com objeto no centro exato', () => {
    // Objeto exatamente no centro do canvas — snapparia sem Alt.
    const moving = movingRect(140, 40); // centerX=150, centerY=45
    const opts: SnapOptions = { ...DEFAULT_OPTS, altKeyDown: true };
    const result = computeSnapCandidates(moving, [], CANVAS, opts);

    expect(result.x).toBeNull();
    expect(result.y).toBeNull();
  });

  it('sem Alt, mesmo objeto snapa normalmente', () => {
    const moving = movingRect(140, 40);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).not.toBeNull();
    expect(result.y).not.toBeNull();
  });
});

// ─── Cenário 8: Múltiplos candidatos — vence o mais próximo ──────────────────

describe('Múltiplos candidatos — vence o mais próximo', () => {
  it('quando 2 candidatos competem no eixo X via centerX, escolhe o mais próximo', () => {
    // Objeto movido com centerX = 60.3mm → left = 50.3 (width=20)
    // Candidato A: centerX = 60mm → dist = 0.3mm
    // Candidato B: centerX = 61mm → dist = 0.7mm
    // Vencedor: A (dist 0.3mm < 0.7mm) → value = 60
    const moving = movingRect(50.3, 5, 20, 10);
    const candA = candidate('cand-A', { left: 50, top: 3, width: 20, height: 4 }); // centerX=60
    const candB = candidate('cand-B', { left: 51, top: 3, width: 20, height: 4 }); // centerX=61
    const result = computeSnapCandidates(moving, [candA, candB], CANVAS, OPTS_NO_GRID);

    expect(result.x).not.toBeNull();
    expect(result.x?.source).toBe('object-center');
    expect(result.x?.value).toBeCloseTo(60, 5);
    expect(result.x?.sourceObjectId).toBe('cand-A');
    expect(result.x?.distance).toBeCloseTo(0.3, 5);
  });

  it('quando candidato próximo e grade competem, vence o de menor distância', () => {
    // objeto left=50.4 → grade nearestGrid=50 dist=0.4mm
    // candidato left=50.9 → dist=0.5mm
    // Grade vence (0.4 < 0.5)
    const moving = movingRect(50.4, 5);
    const other = candidate('obj-1', { left: 50.9, top: 3, width: 20, height: 4 });
    const result = computeSnapCandidates(moving, [other], CANVAS, DEFAULT_OPTS);

    expect(result.x).not.toBeNull();
    expect(result.x?.source).toBe('grid');
    expect(result.x?.value).toBe(50);
  });
});

// ─── applySnapResult ─────────────────────────────────────────────────────────

describe('applySnapResult', () => {
  it('aplica snap de canvas-center (center → left = value - width/2)', () => {
    // Objeto 20x10mm. Snap X: value=150 (canvas center) → newLeft = 150 - 10 = 140
    // Snap Y: value=45 (canvas center) → newTop = 45 - 5 = 40
    const moving = movingRect(140.5, 40.5);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);
    const applied = applySnapResult(moving, result);

    expect(applied.left).toBeCloseTo(140, 5);
    expect(applied.top).toBeCloseTo(40, 5);
  });

  it('aplica snap de grid (usa left/top diretamente)', () => {
    // left=10.4 → snap left=10; top=5.7 → snap top=6
    const moving = movingRect(10.4, 5.7);
    const result = computeSnapCandidates(moving, [], CANVAS, DEFAULT_OPTS);
    const applied = applySnapResult(moving, result);

    expect(applied.left).toBeCloseTo(10, 5);
    expect(applied.top).toBeCloseTo(6, 5);
  });

  it('sem snap → posição inalterada', () => {
    const moving = movingRect(10, 5);
    const result = computeSnapCandidates(moving, [], CANVAS, {
      ...DEFAULT_OPTS,
      altKeyDown: true,
    });
    const applied = applySnapResult(moving, result);

    expect(applied.left).toBe(10);
    expect(applied.top).toBe(5);
  });

  it('snap de object-edge: borda esquerda do movido snapa na borda esquerda do candidato', () => {
    // moving left=100.7, candidato left=100 → dist=0.7 → newLeft=100
    const moving = movingRect(100.7, 5);
    const other = candidate('obj-1', { left: 100, top: 3, width: 50, height: 4 });
    const result = computeSnapCandidates(moving, [other], CANVAS, OPTS_NO_GRID);
    const applied = applySnapResult(moving, result);

    expect(applied.left).toBeCloseTo(100, 5);
  });

  it('snap de parent-center X: newLeft = parentCenterX - width/2', () => {
    // APLIQUE centerX=140. moving centerX=140.6 → left=130.6. newLeft=140-10=130.
    const moving = movingRect(130.6, 5, 20, 10);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_WITH_PARENT);
    const applied = applySnapResult(moving, result);

    expect(applied.left).toBeCloseTo(130, 5);
  });
});

// ─── Linhas-guia (guideStart/guideEnd) ───────────────────────────────────────

describe('Linhas-guia (guideStart/guideEnd)', () => {
  it('snap no eixo X retorna guia vertical cobrindo toda a altura do canvas', () => {
    const moving = movingRect(140, 40);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.x).not.toBeNull();
    // Guia vertical em x=150, de y=0 a y=90 (altura do canvas)
    expect(result.x?.guideStart).toEqual({ x: 150, y: 0 });
    expect(result.x?.guideEnd).toEqual({ x: 150, y: 90 });
  });

  it('snap no eixo Y retorna guia horizontal cobrindo toda a largura do canvas', () => {
    const moving = movingRect(140, 40);
    const result = computeSnapCandidates(moving, [], CANVAS, OPTS_NO_GRID);

    expect(result.y).not.toBeNull();
    // Guia horizontal em y=45, de x=0 a x=300 (largura do canvas)
    expect(result.y?.guideStart).toEqual({ x: 0, y: 45 });
    expect(result.y?.guideEnd).toEqual({ x: 300, y: 45 });
  });
});
