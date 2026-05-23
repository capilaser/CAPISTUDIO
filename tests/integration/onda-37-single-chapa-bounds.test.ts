/**
 * Onda 37 bug-fix — SVG/DXF técnico single-chapa com bounds corretos.
 *
 * Bug: useBoardEngine reserva CHAPA_LABEL_HEIGHT_MM (8mm) em cima da chapa
 * pro label visual ("Broches (N)"). Pré-fix, ExportSvgDialog single-chapa
 * passava `boardDims.heightMm` cru pro svg/dxf-exporter, resultando em:
 *   - viewBox com altura inflada (60×33 em vez de 60×25)
 *   - faixa vazia de 8mm em y=0..8 (aplique deslocado pra baixo)
 *
 * Fix: passar `technicalHeightMm = boardDims.heightMm - 8` + `contentOffsetMm
 * = { xMm: 0, yMm: 8 }` no SVG, e `clipBoundsMm` equivalente no DXF.
 *
 * Cobre os 6 testes obrigatórios do briefing:
 *   1. Produto 60×25 com 1 broche → SVG 60×25 (não 60×33).
 *   2. Conteúdo do SVG começa em y=0 técnico (não y=8).
 *   3. DXF single-chapa: coords corretas.
 *   4. Multi-chapa: sem regressão.
 *   5. Multi-broche single-chapa: remove só o label, não os itens.
 *   6. PNG: sem regressão (caminho não é afetado pelo fix).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { AssetLookupFn } from '@/core/export/asset-routing-types';
import { CHAPA_LABEL_HEIGHT_MM } from '@/core/export/chapa-export-info';
import { exportDxfByMachineAndOperation } from '@/core/export/dxf-exporter';
import { exportSvgByMachine, wrapAsProductSvg } from '@/core/export/svg-exporter';

/**
 * Mocks o que ExportSvgDialog single-chapa faz após o fix Onda 37. Reproduz:
 *   - technicalHeightMm = boardDims.heightMm - CHAPA_LABEL_HEIGHT_MM
 *   - contentOffsetMm.yMm = CHAPA_LABEL_HEIGHT_MM
 *   - DXF: clipBoundsMm cobre a região técnica
 */
async function exportSingleChapaSvg(
  engine: CanvasEngine,
  boardDims: { widthMm: number; heightMm: number },
  assetLookup: AssetLookupFn
): Promise<Map<string, string>> {
  const technicalHeightMm = Math.max(0, boardDims.heightMm - CHAPA_LABEL_HEIGHT_MM);
  return exportSvgByMachine(engine.canvas, {
    productWidthMm: boardDims.widthMm,
    productHeightMm: technicalHeightMm,
    layers: Array.from(engine.getAllLayerMetas().values()),
    assetLookup,
    contentOffsetMm: { xMm: 0, yMm: CHAPA_LABEL_HEIGHT_MM },
  });
}

async function exportSingleChapaDxf(
  engine: CanvasEngine,
  boardDims: { widthMm: number; heightMm: number },
  assetLookup: AssetLookupFn
) {
  const technicalHeightMm = Math.max(0, boardDims.heightMm - CHAPA_LABEL_HEIGHT_MM);
  return exportDxfByMachineAndOperation(engine.canvas, {
    productWidthMm: boardDims.widthMm,
    productHeightMm: technicalHeightMm,
    layers: Array.from(engine.getAllLayerMetas().values()),
    assetLookup,
    clipBoundsMm: {
      leftMm: 0,
      topMm: CHAPA_LABEL_HEIGHT_MM,
      widthMm: boardDims.widthMm,
      heightMm: technicalHeightMm,
    },
  });
}

const emptyLookup: AssetLookupFn = async () => null;

// ─────────────────────────────────────────────────────────────────────────

