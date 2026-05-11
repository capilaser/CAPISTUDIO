/**
 * Testes do svg-text-converter (Onda 9, Fase 9D-bis).
 *
 * Cobre os 3 cenários obrigatórios do briefing:
 *   1. texto simples → <path> correto (sem <text>)
 *   2. fonte variável funciona OU fallback graceful
 *   3. fonte ausente → erro estruturado + mensagem clara
 *
 * Mais cenários por baixo: cache, multi-linha, escala/rotação,
 * RobotoSlab unsupported (variable font GSUB substFormat 2 não suportado).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type FontBufferLoader,
  TextConversionError,
  convertTextToSvgPath,
  loadFont,
  resetFontCache,
  tryConvertTextToSvgPath,
} from '@/core/export/svg-text-converter';

const FONTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../src-tauri/resources/fonts'
);

/** Loader real que lê fontes bundled do disco. */
function diskLoader(): FontBufferLoader {
  const map: Record<string, string> = {
    Montserrat: 'Montserrat-Variable.ttf',
    'Bebas Neue': 'BebasNeue-Regular.ttf',
    Caveat: 'Caveat-Variable.ttf',
    'Playfair Display': 'PlayfairDisplay-Variable.ttf',
    'Roboto Slab': 'RobotoSlab-Variable.ttf',
  };
  return async (family) => {
    const file = map[family];
    if (!file) return null;
    const buf = readFileSync(join(FONTS_DIR, file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };
}

describe('svg-text-converter (Onda 9 Fase 9D-bis)', () => {
  beforeEach(() => {
    resetFontCache();
  });

  // ── 1. Texto simples → <path> ─────────────────────────────────────────────
  it('texto simples vira <path d="..."> com fill da operação', async () => {
    const svg = await convertTextToSvgPath(
      {
        text: 'Capi',
        fontFamily: 'Montserrat',
        fontSize: 16,
        left: 100,
        top: 50,
        fill: '#FF0000',
      },
      diskLoader()
    );

    // Contém <path>, NÃO contém <text>.
    expect(svg).toMatch(/<path d="[^"]+"/);
    expect(svg).not.toContain('<text');
    // Fill da operação aplicado.
    expect(svg).toContain('fill="#FF0000"');
    // Stroke=none (texto vetorizado = fill puro, sem stroke).
    expect(svg).toContain('stroke="none"');
    // Wrapper <g transform> com translate pro left/top.
    expect(svg).toMatch(/<g transform="translate\(100 50\)/);
    // Path d tem comandos SVG válidos (começa com M).
    expect(svg).toMatch(/d="M[^"]+/);
  });

  // ── 2. Variable font funciona (Montserrat, Caveat, Playfair) ──────────────
  it('variable fonts suportadas pelo opentype.js produzem paths válidos', async () => {
    const loader = diskLoader();
    for (const family of ['Montserrat', 'Caveat', 'Playfair Display']) {
      const svg = await convertTextToSvgPath(
        { text: 'Teste', fontFamily: family, fontSize: 20, left: 0, top: 0, fill: '#000000' },
        loader
      );
      expect(svg).toMatch(/<path d="M[^"]+"/);
    }
  });

  // ── 3. Fonte ausente → erro estruturado ──────────────────────────────────
  it('fonte não registrada lança TextConversionError com kind=font-not-found', async () => {
    const emptyLoader: FontBufferLoader = async () => null;

    await expect(
      convertTextToSvgPath(
        { text: 'X', fontFamily: 'FonteQueNaoExiste', fontSize: 16, left: 0, top: 0, fill: '#000' },
        emptyLoader
      )
    ).rejects.toMatchObject({
      name: 'TextConversionError',
      kind: 'font-not-found',
      fontFamily: 'FonteQueNaoExiste',
    });
  });

  // ── Fallback graceful: variable font incompatível (Roboto Slab) ───────────
  it('variable font com tabela GSUB não suportada (Roboto Slab) lança font-unsupported', async () => {
    const err = await convertTextToSvgPath(
      { text: 'Teste', fontFamily: 'Roboto Slab', fontSize: 20, left: 0, top: 0, fill: '#000' },
      diskLoader()
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TextConversionError);
    expect((err as TextConversionError).kind).toBe('font-unsupported');
    expect((err as TextConversionError).fontFamily).toBe('Roboto Slab');
    expect((err as TextConversionError).message).toMatch(/GSUB|substFormat|substitutionType/);
  });

  // ── Cache: segunda chamada não rechama o loader ─────────────────────────
  it('cache: segunda conversão da mesma fonte não chama loader de novo', async () => {
    const loader = vi.fn(diskLoader());

    await convertTextToSvgPath(
      { text: 'A', fontFamily: 'Montserrat', fontSize: 16, left: 0, top: 0, fill: '#000' },
      loader
    );
    await convertTextToSvgPath(
      { text: 'B', fontFamily: 'Montserrat', fontSize: 16, left: 0, top: 0, fill: '#000' },
      loader
    );

    expect(loader).toHaveBeenCalledTimes(1);
  });

  // ── Cache de erro: fonte ausente cacheia erro ─────────────────────────────
  it('cache de erro: tentar converter com fonte ausente 2x chama loader 1x', async () => {
    const loader = vi.fn<FontBufferLoader>(async () => null);

    await expect(loadFont('Foo', loader)).rejects.toThrow();
    await expect(loadFont('Foo', loader)).rejects.toThrow();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  // ── Multi-linha: linhas empilhadas verticalmente ─────────────────────────
  it('texto com \\n produz path com múltiplas linhas posicionadas verticalmente', async () => {
    const svg = await convertTextToSvgPath(
      {
        text: 'Linha 1\nLinha 2',
        fontFamily: 'Montserrat',
        fontSize: 16,
        left: 0,
        top: 0,
        fill: '#000',
      },
      diskLoader()
    );
    // Cada linha gera comandos M independentes — deve haver pelo menos 2.
    const mCount = (svg.match(/M\d/g) || []).length;
    expect(mCount).toBeGreaterThanOrEqual(2);
  });

  // ── Transform: rotation e scale presentes quando informados ─────────────
  it('aplica rotate e scale como transform composto', async () => {
    const svg = await convertTextToSvgPath(
      {
        text: 'X',
        fontFamily: 'Bebas Neue',
        fontSize: 16,
        left: 10,
        top: 20,
        angle: 45,
        scaleX: 2,
        scaleY: 3,
        fill: '#000',
      },
      diskLoader()
    );
    expect(svg).toMatch(/translate\(10 20\)/);
    expect(svg).toMatch(/rotate\(45\)/);
    expect(svg).toMatch(/scale\(2 3\)/);
  });

  // ── tryConvertTextToSvgPath: erro estruturado em vez de throw ───────────
  it('tryConvertTextToSvgPath retorna { ok:false, error } para fonte ausente', async () => {
    const res = await tryConvertTextToSvgPath(
      { text: 'X', fontFamily: 'Inexistente', fontSize: 16, left: 0, top: 0, fill: '#000' },
      async () => null
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(TextConversionError);
      expect(res.error.kind).toBe('font-not-found');
    }
  });

  it('tryConvertTextToSvgPath retorna { ok:true, svg } para sucesso', async () => {
    const res = await tryConvertTextToSvgPath(
      { text: 'X', fontFamily: 'Bebas Neue', fontSize: 16, left: 0, top: 0, fill: '#000' },
      diskLoader()
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.svg).toMatch(/<path d=/);
    }
  });
});
