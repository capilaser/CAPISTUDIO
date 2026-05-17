/**
 * Testes do board-exporter (Onda 13, Fase D).
 *
 * Estratégia: mocka `exportSvgByMachine` via vi.mock, testa só a orquestração
 * (chamada N vezes, merge por máquina, viewBox da prancha, translate por item).
 * Helpers puros (computeBoardBounds, extractInnerScaledGroup, wrapAsBoardSvg)
 * têm cobertura unitária separada.
 *
 * Os testes do svg-exporter (Onda 9) já cobrem o motor real — duplicar lógica
 * aqui só pra exercitar fabric.Canvas é desperdício.
 */
import * as fabric from 'fabric';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LayerMeta } from '@/data/schema';
import {
  type AssetExportInfo,
  type AssetLookupFn,
  wrapAsProductSvg,
} from '@/core/export/svg-exporter';

// Mock do svg-exporter — só interceptamos exportSvgByMachine.
// recolorSvgFragment / wrapAsProductSvg passam direto (precisamos do real).
vi.mock('@/core/export/svg-exporter', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/svg-exporter')>(
    '@/core/export/svg-exporter'
  );
  return {
    ...actual,
    exportSvgByMachine: vi.fn(),
  };
});

import { exportSvgByMachine } from '@/core/export/svg-exporter';
import {
  computeBoardBounds,
  exportBoardSvg,
  extractInnerScaledGroup,
  wrapAsBoardSvg,
  type BoardItemExport,
} from '@/core/export/board-exporter';

const mockExportSvgByMachine = exportSvgByMachine as unknown as ReturnType<typeof vi.fn>;

// Helper: cria item de prancha com canvas fake (não importa, é mockado).
function makeItem(overrides: Partial<BoardItemExport> = {}): BoardItemExport {
  return {
    canvas: {} as fabric.Canvas,
    layers: [] as LayerMeta[],
    productWidthMm: 60,
    productHeightMm: 25,
    offsetXmm: 0,
    offsetYmm: 0,
    ...overrides,
  };
}

// Helper: cria SVG fake compatível com wrapAsProductSvg (formato real).
function fakeItemSvg(content: string, widthMm = 60, heightMm = 25): string {
  return wrapAsProductSvg(content, widthMm, heightMm);
}

const noopLookup: AssetLookupFn = async () => null as AssetExportInfo | null;

beforeEach(() => {
  mockExportSvgByMachine.mockReset();
});

// ── Helpers puros ────────────────────────────────────────────────────────────

describe('computeBoardBounds', () => {
  it('retorna {0,0} para array vazio', () => {
    expect(computeBoardBounds([])).toEqual({ widthMm: 0, heightMm: 0 });
  });

  it('1 item em (0,0) → bounds = tamanho do produto', () => {
    const bounds = computeBoardBounds([makeItem()]);
    expect(bounds).toEqual({ widthMm: 60, heightMm: 25 });
  });

  it('2 items empilhados na coluna 1 → altura soma', () => {
    const items = [
      makeItem({ offsetYmm: 0 }),
      makeItem({ offsetYmm: 29 }), // 25 + gap 4
    ];
    const bounds = computeBoardBounds(items);
    expect(bounds.widthMm).toBe(60);
    expect(bounds.heightMm).toBe(54); // 29 + 25
  });

  it('coluna 2 (offset X) é refletida no width', () => {
    const items = [
      makeItem({ offsetXmm: 0, offsetYmm: 0 }),
      makeItem({ offsetXmm: 68, offsetYmm: 0 }), // 60 + 8mm gap horizontal
    ];
    const bounds = computeBoardBounds(items);
    expect(bounds.widthMm).toBe(128); // 68 + 60
    expect(bounds.heightMm).toBe(25);
  });

  it('items de tamanhos diferentes — bounds usa o maior canto inferior-direito', () => {
    const items = [
      makeItem({ productWidthMm: 60, productHeightMm: 25, offsetYmm: 0 }),
      makeItem({ productWidthMm: 100, productHeightMm: 40, offsetYmm: 29 }),
    ];
    const bounds = computeBoardBounds(items);
    expect(bounds.widthMm).toBe(100);
    expect(bounds.heightMm).toBe(69); // 29 + 40
  });
});

