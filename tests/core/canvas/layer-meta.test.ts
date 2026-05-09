import { describe, expect, it } from 'vitest';

import {
  isOperationLayer,
  isPrincipalLayer,
  isVisualLayer,
  validateLayerMeta,
} from '@/core/canvas/layer-meta';
import type {
  LayerMeta,
  OperationLayerMeta,
  PrincipalLayerMeta,
  VisualLayerMeta,
} from '@/data/schema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const principal: PrincipalLayerMeta = {
  id: 'p1',
  parentLayerId: null,
  name: 'Base Broche',
  zIndex: 0,
  visible: true,
  locked: false,
  kind: 'principal',
  materialId: null,
};

const operation: OperationLayerMeta = {
  id: 'op1',
  parentLayerId: 'p1',
  name: 'Gravação',
  zIndex: 1,
  visible: true,
  locked: false,
  kind: 'operation',
  operation: 'gravação',
  machines: ['MB'],
};

const visual: VisualLayerMeta = {
  id: 'v1',
  parentLayerId: null,
  name: 'Decorativo',
  zIndex: 2,
  visible: true,
  locked: false,
  kind: 'visual',
  materialId: null,
};

// ─── Type guards ──────────────────────────────────────────────────────────────

describe('type guards', () => {
  it('isPrincipalLayer identifica correctly', () => {
    expect(isPrincipalLayer(principal)).toBe(true);
    expect(isPrincipalLayer(operation)).toBe(false);
    expect(isPrincipalLayer(visual)).toBe(false);
  });

  it('isOperationLayer identifica correctly', () => {
    expect(isOperationLayer(operation)).toBe(true);
    expect(isOperationLayer(principal)).toBe(false);
    expect(isOperationLayer(visual)).toBe(false);
  });

  it('isVisualLayer identifica correctly', () => {
    expect(isVisualLayer(visual)).toBe(true);
    expect(isVisualLayer(principal)).toBe(false);
    expect(isVisualLayer(operation)).toBe(false);
  });
});

// ─── validateLayerMeta — happy path ──────────────────────────────────────────

describe('validateLayerMeta — happy path', () => {
  it('aceita array vazio', () => {
    const result = validateLayerMeta([]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('aceita hierarquia válida principal → operation + visual standalone', () => {
    const result = validateLayerMeta([principal, operation, visual]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── Invariant tests ──────────────────────────────────────────────────────────

describe('validateLayerMeta — invariantes', () => {
  it('Invariante 1: rejeita principal com parentLayerId não-null', () => {
    const bad: LayerMeta = { ...principal, parentLayerId: 'some-id' } as unknown as LayerMeta;
    const { valid, errors } = validateLayerMeta([bad]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 1'))).toBe(true);
  });

  it('Invariante 2: rejeita operation com parentLayerId null', () => {
    const bad: LayerMeta = { ...operation, parentLayerId: null } as unknown as LayerMeta;
    const { valid, errors } = validateLayerMeta([bad]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 2'))).toBe(true);
  });

  it('Invariante 3: rejeita operation com operation field vazio', () => {
    const bad: OperationLayerMeta = { ...operation, operation: '   ' };
    const { valid, errors } = validateLayerMeta([principal, bad]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 3'))).toBe(true);
  });

  it('Invariante 4: rejeita operation com 0 machines', () => {
    const bad: OperationLayerMeta = { ...operation, machines: [] };
    const { valid, errors } = validateLayerMeta([principal, bad]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 4'))).toBe(true);
  });

  it('Invariante 4: rejeita operation com 4 machines (acima do limite)', () => {
    const bad: OperationLayerMeta = { ...operation, machines: ['MB', 'FB', 'DL', 'X4'] };
    const { valid, errors } = validateLayerMeta([principal, bad]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 4'))).toBe(true);
  });

  it('Invariante 5: rejeita operation com parentLayerId que não existe no array (layer órfã)', () => {
    // operation.parentLayerId = 'p1', but p1 is not in the array.
    const { valid, errors } = validateLayerMeta([operation]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 5') && e.includes('orphan'))).toBe(true);
  });

  it('Invariante 5: rejeita operation cujo parent existe mas não é principal', () => {
    // op2 points to op1 (an operation), not a principal.
    const op2: OperationLayerMeta = {
      ...operation,
      id: 'op2',
      parentLayerId: 'op1',
    };
    const { valid, errors } = validateLayerMeta([principal, operation, op2]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 5'))).toBe(true);
  });

  it('Invariante 6: rejeita visual com parentLayerId apontando pra operation (3 níveis proibidos)', () => {
    const badVisual: VisualLayerMeta = {
      ...visual,
      id: 'v-bad',
      parentLayerId: 'op1', // points to an operation layer → forbidden
    };
    const { valid, errors } = validateLayerMeta([principal, operation, badVisual]);
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('Invariant 6'))).toBe(true);
  });
});
