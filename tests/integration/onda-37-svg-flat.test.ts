/**
 * Onda 37 — SVG técnico flat. 12 critérios obrigatórios do briefing.
 *
 *  1. SVG não contém transform global (`<g transform=`)
 *  2. SVG não contém `matrix(`
 *  3. SVG não contém `scale(`
 *  4. SVG não contém `translate(`
 *  5. SVG não contém `<rect`/`<circle`/`<ellipse` (shapes técnicos viraram path)
 *  6. SVG contém `<path d="..."/>` em mm finais
 *  7. Produto 60×25 gera coordenadas dentro de [0,60] × [0,25]
 *  8. Texto vetorizado sai como path em mm
 *  9. Logo/aplique real mantém geometria correta
 * 10. Multi-chapa sem regressão (paths flat por chapa)
 * 11. DXF não regrediu (suite preserva)
 * 12. PNG não regrediu (caminho não tocado)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { AssetLookupFn } from '@/core/export/asset-routing-types';
import { exportBoardSvgByChapa } from '@/core/export/board-exporter';
import { CHAPA_LABEL_HEIGHT_MM } from '@/core/export/chapa-export-info';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { exportSvgByMachine } from '@/core/export/svg-exporter';
import { resetFontCache } from '@/core/export/svg-text-converter';

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src-tauri/resources/fonts');
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

function diskFontLoader() {
  return async (family: string) => {
    if (family !== 'Montserrat') return null;
    const buf = readFileSync(join(FONTS_DIR, 'Montserrat-Variable.ttf'));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };
}

const emptyLookup: AssetLookupFn = async () => null;

/** Extrai todas as coordenadas do `d` (M/L/C/Q + pares x,y). */
function extractCoords(d: string): Array<{ x: number; y: number }> {
  const tokens = d.matchAll(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/g);
  const out: Array<{ x: number; y: number }> = [];
  for (const t of tokens) {
    out.push({ x: parseFloat(t[1]), y: parseFloat(t[2]) });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────

describe('Onda 37 — SVG técnico flat', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, {
      productWidthMm: 60,
      productHeightMm: 33,
      viewportWidthPx: 800,
      viewportHeightPx: 500,
    });
    resetFontCache();
  });

  afterEach(() => {
    engine.dispose();
  });

  function addAppliqueRect(xMm: number, yMm: number, wMm: number, hMm: number): string {
    const obj = engine.addRectangle(xMm, yMm, wMm, hMm);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);
    return id;
  }

  async function exportSingleChapa() {
    return exportSvgByMachine(engine.canvas, {
      productWidthMm: 60,
      productHeightMm: 25,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
      contentOffsetMm: { xMm: 0, yMm: CHAPA_LABEL_HEIGHT_MM },
    });
  }

  // ── (1) Sem transform global ─────────────────────────────────────────
  it('(1) SVG técnico NÃO contém `<g transform=`', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).not.toMatch(/<g\s+transform=/);
  });

  // ── (2) Sem matrix ────────────────────────────────────────────────────
  it('(2) SVG técnico NÃO contém `matrix(`', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).not.toMatch(/matrix\(/);
  });

  // ── (3) Sem scale ─────────────────────────────────────────────────────
  it('(3) SVG técnico NÃO contém `scale(`', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).not.toMatch(/scale\(/);
  });

  // ── (4) Sem translate ─────────────────────────────────────────────────
  it('(4) SVG técnico NÃO contém `translate(`', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).not.toMatch(/translate\(/);
  });

  // ── (5) Sem rect/circle/ellipse ──────────────────────────────────────
  it('(5) SVG NÃO contém `<rect`, `<circle`, `<ellipse` (shapes técnicos viraram path)', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).not.toMatch(/<rect\b/);
    expect(svg).not.toMatch(/<circle\b/);
    expect(svg).not.toMatch(/<ellipse\b/);
  });

  // ── (6) Contém path em mm finais ──────────────────────────────────────
  it('(6) SVG contém `<path d="..."/>` em mm finais', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).toMatch(/<path\s+d="[^"]+"/);
    // Conteúdo do d começa com comando de path absoluto.
    expect(svg).toMatch(/d="M\d+(?:\.\d+)?,\d+(?:\.\d+)?/);
  });

  // ── (7) Produto 60×25 — coords dentro do range ───────────────────────
  it('(7) Produto 60×25 gera coords técnicas em [0..60] × [0..25] sem desvio de stroke', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const svg = (await exportSingleChapa()).get('master-biro')!;
    expect(svg).toContain('viewBox="0 0 60 25"');
    const dMatch = svg.match(/d="([^"]+)"/);
    expect(dMatch).toBeTruthy();
    const coords = extractCoords(dMatch![1]);
    expect(coords.length).toBeGreaterThan(0);
    // Cantos exatos (sem o offset 0.125mm de stroke).
    const xs = coords.map((c) => c.x).sort((a, b) => a - b);
    const ys = coords.map((c) => c.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 4);
    expect(xs[xs.length - 1]).toBeCloseTo(60, 4);
    expect(ys[0]).toBeCloseTo(0, 4);
    expect(ys[ys.length - 1]).toBeCloseTo(25, 4);
  });

  // ── (8) Texto vetorizado em mm ───────────────────────────────────────
  it('(8) Texto vetorizado (TEXT_AREA aplicada em pedido) sai como `<path>` em mm finais', async () => {
    // Caminho real do operador:
    //   1. PadraoEditor: cria TEXT_AREA com processType+machineTargets.
    //   2. Salva pattern, aplica em pedido (bridge injeta capiSlot).
    //   3. fillTextSlot preenche conteúdo (criado como fabric.Text com
    //      excludeFromExport=true — slot-content-promoter destrava no export).
    //
    // PadraoEditor (engine A): cria pattern com TEXT_AREA.
    const editorRect = engine.addRectangle(8, 6, 30, 8);
    const editorId = (editorRect as unknown as { id: string }).id;
    engine.setProcessRouting(editorId, 'gravacao', ['M2']);
    engine.convertToArea(editorId, 'TEXT_AREA');
    const patternJson = engine.serialize([
      { productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 },
    ] as unknown as Parameters<typeof engine.serialize>[0]);

    // Pedido (engine B): aplica pattern e preenche texto.
    const orderCanvas = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvas, {
      productWidthMm: 60,
      productHeightMm: 33,
      viewportWidthPx: 800,
      viewportHeightPx: 500,
    });
    try {
      await orderEngine.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });
      orderEngine.fillTextSlot('nome', 'CAPI', 'Montserrat');

      const { withSlotContentExportable } = await import('@/core/export/slot-content-promoter');
      const out = await withSlotContentExportable(
        orderEngine.getSlotContentBodyPairs(),
        Array.from(orderEngine.getAllLayerMetas().values()),
        async ({ layers }) =>
          exportSvgByMachine(orderEngine.canvas, {
            productWidthMm: 60,
            productHeightMm: 25,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: diskFontLoader(),
            contentOffsetMm: { xMm: 0, yMm: 0 }, // pedido não tem label de chapa
          })
      );

      const svg = out.get('fiber-laser')!;
      expect(svg).toBeDefined();
      // Path com vários comandos M/L/C/Q (texto vetorizado).
      expect(svg).toMatch(/<path\s+d="M/);
      expect(svg).not.toMatch(/<g\s+transform=/);
      expect(svg).not.toMatch(/matrix\(/);
      // Coords do texto dentro do viewBox 60×25.
      const paths = Array.from(svg.matchAll(/d="([^"]+)"/g));
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        const coords = extractCoords(p[1]);
        for (const c of coords) {
          expect(c.x).toBeGreaterThanOrEqual(-0.5);
          expect(c.x).toBeLessThanOrEqual(60.5);
          expect(c.y).toBeGreaterThanOrEqual(-0.5);
          expect(c.y).toBeLessThanOrEqual(25.5);
        }
      }
    } finally {
      orderEngine.dispose();
    }
  });

  // ── (9) Logo/aplique real mantém geometria ───────────────────────────
  it('(9) Aplique real (fixture aplique-1-formato-d) mantém geometria após transform', async () => {
    const svg0 = readFileSync(join(FIXTURES, 'apliques/aplique-1-formato-d.svg'), 'utf-8');
    const meta = parseCorelSvg(svg0);
    await engine.addAppliqueSvg(meta, 'Ap', 'aplique-1');
    // Apliques add via addAppliqueSvg viram principais. Classifique:
    const layers = Array.from(engine.getAllLayerMetas().values());
    const principal = layers.find((l) => l.kind === 'principal');
    expect(principal).toBeDefined();
    engine.setPatternRole(principal!.id, 'APPLIQUE');
    engine.setProcessRouting(principal!.id, 'corte', ['M1']);

    // Engine foi criado com 60×33, mas o aplique tem dims próprias (300×90 normalmente).
    // Exportar com dims grandes pra acomodar.
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: 300,
      productHeightMm: 90,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const out0 = out.get('master-biro');
    expect(out0).toBeDefined();
    // Path real do aplique com muitos comandos C (curva).
    expect(out0!).toMatch(/<path\s+d="M[^"]*C[^"]*"/);
    // Sem wrappers.
    expect(out0!).not.toMatch(/<g\s+transform=/);
    expect(out0!).not.toMatch(/matrix\(/);
    expect(out0!).not.toMatch(/scale\(/);
    // Geometria preservada: count de C >= 1 (aplique tem curvas).
    const dMatch = out0!.match(/d="([^"]+)"/);
    expect(dMatch).toBeTruthy();
    const cCount = (dMatch![1].match(/C/g) ?? []).length;
    expect(cCount).toBeGreaterThan(0);
  });

  // ── (10) Multi-chapa: paths flat por chapa ───────────────────────────
  it('(10) Multi-chapa: cada chapa retorna SVG flat (sem regressão)', async () => {
    // Adiciona 2 retângulos como se fossem 2 broches de chapas diferentes,
    // separados por offset.
    const r1 = engine.addRectangle(0, 8, 60, 25);
    const r2 = engine.addRectangle(100, 8, 60, 25);
    const id1 = (r1 as unknown as { id: string }).id;
    const id2 = (r2 as unknown as { id: string }).id;
    engine.setPatternRole(id1, 'APPLIQUE');
    engine.setProcessRouting(id1, 'corte', ['M1']);
    engine.setPatternRole(id2, 'APPLIQUE');
    engine.setProcessRouting(id2, 'corte', ['M1']);

    const results = await exportBoardSvgByChapa({
      canvas: engine.canvas,
      layers: Array.from(engine.getAllLayerMetas().values()),
      boardWidthMm: 160,
      boardHeightMm: 33,
      chapas: [
        {
          chapaId: 'p1',
          filenameToken: 'p1',
          bboxMm: { leftMm: 0, topMm: 8, widthMm: 60, heightMm: 25 },
        },
        {
          chapaId: 'p2',
          filenameToken: 'p2',
          bboxMm: { leftMm: 100, topMm: 8, widthMm: 60, heightMm: 25 },
        },
      ],
      assetLookup: emptyLookup,
    });

    expect(results.length).toBe(2);
    for (const r of results) {
      // Cada SVG é flat.
      expect(r.svg).not.toMatch(/<g\s+transform=/);
      expect(r.svg).not.toMatch(/matrix\(/);
      expect(r.svg).not.toMatch(/scale\(/);
      expect(r.svg).not.toMatch(/translate\(/);
      // viewBox 60×25 (chapa).
      expect(r.svg).toContain('viewBox="0 0 60 25"');
      // Cada chapa tem 1 path.
      expect(r.svg).toMatch(/<path\s+d="/);
    }
  });

  // ── (11) DXF não regrediu ────────────────────────────────────────────
  it('(11) DXF continua funcionando (caminho não tocado por Onda 37 SVG flat)', async () => {
    addAppliqueRect(0, 8, 60, 25);
    const { exportDxfByMachineAndOperation } = await import('@/core/export/dxf-exporter');
    const out = await exportDxfByMachineAndOperation(engine.canvas, {
      productWidthMm: 60,
      productHeightMm: 25,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
      clipBoundsMm: { leftMm: 0, topMm: 8, widthMm: 60, heightMm: 25 },
    });
    const dxf = out.get('master-biro|corte');
    expect(dxf).toBeDefined();
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('ENTITIES');
  });

  // ── (12) PNG não regrediu ────────────────────────────────────────────
  it('(12) PNG mockup continua importável (caminho não foi tocado)', async () => {
    const mod = await import('@/core/export/png-exporter');
    expect(typeof mod.exportPngMockup).toBe('function');
    expect(typeof mod.computeMockupViewport).toBe('function');
  });
});
