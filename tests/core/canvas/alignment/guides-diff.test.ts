import { describe, expect, it } from 'vitest';

import { guidesShouldChange } from '@/core/canvas/alignment/guides-diff';
import type { SnapResult, SnapTarget } from '@/core/canvas/alignment/snap-targets';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const targetX: SnapTarget = {
  axis: 'x',
  value: 150,
  distance: 0.2,
  source: 'canvas-center',
  guideStart: { x: 150, y: 0 },
  guideEnd: { x: 150, y: 90 },
};

const targetX2: SnapTarget = {
  ...targetX,
  value: 100, // value diferente → update
};

const targetXOtherSource: SnapTarget = {
  ...targetX,
  source: 'object-edge', // source diferente → update
  sourceObjectId: 'obj-a',
};

const targetY: SnapTarget = {
  axis: 'y',
  value: 45,
  distance: 0.1,
  source: 'canvas-center',
  guideStart: { x: 0, y: 45 },
  guideEnd: { x: 300, y: 45 },
};

function res(x: SnapTarget | null, y: SnapTarget | null): SnapResult {
  return { x, y };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('guidesShouldChange', () => {
  it('cenário 1: prev null, next com X → create no X, noop no Y', () => {
    const diff = guidesShouldChange(null, res(targetX, null));
    expect(diff).toEqual({ x: 'create', y: 'noop' });
  });

  it('cenário 2: value mudou no X (mesmo source) → update no X, noop no Y', () => {
    const diff = guidesShouldChange(res(targetX, null), res(targetX2, null));
    expect(diff).toEqual({ x: 'update', y: 'noop' });
  });

  it('cenário 3: X virou null → remove no X, noop no Y', () => {
    const diff = guidesShouldChange(res(targetX, null), res(null, null));
    expect(diff).toEqual({ x: 'remove', y: 'noop' });
  });

  it('cenário 4: prev e next idênticos em ambos os eixos → noop em ambos', () => {
    const diff = guidesShouldChange(res(targetX, targetY), res(targetX, targetY));
    expect(diff).toEqual({ x: 'noop', y: 'noop' });
  });

  it('cenário 5: eixos trocaram (X tinha, agora Y tem) → remove X + create Y', () => {
    const diff = guidesShouldChange(res(targetX, null), res(null, targetY));
    expect(diff).toEqual({ x: 'remove', y: 'create' });
  });

  it('cenário extra: source mudou no X (mesmo value) → update', () => {
    const sameValueDifferentSource: SnapTarget = { ...targetXOtherSource, value: targetX.value };
    const diff = guidesShouldChange(res(targetX, null), res(sameValueDifferentSource, null));
    expect(diff).toEqual({ x: 'update', y: 'noop' });
  });

  it('cenário extra: prev null e next null em ambos eixos → noop puro', () => {
    const diff = guidesShouldChange(null, res(null, null));
    expect(diff).toEqual({ x: 'noop', y: 'noop' });
  });
});
