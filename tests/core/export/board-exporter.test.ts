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

// Mock do dxf-exporter — só interceptamos exportDxfByMachineAndOperation.
// makeDxfBucketKey/parseDxfBucketKey passam direto (precisamos do real
// pro wrapper achatar buckets em (machineId, operation)).
vi.mock('@/core/export/dxf-exporter', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/dxf-exporter')>(
    '@/core/export/dxf-exporter'
  );
  return {
    ...actual,
    exportDxfByMachineAndOperation: vi.fn(),
  };
});

import { exportSvgByMachine } from '@/core/export/svg-exporter';
import { exportDxfByMachineAndOperation, makeDxfBucketKey } from '@/core/export/dxf-exporter';
import {
  computeBoardBounds,
  exportBoardDxfByChapa,
  exportBoardSvg,
  exportBoardSvgByChapa,
  extractInnerScaledGroup,
  wrapAsBoardSvg,
  type BoardChapaDescriptor,
  type BoardItemExport,
} from '@/core/export/board-exporter';

const mockExportSvgByMachine = exportSvgByMachine as unknown as ReturnType<typeof vi.fn>;
const mockExportDxf = exportDxfByMachineAndOperation as unknown as ReturnType<typeof vi.fn>;

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
  mockExportDxf.mockReset();
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

// ── Onda 27 (Fase C.3) — Export SVG por chapa ────────────────────────────────

function makeChapa(
  productId: string,
  bbox: { leftMm: number; topMm: number; widthMm: number; heightMm: number },
  filenameToken?: string
): BoardChapaDescriptor {
  return {
    chapaId: productId,
    filenameToken: filenameToken ?? productId.toLowerCase(),
    bboxMm: bbox,
  };
}

