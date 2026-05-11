import { describe, expect, it } from 'vitest';

import { normalizeAssetName } from '@/lib/normalize-asset-name';

describe('normalizeAssetName (Onda 8.5)', () => {
  // ── 1. Caso real do projeto ────────────────────────────────────────────────
  it('BALANÇA ADVOGADO.svg → balanca-advogado.svg', () => {
    expect(normalizeAssetName('BALANÇA ADVOGADO.svg')).toBe('balanca-advogado.svg');
  });

  // ── 2. Múltiplos espaços viram hífen único ────────────────────────────────
  it('Médico  Dentista.svg → medico-dentista.svg (colapsa hífens)', () => {
    expect(normalizeAssetName('Médico  Dentista.svg')).toBe('medico-dentista.svg');
  });

  // ── 3. Caracteres especiais são removidos; sequências viram um hífen ──────
  it('Dr@ ANA & cia.svg → dr-ana-cia.svg', () => {
    expect(normalizeAssetName('Dr@ ANA & cia.svg')).toBe('dr-ana-cia.svg');
  });

  // ── 4. Extensão sempre lowercase ───────────────────────────────────────────
  it('Foo.SVG → foo.svg (extensão lowercase)', () => {
    expect(normalizeAssetName('Foo.SVG')).toBe('foo.svg');
  });

  // ── 5. Bônus: preserva acentos múltiplos ───────────────────────────────────
  it('Ação ÇãO.svg → acao-cao.svg', () => {
    expect(normalizeAssetName('Ação ÇãO.svg')).toBe('acao-cao.svg');
  });
});