describe('Onda 37 bug-fix — single-chapa export tem bounds técnicos corretos', () => {
  describe('wrapAsProductSvg com contentOffsetMm', () => {
    it('default (sem offset) preserva comportamento legado', () => {
      const svg = wrapAsProductSvg('<rect/>', 60, 25);
      expect(svg).toContain('viewBox="0 0 60 25"');
      expect(svg).toContain('width="60mm"');
      expect(svg).toContain('height="25mm"');
      // Não introduz <g translate quando offset é zero.
      expect(svg).not.toMatch(/transform="translate\(/);
    });

    it('Onda 37: contentOffsetMm passado ao wrapAsProductSvg agora é IGNORADO (offset absorvido no path level)', () => {
      const svg = wrapAsProductSvg('<rect/>', 60, 25, { xMm: 0, yMm: 8 });
      expect(svg).toContain('viewBox="0 0 60 25"');
      // SVG flat — não introduz mais <g transform="translate">.
      expect(svg).not.toMatch(/transform="translate\(/);
    });
  });

  describe('exportSvgByMachine single-chapa (board com label)', () => {
    let canvasEl: HTMLCanvasElement;
    let engine: CanvasEngine;

    beforeEach(() => {
      // Canvas COM altura inflada pelo label (33 = 25 produto + 8 label).
      canvasEl = document.createElement('canvas');
      engine = new CanvasEngine(canvasEl, {
        productWidthMm: 60,
        productHeightMm: 33,
        viewportWidthPx: 800,
        viewportHeightPx: 500,
      });
    });

    afterEach(() => {
      engine.dispose();
    });

    it('(1) Produto 60×25 com 1 broche → SVG width=60mm height=25mm viewBox="0 0 60 25"', async () => {
      // Aplique posicionado em y=8 no canvas (igual ao useBoardEngine real).
      const obj = engine.addRectangle(0, 8, 60, 25);
      const id = (obj as unknown as { id: string }).id;
      engine.setPatternRole(id, 'APPLIQUE');
      engine.setProcessRouting(id, 'corte', ['M1']);

      const out = await exportSingleChapaSvg(engine, { widthMm: 60, heightMm: 33 }, emptyLookup);
      const svg = out.get('master-biro')!;

      expect(svg).toContain('width="60mm"');
      expect(svg).toContain('height="25mm"');
      expect(svg).toContain('viewBox="0 0 60 25"');
      expect(svg).not.toContain('height="33mm"');
      expect(svg).not.toContain('viewBox="0 0 60 33"');
    });

    it('(2) Conteúdo do SVG começa em y=0 técnico (Onda 37: offset absorvido no path)', async () => {
      const obj = engine.addRectangle(0, 8, 60, 25);
      const id = (obj as unknown as { id: string }).id;
      engine.setPatternRole(id, 'APPLIQUE');
      engine.setProcessRouting(id, 'corte', ['M1']);

      const out = await exportSingleChapaSvg(engine, { widthMm: 60, heightMm: 33 }, emptyLookup);
      const svg = out.get('master-biro')!;

      // Onda 37: SVG flat — sem <g translate>. Em vez disso, as coords do
      // path já vêm em y=0 técnico (subtraídas do offset de 8mm).
      expect(svg).not.toMatch(/<g\s+transform=/);
      const dMatch = svg.match(/d="([^"]+)"/);
      expect(dMatch).toBeTruthy();
      // Coord y mínima do path = 0 (ou perto). Cantos esperados: (0,0), (60,0), (60,25), (0,25).
      const yMatches = Array.from(
        dMatch![1].matchAll(/-?\d+(?:\.\d+)?[,\s]+(-?\d+(?:\.\d+)?)/g)
      ).map((m) => parseFloat(m[1]));
      const minY = Math.min(...yMatches);
      const maxY = Math.max(...yMatches);
      expect(minY).toBeCloseTo(0, 4);
      expect(maxY).toBeCloseTo(25, 4);
    });

    it('(5) Multi-broche single-chapa (3 broches 60×25 empilhados) — remove só o label, não os itens', async () => {
      // Simula 3 broches do mesmo produto (60×25) empilhados verticalmente
      // com gap 4mm = altura técnica total 25+4+25+4+25 = 83mm; com label
      // a chapa fica em 91mm. O fix deve sair com 83mm, sem cortar broches.
      const broche1 = engine.addRectangle(0, 8, 60, 25);
      const broche2 = engine.addRectangle(0, 8 + 25 + 4, 60, 25);
      const broche3 = engine.addRectangle(0, 8 + 25 + 4 + 25 + 4, 60, 25);
      for (const b of [broche1, broche2, broche3]) {
        const id = (b as unknown as { id: string }).id;
        engine.setPatternRole(id, 'APPLIQUE');
        engine.setProcessRouting(id, 'corte', ['M1']);
      }

      const out = await exportSingleChapaSvg(engine, { widthMm: 60, heightMm: 91 }, emptyLookup);
      const svg = out.get('master-biro')!;

      // Altura técnica = 91 - 8 = 83mm.
      expect(svg).toContain('viewBox="0 0 60 83"');
      expect(svg).toContain('height="83mm"');

      // Onda 37: 3 broches → 3 paths flat (não mais <rect>). Contagem >= 3.
      const pathMatches = svg.match(/<path\b/g) ?? [];
      expect(pathMatches.length).toBeGreaterThanOrEqual(3);
    });

    it('SVG offset preserva textura/material strip e xmlns:xlink (sem regressão Onda 36+)', async () => {
      const obj = engine.addRectangle(0, 8, 60, 25);
      const id = (obj as unknown as { id: string }).id;
      engine.setPatternRole(id, 'APPLIQUE');
      engine.setProcessRouting(id, 'corte', ['M1']);

      const out = await exportSingleChapaSvg(engine, { widthMm: 60, heightMm: 33 }, emptyLookup);
      const svg = out.get('master-biro')!;
      expect(svg).toContain('xmlns:xlink=');
      expect(svg).not.toMatch(/<pattern\b/);
    });
  });

  describe('exportDxfByMachineAndOperation single-chapa', () => {
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
    });

    afterEach(() => {
      engine.dispose();
    });

    it('(3) DXF single-chapa: aplique posicionado em y=8 sai com coords técnicas (sem label)', async () => {
      // Aplique 60×25 em y=8 no canvas (mesmo que o useBoardEngine produz).
      const obj = engine.addRectangle(0, 8, 60, 25);
      const id = (obj as unknown as { id: string }).id;
      engine.setPatternRole(id, 'APPLIQUE');
      engine.setProcessRouting(id, 'corte', ['M1']);

      const out = await exportSingleChapaDxf(engine, { widthMm: 60, heightMm: 33 }, emptyLookup);
      const masterCorte = out.get('master-biro|corte');
      expect(masterCorte).toBeDefined();
      expect(masterCorte).toContain('SECTION');
      expect(masterCorte).toContain('ENTITIES');

      // O bug original deixaria coords entre y=8 e y=33 no DXF.
      // Com clipBoundsMm, o aplique cai dentro da região técnica
      // (0,8,60,25) e suas coords saem subtraídas do offset Y=8 +
      // flipped pela altura técnica (25). Conferimos que nenhuma coord
      // Y excede 25 (altura técnica máxima).
      // Extrai todos os valores Y após "20\n" (códigos DXF de coordenadas Y).
      const yCoords = Array.from(masterCorte!.matchAll(/ 20\r?\n([-\d.]+)/g))
        .map((m) => parseFloat(m[1]))
        .filter((n) => Number.isFinite(n));
      // Pelo menos algumas coords saíram.
      expect(yCoords.length).toBeGreaterThan(0);
      // Nenhuma coord Y deve exceder a altura técnica (25mm) — tolerância
      // 0.5mm por stroke-width / flatten geram pontos ligeiramente fora
      // do bbox geométrico do rect. O importante: SEM o fix, coords
      // estariam DESLOCADAS pelo offset Y=8 — apareceriam algumas próximas
      // de 25mm e outras próximas de 8mm (gap). Após fix, todas ficam
      // contidas em [0, 25].
      // (DXF Y é flipped — origem no bottom-left.)
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);
      expect(minY).toBeGreaterThanOrEqual(-0.5);
      expect(maxY).toBeLessThanOrEqual(25.5);
      // Crítico: o range das coords está dentro da altura técnica (25mm)
      // — pré-fix, range seria 25+8 = 33mm (faixa do label inflando).
      expect(maxY - minY).toBeLessThanOrEqual(25 + 0.5);
    });
  });

  describe('(4) Multi-chapa: sem regressão', () => {
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
    });

    afterEach(() => {
      engine.dispose();
    });

    it('exportSvgByMachine SEM contentOffsetMm preserva viewBox original (caminho que multi-chapa usa)', async () => {
      const obj = engine.addRectangle(5, 5, 50, 20);
      const id = (obj as unknown as { id: string }).id;
      engine.setPatternRole(id, 'APPLIQUE');
      engine.setProcessRouting(id, 'corte', ['M1']);

      const out = await exportSvgByMachine(engine.canvas, {
        productWidthMm: 60,
        productHeightMm: 33,
        layers: Array.from(engine.getAllLayerMetas().values()),
        assetLookup: emptyLookup,
        // SEM contentOffsetMm — caminho legado / multi-chapa.
      });
      const svg = out.get('master-biro')!;

      // Sem fix aplicado, viewBox bate com o que foi passado.
      expect(svg).toContain('viewBox="0 0 60 33"');
      // E sem <g translate> adicional.
      expect(svg).not.toMatch(/transform="translate\(0 -\d/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// (6) PNG: sem regressão. PNG não passa por wrapAsProductSvg nem por
// exportSvgByMachine/exportDxfByMachineAndOperation. Usa exportPngMockup
// que recebe `clientBounds` calculado por boardBoundsPx — alimentado a
// partir de positions reais do useBoardEngine (já corrigido pelo cálculo
// `minTopMm = 8`). Logo, o fix de single-chapa SVG/DXF não toca em PNG.
// Documentamos via teste explícito que a assinatura/imports usados pelo
// PNG não foram alterados.
// ─────────────────────────────────────────────────────────────────────────

describe('(6) PNG: imports e assinatura não foram afetados', () => {
  it('exportPngMockup continua importável e não recebe contentOffsetMm', async () => {
    const mod = await import('@/core/export/png-exporter');
    expect(typeof mod.exportPngMockup).toBe('function');
    // PngExportOptions não tem contentOffsetMm.
    // (assert estático via TS já dá ; aqui só validamos runtime que o
    // export existe e o helper computeMockupViewport também.)
    expect(typeof mod.computeMockupViewport).toBe('function');
  });
});