describe('extractInnerScaledGroup', () => {
  it('extrai o conteúdo entre <g transform="scale(...)"> e </g></svg>', () => {
    const svg = wrapAsProductSvg('<rect x="0" y="0" width="10" height="5"/>', 60, 25);
    const inner = extractInnerScaledGroup(svg);
    expect(inner).not.toBeNull();
    expect(inner).toContain('<g transform="scale(0.25)">');
    expect(inner).toContain('<rect x="0" y="0" width="10" height="5"/>');
    expect(inner).toContain('</g>');
    // Não deve incluir o </svg> nem o header XML.
    expect(inner).not.toContain('<?xml');
    expect(inner).not.toContain('</svg>');
  });

  it('retorna null para SVG sem o wrapper de scale', () => {
    const svg = '<svg><rect/></svg>';
    expect(extractInnerScaledGroup(svg)).toBeNull();
  });

  it('aceita scale com qualquer valor numérico', () => {
    const svg = '<svg><g transform="scale(0.5)"><path d="M0 0"/></g></svg>';
    const inner = extractInnerScaledGroup(svg);
    expect(inner).toContain('scale(0.5)');
    expect(inner).toContain('<path d="M0 0"/>');
  });
});

describe('wrapAsBoardSvg', () => {
  it('emite SVG completo com viewBox da prancha em mm', () => {
    const svg = wrapAsBoardSvg('<g><rect/></g>', { widthMm: 128, heightMm: 54 });
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('width="128mm"');
    expect(svg).toContain('height="54mm"');
    expect(svg).toContain('viewBox="0 0 128 54"');
    expect(svg).toContain('<g><rect/></g>');
  });
});

// ── Orquestração principal ───────────────────────────────────────────────────

