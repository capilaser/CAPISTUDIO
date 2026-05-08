import { describe, it, expect } from 'vitest';

import { seedFonts } from '@/data/seeds/seedFonts';

describe('seedFonts', () => {
  it('é no-op e retorna zero inserções', async () => {
    const result = await seedFonts({} as never);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
  });
});
