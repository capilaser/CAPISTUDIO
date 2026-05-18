import { describe, expect, it } from 'vitest';

import { buildChapaExportInfos, sanitizeForFilename } from '@/core/export/chapa-export-info';
import type { ChapasLayout } from '@/hooks/useBoardEngine';

describe('sanitizeForFilename', () => {
  it('lowercases, strips diacritics, replaces spaces with underscore', () => {
    expect(sanitizeForFilename('Broche 60x25')).toBe('broche_60x25');
    expect(sanitizeForFilename('Placa Profissão')).toBe('placa_profissao');
  });

  it('removes non-alphanumeric junk and collapses underscores', () => {
    expect(sanitizeForFilename('  Foo!@#$ Bar  ')).toBe('foo_bar');
  });

  it('is idempotent', () => {
    const once = sanitizeForFilename('Broche 60x25');
    expect(sanitizeForFilename(once)).toBe(once);
  });
});

describe('buildChapaExportInfos', () => {
  // Layout simulado: 1 chapa de broches (2 items 60x25)
  const layoutSingleChapa: ChapasLayout = {
    chapas: [
      {
        productId: 'broche-60x25',
        itemCount: 2,
        items: [
          { originalIndex: 0, leftMm: 0, topMm: 8, widthMm: 60, heightMm: 25 },
          { originalIndex: 1, leftMm: 0, topMm: 37, widthMm: 60, heightMm: 25 },
        ],
        bbox: { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 70 }, // 8 (label) + 25 + 4 + 25 + 8 sobra
      },
    ],
    positions: [
      { leftMm: 0, topMm: 8 },
      { leftMm: 0, topMm: 37 },
    ],
    boardWidthMm: 60,
    boardHeightMm: 70,
  };

  it('disconta label-height do topo no bboxMm', () => {
    const labels = new Map([['broche-60x25', 'Broche 60x25']]);
    const infos = buildChapaExportInfos(layoutSingleChapa, labels);
    expect(infos).toHaveLength(1);
    expect(infos[0].bboxMm.topMm).toBe(8); // descontou o label
    expect(infos[0].bboxMm.heightMm).toBe(62); // 70 - 8
    expect(infos[0].bboxMm.leftMm).toBe(0);
    expect(infos[0].bboxMm.widthMm).toBe(60);
  });

  it('converte bboxMm pra bboxPx com 4 px/mm', () => {
    const labels = new Map([['broche-60x25', 'Broche 60x25']]);
    const infos = buildChapaExportInfos(layoutSingleChapa, labels);
    expect(infos[0].bboxPx).toEqual({
      leftPx: 0,
      topPx: 32, // 8 mm × 4
      rightPx: 240, // 60 mm × 4
      bottomPx: 280, // (8 + 62) × 4
    });
  });

  it('usa productId como fallback quando productLabel está ausente', () => {
    const infos = buildChapaExportInfos(layoutSingleChapa, new Map());
    expect(infos[0].displayLabel).toBe('broche-60x25');
    expect(infos[0].filenameToken).toBe('broche-60x25');
  });

  it('preserva itemIndexes na ordem', () => {
    const labels = new Map([['broche-60x25', 'Broche 60x25']]);
    const infos = buildChapaExportInfos(layoutSingleChapa, labels);
    expect(infos[0].itemIndexes).toEqual([0, 1]);
  });

  it('lida com 2 chapas distintas (broche + placa) com offset horizontal', () => {
    const twoChapas: ChapasLayout = {
      chapas: [
        {
          productId: 'broche-60x25',
          itemCount: 1,
          items: [{ originalIndex: 0, leftMm: 0, topMm: 8, widthMm: 60, heightMm: 25 }],
          bbox: { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 33 },
        },
        {
          productId: 'placa-300x90',
          itemCount: 1,
          items: [{ originalIndex: 1, leftMm: 90, topMm: 8, widthMm: 300, heightMm: 90 }],
          bbox: { leftMm: 90, topMm: 0, widthMm: 300, heightMm: 98 },
        },
      ],
      positions: [
        { leftMm: 0, topMm: 8 },
        { leftMm: 90, topMm: 8 },
      ],
      boardWidthMm: 390,
      boardHeightMm: 98,
    };
    const labels = new Map([
      ['broche-60x25', 'Broche 60x25'],
      ['placa-300x90', 'Placa Profissão 300x90'],
    ]);
    const infos = buildChapaExportInfos(twoChapas, labels);

    expect(infos).toHaveLength(2);
    expect(infos[0].filenameToken).toBe('broche_60x25');
    expect(infos[1].filenameToken).toBe('placa_profissao_300x90');
    expect(infos[0].itemIndexes).toEqual([0]);
    expect(infos[1].itemIndexes).toEqual([1]);
    // 2ª chapa começa em x=90mm = 360px
    expect(infos[1].bboxPx.leftPx).toBe(360);
  });

  it('retorna [] pra layout vazio', () => {
    const empty: ChapasLayout = {
      chapas: [],
      positions: [],
      boardWidthMm: 0,
      boardHeightMm: 0,
    };
    expect(buildChapaExportInfos(empty, new Map())).toEqual([]);
  });
});