describe('exportBoardSvgByChapa', () => {
  it('retorna lista vazia quando chapas é vazio (não chama exportSvgByMachine)', async () => {
    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 100,
      boardHeightMm: 50,
      chapas: [],
      assetLookup: noopLookup,
    });
    expect(out).toEqual([]);
    expect(mockExportSvgByMachine).not.toHaveBeenCalled();
  });

  it('retorna lista vazia quando canvas não tem nada exportável', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());

    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 100,
      boardHeightMm: 50,
      chapas: [makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 })],
      assetLookup: noopLookup,
    });
    expect(out).toEqual([]);
  });

  it('chama exportSvgByMachine UMA vez no canvas inteiro (boardDims), não 1x por chapa', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());

    await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    expect(mockExportSvgByMachine).toHaveBeenCalledTimes(1);
    const opts = mockExportSvgByMachine.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.productWidthMm).toBe(200);
    expect(opts.productHeightMm).toBe(100);
  });

  it('2 chapas × 1 máquina → 2 SVGs com viewBox da chapa e translate negativo', async () => {
    const fullSvg = fakeItemSvg('<rect x="0" y="0" width="10" height="5"/>', 200, 100);
    mockExportSvgByMachine.mockResolvedValueOnce(new Map([['fiber-laser', fullSvg]]));

    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }, 'broche_60x25'),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }, 'placa_100x40'),
      ],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(2);

    const brocheSvg = out.find((r) => r.chapaId === 'broche')!;
    expect(brocheSvg.machineId).toBe('fiber-laser');
    expect(brocheSvg.filenameToken).toBe('broche_60x25');
    expect(brocheSvg.svg).toContain('viewBox="0 0 60 25"');
    expect(brocheSvg.svg).toContain('<g transform="translate(0 0)">');

    const placaSvg = out.find((r) => r.chapaId === 'placa')!;
    expect(placaSvg.svg).toContain('viewBox="0 0 100 40"');
    expect(placaSvg.svg).toContain('<g transform="translate(-70 0)">');
  });

  it('1 chapa × 2 máquinas → 2 SVGs distintos, ambos com viewBox da chapa', async () => {
    mockExportSvgByMachine.mockResolvedValueOnce(
      new Map([
        ['fiber-laser', fakeItemSvg('<rect data-op="cut"/>', 200, 100)],
        ['master-biro', fakeItemSvg('<rect data-op="mark"/>', 200, 100)],
      ])
    );

    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 })],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(2);
    const machines = out.map((r) => r.machineId).sort();
    expect(machines).toEqual(['fiber-laser', 'master-biro']);
    for (const r of out) {
      expect(r.chapaId).toBe('broche');
      expect(r.svg).toContain('viewBox="0 0 60 25"');
    }
    expect(out.find((r) => r.machineId === 'fiber-laser')!.svg).toContain('data-op="cut"');
    expect(out.find((r) => r.machineId === 'master-biro')!.svg).toContain('data-op="mark"');
  });

  it('2 chapas × 2 máquinas → 4 arquivos no resultado', async () => {
    mockExportSvgByMachine.mockResolvedValueOnce(
      new Map([
        ['fiber-laser', fakeItemSvg('<rect data-op="cut"/>', 200, 100)],
        ['master-biro', fakeItemSvg('<rect data-op="mark"/>', 200, 100)],
      ])
    );

    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(4); // 2 chapas × 2 máquinas
    // Cada (chapa, máquina) único:
    const keys = out.map((r) => `${r.chapaId}/${r.machineId}`).sort();
    expect(keys).toEqual([
      'broche/fiber-laser',
      'broche/master-biro',
      'placa/fiber-laser',
      'placa/master-biro',
    ]);
  });

  it('chapa em offset (não-origem) usa translate negativo correto', async () => {
    mockExportSvgByMachine.mockResolvedValueOnce(
      new Map([['fiber-laser', fakeItemSvg('<rect/>', 300, 150)]])
    );

    const out = await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 300,
      boardHeightMm: 150,
      chapas: [
        // chapa começa em (150mm, 50mm), tamanho 80×40
        makeChapa('placa', { leftMm: 150, topMm: 50, widthMm: 80, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(1);
    expect(out[0].svg).toContain('viewBox="0 0 80 40"');
    expect(out[0].svg).toContain('<g transform="translate(-150 -50)">');
  });

  it('propaga assetLookup, fontBufferLoader e textRouting pra exportSvgByMachine', async () => {
    mockExportSvgByMachine.mockResolvedValue(new Map());
    const lookup = vi.fn();
    const loader = vi.fn();
    const routing = new Map();

    await exportBoardSvgByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 100,
      boardHeightMm: 50,
      chapas: [makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 })],
      assetLookup: lookup as unknown as typeof noopLookup,
      fontBufferLoader: loader as unknown as Parameters<
        typeof exportBoardSvgByChapa
      >[0]['fontBufferLoader'],
      textRouting: routing,
    });

    const opts = mockExportSvgByMachine.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.assetLookup).toBe(lookup);
    expect(opts.fontBufferLoader).toBe(loader);
    expect(opts.textRouting).toBe(routing);
  });
});

// ── Onda 27 (Fase C.4) — Export DXF por chapa ────────────────────────────────

