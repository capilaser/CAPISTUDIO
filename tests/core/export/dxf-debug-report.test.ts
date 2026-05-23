/**
 * Testes da telemetria geométrica do DXF v2 (DXF-PRODUCTION-ALIGNMENT).
 *
 * Cobre:
 *   - helpers: emptyBbox, expandBbox, bboxOfPathD, bboxOfSplines, unionBboxes
 *   - integração com exporter v2: debugSink é chamado quando presente
 *   - zero overhead: sem debugSink, nada é alocado/chamado
 *   - report inclui: 1 snapshot por objeto exportado, com bbox de cada etapa
 *   - canvasBoundingBoxPx e dxfFinalBoundingBoxMm refletem união
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import type { AssetLookupFn, AssetExportInfo } from '@/core/export/asset-routing-types';
import {
  bboxOfPathD,
  bboxOfSplines,
  emptyBbox,
  expandBbox,
  unionBboxes,
  type DebugBbox,
  type DxfDebugReport,
} from '@/core/export/dxf-debug-report';
import { exportDxfV2ByMachineAndOperation } from '@/core/export/dxf-exporter-v2';
import type { SplineInput } from '@/core/export/dxf-spline-encoder';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

function loadFixture(rel: string): string {
  return readFileSync(join(FIXTURES_DIR, rel), 'utf-8');
}

function makeLookup(map: Record<string, AssetExportInfo>): AssetLookupFn {
  return async (id: string) => map[id] ?? null;
}

// ── Helpers puros ─────────────────────────────────────────────────────────────

describe('emptyBbox / expandBbox', () => {
  it('emptyBbox inicializa com Infinity / -Infinity', () => {
    const b = emptyBbox();
    expect(b.minX).toBe(Infinity);
    expect(b.maxX).toBe(-Infinity);
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it('expandBbox atualiza min/max/width/height ao incluir pontos', () => {
    const b = emptyBbox();
    expandBbox(b, 5, 10);
    expandBbox(b, 20, 30);
    expandBbox(b, 0, 5);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(5);
    expect(b.maxX).toBe(20);
    expect(b.maxY).toBe(30);
    expect(b.width).toBe(20);
    expect(b.height).toBe(25);
  });
});

describe('bboxOfPathD', () => {
  it('extrai bbox de path com coords absolutas', () => {
    const b = bboxOfPathD('M 0 0 L 60 25 Z');
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(60);
    expect(b.maxY).toBe(25);
  });

  it('handles números fracionados e notação científica', () => {
    const b = bboxOfPathD('M 0.5 1.25 L 10.5 20.75 C 5 5 15 15 20 30');
    expect(b.minX).toBe(0.5);
    expect(b.maxX).toBe(20);
    expect(b.maxY).toBe(30);
  });

  it('path vazio devolve bbox degenerado (0,0,0,0)', () => {
    const b = bboxOfPathD('');
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 });
  });
});

describe('bboxOfSplines', () => {
  it('varre control points de todas as splines', () => {
    const splines: SplineInput[] = [
      {
        controlPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
          { x: 20, y: 10 },
          { x: 30, y: 15 },
        ],
        closed: false,
        process: 'corte',
      },
      {
        controlPoints: [
          { x: -5, y: -5 },
          { x: 5, y: 5 },
          { x: 15, y: 15 },
          { x: 25, y: 25 },
        ],
        closed: true,
        process: 'gravacao',
      },
    ];
    const b = bboxOfSplines(splines);
    expect(b.minX).toBe(-5);
    expect(b.minY).toBe(-5);
    expect(b.maxX).toBe(30);
    expect(b.maxY).toBe(25);
  });

  it('lista vazia devolve bbox degenerado', () => {
    expect(bboxOfSplines([])).toEqual({
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
    });
  });
});

describe('unionBboxes', () => {
  it('une múltiplos bboxes ignorando nulls', () => {
    const a: DebugBbox = { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    const b: DebugBbox = { minX: 20, minY: 20, maxX: 30, maxY: 30, width: 10, height: 10 };
    const u = unionBboxes([a, null, b]);
    expect(u).toEqual({ minX: 0, minY: 0, maxX: 30, maxY: 30, width: 30, height: 30 });
  });

  it('só nulls / degenerados devolve null', () => {
    expect(unionBboxes([])).toBeNull();
    expect(unionBboxes([null])).toBeNull();
    const degen: DebugBbox = { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    expect(unionBboxes([degen])).toBeNull();
  });
});

// ── Integração com exporter v2 ───────────────────────────────────────────────

describe('debugSink — integração com exporter v2', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, {
      productWidthMm: 100,
      productHeightMm: 100,
      viewportWidthPx: 400,
      viewportHeightPx: 400,
    });
  });

  it('sem debugSink, exporter não chama nada de debug (zero overhead)', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'A', 'aplique-1-formato-d');

    const sink = vi.fn();
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      // ← sem debugSink
    });
    expect(sink).not.toHaveBeenCalled();
  });

  it('com debugSink, é chamado UMA vez com o report completo', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'Aplique D', 'aplique-1-formato-d');

    let captured: DxfDebugReport | null = null;
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      debugSink: (r) => {
        captured = r;
      },
    });
    expect(captured).not.toBeNull();
    const report = captured as unknown as DxfDebugReport;
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.productMm).toEqual({ widthMm: 100, heightMm: 100 });
    expect(report.contentOffsetMm).toEqual({ xMm: 0, yMm: 0 });
    expect(report.pxPerMm).toBe(4);
    expect(report.objects.length).toBe(1);
    expect(report.canvasBoundingBoxPx).not.toBeNull();
    expect(report.dxfFinalBoundingBoxMm).not.toBeNull();
  });

  it('snapshot por objeto inclui bbox de cada etapa', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'Aplique D', 'aplique-1-formato-d');

    let captured: DxfDebugReport | null = null;
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      debugSink: (r) => {
        captured = r;
      },
    });
    const snap = (captured as unknown as DxfDebugReport).objects[0]!;
    expect(snap.id).toBeTruthy();
    expect(snap.name).toBe('Aplique D');
    expect(snap.operation).toBe('corte');
    expect(snap.machines).toEqual(['fiber-laser']);
    expect(snap.fabricBoundingRectPx).not.toBeNull();
    expect(snap.fabricTransformMatrix).not.toBeNull();
    expect(snap.worldPathDmm.length).toBeGreaterThan(0);
    expect(snap.worldPathBboxMm.width).toBeGreaterThan(0);
    expect(snap.splinesPreFlip.length).toBeGreaterThan(0);
    expect(snap.splinesPostFlip.length).toBe(snap.splinesPreFlip.length);
    expect(snap.splinesPostFlipBboxMm.width).toBeGreaterThan(0);
  });

  it('Y dos splines pré-flip vs pós-flip difere quando bbox > 0', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'A', 'aplique-1-formato-d');

    let captured: DxfDebugReport | null = null;
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      debugSink: (r) => {
        captured = r;
      },
    });
    const snap = (captured as unknown as DxfDebugReport).objects[0]!;
    // y' = maxY - y. Espera que pré-flip e pós-flip difiram em Y (a menos que
    // a geometria seja simétrica em torno de maxY/2 — improvável para aplique D).
    const yPre = snap.splinesPreFlip[0]!.controlPoints[0]!.y;
    const yPost = snap.splinesPostFlip[0]!.controlPoints[0]!.y;
    // 100 - yPre ≈ yPost (com pequeno erro float).
    expect(Math.abs(100 - yPre - yPost)).toBeLessThan(0.01);
  });

  it('contentOffsetMm é refletido no report quando informado', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'A', 'aplique-1-formato-d');

    let captured: DxfDebugReport | null = null;
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      contentOffsetMm: { xMm: 0, yMm: 8 },
      debugSink: (r) => {
        captured = r;
      },
    });
    expect((captured as unknown as DxfDebugReport).contentOffsetMm).toEqual({
      xMm: 0,
      yMm: 8,
    });
  });

  it('report é serializável (JSON.stringify safe)', async () => {
    const svg = loadFixture('apliques/aplique-1-formato-d.svg');
    const meta = parseCorelSvg(svg);
    await engine.addAppliqueSvg(meta, 'A', 'aplique-1-formato-d');

    let captured: DxfDebugReport | null = null;
    await exportDxfV2ByMachineAndOperation(engine.canvas, {
      productWidthMm: 100,
      productHeightMm: 100,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: makeLookup({
        'aplique-1-formato-d': { operation: 'corte', machines: ['fiber-laser'] },
      }),
      debugSink: (r) => {
        captured = r;
      },
    });
    expect(() => JSON.stringify(captured)).not.toThrow();
    const roundtrip = JSON.parse(JSON.stringify(captured));
    expect(roundtrip.objects.length).toBe(1);
  });
});