describe('exportBoardSvg', () => {
  it('retorna Map vazio quando items é vazio (não chama exportSvgByMachine)', async () => {
    const out = await exportBoardSvg({ items: [], assetLookup: noopLookup });
    expect(out.size).toBe(0);
    expect(mockExportSvgByMachine).not.toHaveBeenCalled();
  });

  it('chama exportSvgByMachine 1x por item, na ordem', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());

    await exportBoardSvg({
      items: [makeItem(), makeItem(), makeItem()],
      assetLookup: noopLookup,
    });

    expect(mockExportSvgByMachine).toHaveBeenCalledTimes(3);
  });

  it('retorna Map vazio quando nenhum item produz SVG (todos os items vazios)', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());

    const out = await exportBoardSvg({
      items: [makeItem(), makeItem()],
      assetLookup: noopLookup,
    });

    expect(out.size).toBe(0);
  });

  it('1 item / 1 máquina → SVG da prancha com 1 translate(0,0)', async () => {
    const itemSvg = fakeItemSvg('<rect x="1" y="2" width="3" height="4"/>');
    mockExportSvgByMachine.mockResolvedValueOnce(new Map([['fiber-laser', itemSvg]]));

    const out = await exportBoardSvg({
      items: [makeItem({ offsetXmm: 0, offsetYmm: 0 })],
      assetLookup: noopLookup,
    });

    expect(out.size).toBe(1);
    const board = out.get('fiber-laser')!;
    expect(board).toContain('<svg');
    expect(board).toContain('viewBox="0 0 60 25"');
    expect(board).toContain('<g transform="translate(0 0)">');
    expect(board).toContain('<rect x="1" y="2"');
  });

  it('2 items empilhados na mesma máquina → SVG com 2 translates diferentes', async () => {
    const svg1 = fakeItemSvg('<rect data-item="1"/>');
    const svg2 = fakeItemSvg('<rect data-item="2"/>');
    mockExportSvgByMachine
      .mockResolvedValueOnce(new Map([['fiber-laser', svg1]]))
      .mockResolvedValueOnce(new Map([['fiber-laser', svg2]]));

    const out = await exportBoardSvg({
      items: [makeItem({ offsetXmm: 0, offsetYmm: 0 }), makeItem({ offsetXmm: 0, offsetYmm: 29 })],
      assetLookup: noopLookup,
    });

    const board = out.get('fiber-laser')!;
    expect(board).toContain('<g transform="translate(0 0)">');
    expect(board).toContain('<g transform="translate(0 29)">');
    expect(board).toContain('data-item="1"');
    expect(board).toContain('data-item="2"');
    expect(board).toContain('viewBox="0 0 60 54"'); // 29+25
  });

  it('2 máquinas (1 item em cada) → 2 SVGs distintos', async () => {
    const fiberSvg = fakeItemSvg('<rect data-op="cut"/>');
    const masterSvg = fakeItemSvg('<rect data-op="mark"/>');
    mockExportSvgByMachine.mockResolvedValueOnce(
      new Map([
        ['fiber-laser', fiberSvg],
        ['master-biro', masterSvg],
      ])
    );

    const out = await exportBoardSvg({
      items: [makeItem()],
      assetLookup: noopLookup,
    });

    expect(out.size).toBe(2);
    expect(out.get('fiber-laser')).toContain('data-op="cut"');
    expect(out.get('master-biro')).toContain('data-op="mark"');
  });

  it('item sem nada pra máquina X é ignorado nesse SVG (não emite translate vazio)', async () => {
    // Item 0: tem fiber-laser. Item 1: só master-biro.
    mockExportSvgByMachine
      .mockResolvedValueOnce(new Map([['fiber-laser', fakeItemSvg('<rect data-item="0"/>')]]))
      .mockResolvedValueOnce(new Map([['master-biro', fakeItemSvg('<rect data-item="1"/>')]]));

    const out = await exportBoardSvg({
      items: [makeItem({ offsetYmm: 0 }), makeItem({ offsetYmm: 29 })],
      assetLookup: noopLookup,
    });

    const fiber = out.get('fiber-laser')!;
    expect(fiber).toContain('data-item="0"');
    expect(fiber).not.toContain('data-item="1"');
    expect(fiber).not.toContain('translate(0 29)'); // item 1 não entra aqui

    const master = out.get('master-biro')!;
    expect(master).toContain('data-item="1"');
    expect(master).not.toContain('data-item="0"');
  });

  it('propaga erro com prefixo de item index quando exportSvgByMachine lança', async () => {
    mockExportSvgByMachine
      .mockResolvedValueOnce(new Map())
      .mockRejectedValueOnce(new Error('asset não encontrado'));

    await expect(
      exportBoardSvg({
        items: [makeItem(), makeItem()],
        assetLookup: noopLookup,
      })
    ).rejects.toThrow(/\[board-exporter\] item 1.*asset não encontrado/);
  });

  it('passa assetLookup, fontBufferLoader e textRouting pra todas as chamadas', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());
    const lookup = vi.fn();
    const loader = vi.fn();
    const routing = new Map();

    await exportBoardSvg({
      items: [makeItem(), makeItem()],
      assetLookup: lookup as unknown as AssetLookupFn,
      fontBufferLoader: loader as unknown as Parameters<
        typeof exportBoardSvg
      >[0]['fontBufferLoader'],
      textRouting: routing,
    });

    for (const call of mockExportSvgByMachine.mock.calls) {
      const opts = call[1] as Record<string, unknown>;
      expect(opts.assetLookup).toBe(lookup);
      expect(opts.fontBufferLoader).toBe(loader);
      expect(opts.textRouting).toBe(routing);
    }
  });
});
