import { describe, expect, it } from 'vitest';

import { getCapiId } from '@/core/canvas/capi-id';

describe('getCapiId', () => {
  it('retorna obj.id quando presente (caminho normal)', () => {
    const obj = { id: 'abc-123' };
    expect(getCapiId(obj)).toBe('abc-123');
  });

  it('retorna capiSlot.id quando obj.id está ausente (caminho slot)', () => {
    const obj = { capiSlot: { id: 'slot-uuid', type: 'nome' } };
    expect(getCapiId(obj)).toBe('slot-uuid');
  });

  it('retorna undefined quando nem obj.id nem capiSlot.id existem', () => {
    expect(getCapiId({})).toBeUndefined();
    expect(getCapiId({ capiSlot: undefined })).toBeUndefined();
    expect(getCapiId({ id: '' })).toBeUndefined(); // string vazia ≠ id válido
    expect(getCapiId({ capiSlot: {} })).toBeUndefined(); // capiSlot sem id
  });

  it('prioriza obj.id sobre capiSlot.id quando ambos presentes', () => {
    // Caso teórico — não deveria acontecer no runtime, mas a função é determinística.
    const obj = { id: 'direct', capiSlot: { id: 'slot-id' } };
    expect(getCapiId(obj)).toBe('direct');
  });
});