describe('exportBoardDxfByChapa', () => {
  it('retorna lista vazia quando chapas é vazio (não chama exportDxf)', async () => {
    const out = await exportBoardDxfByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [],
      assetLookup: noopLookup,
    });
    expect(out).toEqual([]);
    expect(mockExportDxf).not.toHaveBeenCalled();
  });

  it('chama exportDxf 1x POR CHAPA (não 1x global)', async () => {
    mockExportDxf.mockResolvedValue(new Map());

    await exportBoardDxfByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    expect(mockExportDxf).toHaveBeenCalledTimes(2);
  });

  it('passa clipBoundsMm correto pra cada chamada', async () => {
    mockExportDxf.mockResolvedValue(new Map());

    await exportBoardDxfByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 300,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
        makeChapa('placa', { leftMm: 70, topMm: 10, widthMm: 100, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    const call0 = mockExportDxf.mock.calls[0][1] as Record<string, unknown>;
    const call1 = mockExportDxf.mock.calls[1][1] as Record<string, unknown>;

    expect(call0.clipBoundsMm).toEqual({
      leftMm: 0,
      topMm: 0,
      widthMm: 60,
      heightMm: 25,
    });
    expect(call1.clipBoundsMm).toEqual({
      leftMm: 70,
      topMm: 10,
      widthMm: 100,
      heightMm: 40,
    });
    // productWidthMm/heightMm sempre = prancha inteira (motor precisa do
    // sistema de coords absolutas; clip é aplicado dentro).
    expect(call0.productWidthMm).toBe(300);
    expect(call0.productHeightMm).toBe(100);
    expect(call1.productWidthMm).toBe(300);
    expect(call1.productHeightMm).toBe(100);
  });

  it('achata Map<bucketKey, dxfString> em (chapaId, machineId, operation)', async () => {
    // Chapa 1: 1 bucket (fiber|corte). Chapa 2: 2 buckets (fiber|corte e
    // master-biro|marcacao).
    mockExportDxf
      .mockResolvedValueOnce(new Map([[makeDxfBucketKey('fiber-laser', 'corte'), 'DXF1']]))
      .mockResolvedValueOnce(
        new Map([
          [makeDxfBucketKey('fiber-laser', 'corte'), 'DXF2'],
          [makeDxfBucketKey('master-biro', 'marcacao'), 'DXF3'],
        ])
      );

    const out = await exportBoardDxfByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }, 'broche_60x25'),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }, 'placa_100x40'),
      ],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(3);

    const keys = out.map((r) => `${r.chapaId}/${r.machineId}/${r.operation}`).sort();
    expect(keys).toEqual([
      'broche/fiber-laser/corte',
      'placa/fiber-laser/corte',
      'placa/master-biro/marcacao',
    ]);

    // filenameToken preservado por resultado.
    const broche = out.find((r) => r.chapaId === 'broche')!;
    expect(broche.filenameToken).toBe('broche_60x25');
    expect(broche.dxf).toBe('DXF1');
    const placa = out.find((r) => r.chapaId === 'placa' && r.machineId === 'master-biro')!;
    expect(placa.filenameToken).toBe('placa_100x40');
    expect(placa.dxf).toBe('DXF3');
  });

  it('chapa sem buckets (operador deixou aquele espaço vazio) não contribui — sem erro', async () => {
    mockExportDxf
      .mockResolvedValueOnce(new Map([[makeDxfBucketKey('fiber-laser', 'corte'), 'DXF1']]))
      .mockResolvedValueOnce(new Map()); // chapa 2 vazia

    const out = await exportBoardDxfByChapa({
      canvas: {} as fabric.Canvas,
      layers: [],
      boardWidthMm: 200,
      boardHeightMm: 100,
      chapas: [
        makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
        makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }),
      ],
      assetLookup: noopLookup,
    });

    expect(out).toHaveLength(1);
    expect(out[0].chapaId).toBe('broche');
  });

  it('erro de uma chapa é propagado com prefixo do chapaId', async () => {
    mockExportDxf
      .mockResolvedValueOnce(new Map())
      .mockRejectedValueOnce(new Error('asset não encontrado'));

    await expect(
      exportBoardDxfByChapa({
        canvas: {} as fabric.Canvas,
        layers: [],
        boardWidthMm: 200,
        boardHeightMm: 100,
        chapas: [
          makeChapa('broche', { leftMm: 0, topMm: 0, widthMm: 60, heightMm: 25 }),
          makeChapa('placa', { leftMm: 70, topMm: 0, widthMm: 100, heightMm: 40 }),
        ],
        assetLookup: noopLookup,
      })
    ).rejects.toThrow(/\[board-exporter\] DXF chapa "placa".*asset não encontrado/);
  });
});
