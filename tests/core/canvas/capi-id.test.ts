import { describe, expect, it } from 'vitest';

import { newLayerId, newObjectId } from '@/core/canvas/capi-id';

describe('capi-id', () => {
  it('gera IDs de objeto com prefixo obj-', () => {
    const id = newObjectId();
    expect(id).toMatch(/^obj-[A-Z0-9]{8}$/);
  });

  it('gera IDs de camada com prefixo lay-', () => {
    const id = newLayerId();
    expect(id).toMatch(/^lay-[A-Z0-9]{8}$/);
  });

  it('IDs sao unicos entre chamadas (1000 amostras)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(newObjectId());
    expect(set.size).toBe(1000);
  });
});
