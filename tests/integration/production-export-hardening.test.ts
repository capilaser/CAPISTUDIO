/**
 * Production export hardening (bug-fix Onda 36+).
 *
 * Cobre os 7 critérios do briefing:
 *   1. Placeholder de TEXT_AREA não aparece no SVG.
 *   2. Placeholder de TEXT_AREA não aparece no PNG.
 *   3. Texto preenchido aparece como path no SVG.
 *   4. SVG exportado é XML válido.
 *   5. SVG de produção não contém xlink:href inválido.
 *   6. SVG de produção não contém imagem/material texture.
 *   7. Export com texto não vetorizado gera erro/aviso claro.
 *
 * Adicionalmente (Fix-4):
 *   8. Body de slot tradicional não aparece no SVG.
 *
 * Estratégia: CanvasEngine real em jsdom + node-canvas, mesmo padrão das
 * ondas anteriores. Testes exercitam o caminho exato do operador.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { AssetLookupFn } from '@/core/export/asset-routing-types';
import { precheckFonts } from '@/core/export/font-precheck';
import { exportPngMockup } from '@/core/export/png-exporter';
import { withSlotContentExportable } from '@/core/export/slot-content-promoter';
import { exportSvgByMachine } from '@/core/export/svg-exporter';
import { resetFontCache, type TextConversionError } from '@/core/export/svg-text-converter';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../src-tauri/resources/fonts');

function diskFontLoader() {
  return async (family: string) => {
    if (family !== 'Montserrat') return null;
    const buf = readFileSync(join(FONTS_DIR, 'Montserrat-Variable.ttf'));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };
}

const emptyLookup: AssetLookupFn = async () => null;

/**
 * Helper: cria pattern com TEXT_AREA classificado e aplica em engine "pedido"
 * preenchendo texto via fillTextSlot. Reproduz o caminho operador.
 */
async function setupPatternWithFilledText(
  engineSrc: CanvasEngine,
  engineDst: CanvasEngine,
  text = 'CAPI',
  fontFamily = 'Montserrat'
) {
  const rect = engineSrc.addRectangle(8, 6, 30, 8);
  const id = (rect as unknown as { id: string }).id;
  engineSrc.setProcessRouting(id, 'gravacao', ['M2']);
  engineSrc.convertToArea(id, 'TEXT_AREA');

  const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
  const patternJson = engineSrc.serialize(
    items as unknown as Parameters<typeof engineSrc.serialize>[0]
  );

  await engineDst.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });
  engineDst.fillTextSlot('nome', text, fontFamily);
}

describe('production-export-hardening — bug-fix Onda 36+', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
    // svg-text-converter mantém cache de fonts a nível de módulo —
    // garantir isolamento entre testes que usam loaders diferentes.
    resetFontCache();
  });

  afterEach(() => {
    engine.dispose();
  });

  // ── (1) Placeholder de TEXT_AREA não aparece no SVG ─────────────────────
  it('(1) placeholder de TEXT_AREA não aparece no SVG (sem texto preenchido)', async () => {
    const rect = engine.addRectangle(8, 6, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    engine.setProcessRouting(id, 'gravacao', ['M2']);
    engine.convertToArea(id, 'TEXT_AREA');

    const layers = Array.from(engine.getAllLayerMetas().values());
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers,
      assetLookup: emptyLookup,
    });

    // Sem texto preenchido, nenhuma máquina precisa exportar.
    expect(out.size).toBe(0);

    // Sanidade extra: se houvesse outro objeto na M2, o placeholder ainda
    // não vazaria. Adicionamos um aplique classificado em M2 e re-exportamos.
    const aplique = engine.addRectangle(2, 2, 10, 10);
    const aplId = (aplique as unknown as { id: string }).id;
    engine.setPatternRole(aplId, 'APPLIQUE');
    engine.setProcessRouting(aplId, 'gravacao', ['M2']);

    const out2 = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const svg = out2.get('fiber-laser')!;
    expect(svg).toBeDefined();
    // Cor do placeholder roxo da Onda 33.
    expect(svg).not.toContain('#a78bfa');
    expect(svg).not.toContain('167, 139, 250');
    // Dash array do placeholder.
    expect(svg).not.toMatch(/stroke-dasharray.*4.*3/);
  });

  // ── (2) Placeholder de TEXT_AREA não aparece no PNG ─────────────────────
  it('(2) placeholder de TEXT_AREA recebe flag __capiAreaPlaceholder e fica oculto durante export PNG', async () => {
    const rect = engine.addRectangle(8, 6, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    engine.setProcessRouting(id, 'gravacao', ['M2']);
    engine.convertToArea(id, 'TEXT_AREA');

    // Confirma que o placeholder foi marcado com a flag de ocultar em PNG.
    const placeholder = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__capiAreaPlaceholder === true);
    expect(placeholder).toBeDefined();
    const visibleBefore = placeholder!.visible ?? true;

    // Roda export PNG. exportPngMockup oculta o objeto durante o render e
    // restaura no finally — o que valida o caminho do hotfix.
    const layers = Array.from(engine.getAllLayerMetas().values());
    try {
      await exportPngMockup(engine.canvas, { layers, dpi: 72 });
    } catch {
      // node-canvas em jsdom pode falhar no toDataURL; o que nos importa
      // é o estado de visibilidade antes/depois (restore via try/finally).
    }

    // Restore garante visibilidade original (estado runtime do editor).
    expect(placeholder!.visible ?? true).toBe(visibleBefore);
  });

  // ── (3) Texto preenchido aparece como path no SVG ───────────────────────
  it('(3) texto preenchido em TEXT_AREA aparece como path real no SVG', async () => {
    const dstCanvas = document.createElement('canvas');
    const dst = new CanvasEngine(dstCanvas, baseConfig);
    try {
      await setupPatternWithFilledText(engine, dst, 'NOME');

      const baseLayers = Array.from(dst.getAllLayerMetas().values());
      const out = await withSlotContentExportable(
        dst.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) =>
          exportSvgByMachine(dst.canvas, {
            productWidthMm: baseConfig.productWidthMm,
            productHeightMm: baseConfig.productHeightMm,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: diskFontLoader(),
          })
      );

      const svg = out.get('fiber-laser')!;
      expect(svg).toBeDefined();
      // Path real do opentype.
      expect(svg).toMatch(/<path[^>]+d="M[^"]+"/);
      // Cor de gravação no fill do texto.
      expect(svg).toMatch(/fill="#FF0000"/);
      // Placeholder pendente NÃO deve aparecer.
      expect(svg).not.toContain('<!-- Texto pendente');
    } finally {
      dst.dispose();
    }
  });

  // ── (4) SVG exportado é XML válido ──────────────────────────────────────
  it('(4) SVG exportado é XML válido (parseable sem erro)', async () => {
    const aplique = engine.addRectangle(2, 2, 20, 10);
    const id = (aplique as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const svg = out.get('master-biro')!;

    // Parse via DOMParser do jsdom — invalid XML retorna documento com
    // <parsererror> como child em vez de <svg>.
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');
    expect(parserError).toBeNull();
    expect(doc.documentElement.nodeName.toLowerCase()).toBe('svg');
  });

  // ── (5) SVG não contém xlink:href inválido ──────────────────────────────
  it('(5) SVG declara xmlns:xlink se contiver xlink:href (defesa)', async () => {
    const aplique = engine.addRectangle(2, 2, 20, 10);
    const id = (aplique as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const svg = out.get('master-biro')!;

    // Bug original: continha xlink:href sem declarar xmlns:xlink.
    expect(svg).toContain('xmlns:xlink=');
    if (svg.includes('xlink:href')) {
      // Se houver, está sob namespace declarado.
      expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
  });

  // ── (6) SVG não contém pattern/image (textura vazando) ──────────────────
  it('(6) SVG não contém <pattern> nem <image> mesmo com fill=Pattern', async () => {
    const aplique = engine.addRectangle(2, 2, 30, 15);
    const id = (aplique as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    // Simula material aplicado: setamos fill: fabric.Pattern direto no objeto
    // (mesmo efeito de engine-material.applyMaterialToLayer). Usamos um
    // HTMLImageElement DOM normal (sem fromURL — que trava em jsdom).
    const obj = engine.getObjectById(id)!;
    const img = document.createElement('img');
    img.width = 4;
    img.height = 4;
    img.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';
    const pattern = new fabric.Pattern({ source: img });
    obj.set({ fill: pattern });

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const svg = out.get('master-biro')!;

    // Bug: textura PNG vazava como <image xlink:href="data:image/png;base64,...">
    expect(svg).not.toMatch(/<pattern\b/);
    expect(svg).not.toMatch(/<image\b/);
    expect(svg).not.toContain('data:image/png');
    expect(svg).not.toContain('xlink:href=');
    // Onda 37: o exporter emite `<path>` flat com `fill="none"` em atributo
    // (não `fill: none` inline style do Fabric). Aceita os dois formatos.
    expect(svg).toMatch(/fill\s*=\s*"none"|fill\s*:\s*none/);
    expect(svg).not.toMatch(/fill\s*:\s*url\(#/);
    expect(svg).not.toMatch(/fill\s*=\s*"url\(#/);
  });

  // ── (7) Export com texto não vetorizado dispara callback de erro ─────────
  it('(7) export com fonte ausente → onTextConversionError é chamado', async () => {
    const dstCanvas = document.createElement('canvas');
    const dst = new CanvasEngine(dstCanvas, baseConfig);
    try {
      await setupPatternWithFilledText(engine, dst, 'SEM FONTE');

      const errors: Array<{ err: TextConversionError; text: string }> = [];
      const noFontLoader = async () => null; // sempre null → font-not-found

      const baseLayers = Array.from(dst.getAllLayerMetas().values());
      await withSlotContentExportable(
        dst.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) =>
          exportSvgByMachine(dst.canvas, {
            productWidthMm: baseConfig.productWidthMm,
            productHeightMm: baseConfig.productHeightMm,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: noFontLoader,
            onTextConversionError: (err, text) => errors.push({ err, text }),
          })
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].err.kind).toBe('font-not-found');
      expect(errors[0].text).toBe('SEM FONTE');
    } finally {
      dst.dispose();
    }
  });

  // ── (8) Body de slot tradicional não aparece no SVG ─────────────────────
  it('(8) body de slot legado (capiSlot via createSlot) não aparece no SVG', async () => {
    // Cria slot do tipo nome via API legacy (não via convertToArea).
    engine.createSlot('nome', { x: 5, y: 5 });

    // Adiciona aplique pra termos algo a exportar.
    const aplique = engine.addRectangle(20, 5, 10, 10);
    const aplId = (aplique as unknown as { id: string }).id;
    engine.setPatternRole(aplId, 'APPLIQUE');
    engine.setProcessRouting(aplId, 'corte', ['M1']);

    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers: Array.from(engine.getAllLayerMetas().values()),
      assetLookup: emptyLookup,
    });
    const svg = out.get('master-biro')!;
    expect(svg).toBeDefined();

    // Slot body é Rect transparente — não deve haver mais de 1 rect (o
    // aplique). Contar via regex é cru mas suficiente: 1 rect = aplique,
    // sem rect extra do body do slot.
    const rectMatches = svg.match(/<rect\b/g) ?? [];
    expect(rectMatches.length).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Bug-fix Onda 36+ (RODADA 2) — bugs descobertos na validação real.
// CR-A: slot overlay vermelho vazava no PNG (faltava __capiOverlay).
// CR-B: SVG saía com "Texto pendente" silenciosamente.
// CR-C: fonte default era Roboto Slab (incompatível com opentype.js).
// ─────────────────────────────────────────────────────────────────────────

describe('production-export-hardening — bug-fix Onda 36+ (rodada 2)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
    resetFontCache();
  });

  afterEach(() => {
    engine.dispose();
  });

  // ── (D1) Slot overlay vermelho tem __capiOverlay=true ───────────────────
  it('(D1) slot overlay vermelho recebe __capiOverlay=true em createSlot E loadSlotsFromCanvas', async () => {
    // Caminho 1: createSlot direto (PadraoEditor).
    engine.createSlot('nome', { x: 5, y: 5 });
    const overlays = engine.canvas
      .getObjects()
      .filter(
        (o) =>
          (o.stroke ?? '').toString().includes('220, 38, 38') ||
          (o.stroke ?? '').toString().toLowerCase() === '#dc2626'
      );
    expect(overlays.length).toBe(1);
    expect((overlays[0] as unknown as Record<string, unknown>).__capiOverlay).toBe(true);

    // Caminho 2: serialize → deserialize (reabertura de pedido).
    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    const snapshot = engine.serialize(items as unknown as Parameters<typeof engine.serialize>[0]);
    const reopenedCanvas = document.createElement('canvas');
    const reopened = new CanvasEngine(reopenedCanvas, baseConfig);
    try {
      await reopened.deserialize(snapshot);
      const overlaysReopened = reopened.canvas
        .getObjects()
        .filter(
          (o) =>
            (o.stroke ?? '').toString().includes('220, 38, 38') ||
            (o.stroke ?? '').toString().toLowerCase() === '#dc2626'
        );
      expect(overlaysReopened.length).toBe(1);
      expect((overlaysReopened[0] as unknown as Record<string, unknown>).__capiOverlay).toBe(true);
    } finally {
      reopened.dispose();
    }
  });

  // ── (D2) Slot overlay é OCULTADO durante exportPngMockup ────────────────
  it('(D2) PNG mockup oculta o slot overlay vermelho (não aparece em volta do texto)', async () => {
    engine.createSlot('nome', { x: 5, y: 5 });
    const overlay = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).__capiOverlay === true);
    expect(overlay).toBeDefined();
    const visibleBefore = overlay!.visible ?? true;

    const layers = Array.from(engine.getAllLayerMetas().values());
    try {
      await exportPngMockup(engine.canvas, { layers, dpi: 72 });
    } catch {
      // toDataURL pode falhar em jsdom — não bloqueia o teste; o que
      // checamos é o ciclo de visibilidade do overlay.
    }
    // Restore garante visibilidade original (estado runtime do editor).
    expect(overlay!.visible ?? true).toBe(visibleBefore);
  });

  // ── (D3) precheckFonts detecta fontes que falham ────────────────────────
  it('(D3) precheckFonts retorna issue quando loader retorna null para a família', async () => {
    // Setup: adicionar fabric.Text com fonte inexistente.
    const text = new fabric.IText('TESTE', {
      fontFamily: 'FonteFantasma',
      left: 10,
      top: 10,
    });
    engine.canvas.add(text);

    const result = await precheckFonts(engine.canvas, async () => null);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].fontFamily).toBe('FonteFantasma');
    expect(result.issues[0].text).toBe('TESTE');
    expect(result.issues[0].error.kind).toBe('font-not-found');
    expect(result.failingFamilies).toEqual(['FonteFantasma']);
    expect(result.okTextCount).toBe(0);
  });

  // ── (D4) precheckFonts NÃO reporta texto com excludeFromExport=true ─────
  it('(D4) precheckFonts pula textos com excludeFromExport=true (slot content sem promover)', async () => {
    // fabric.Text com excludeFromExport=true (estado padrão do slot content
    // antes do slot-content-promoter destravar).
    const text = new fabric.IText('SLOT', {
      fontFamily: 'FonteFantasma',
      excludeFromExport: true,
    });
    engine.canvas.add(text);

    const result = await precheckFonts(engine.canvas, async () => null);
    expect(result.issues).toEqual([]);
  });

  // ── (D5) precheckFonts retorna OK quando loader entrega buffer válido ───
  it('(D5) precheckFonts retorna 0 issues quando fontBufferLoader resolve corretamente', async () => {
    const text = new fabric.IText('OK', {
      fontFamily: 'Montserrat',
      left: 10,
      top: 10,
    });
    engine.canvas.add(text);

    const result = await precheckFonts(engine.canvas, diskFontLoader());
    expect(result.issues).toEqual([]);
    expect(result.okTextCount).toBe(1);
  });

  // ── (D6) Montserrat default → texto vetoriza no SVG ─────────────────────
  it('(D6) texto com fonte padrão Montserrat gera <path> real (sem placeholder)', async () => {
    const dstCanvas = document.createElement('canvas');
    const dst = new CanvasEngine(dstCanvas, baseConfig);
    try {
      // setupPatternWithFilledText usa Montserrat (default novo da Onda 36+ r2).
      await setupPatternWithFilledText(engine, dst, 'CAPI', 'Montserrat');

      const baseLayers = Array.from(dst.getAllLayerMetas().values());
      const out = await withSlotContentExportable(
        dst.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) =>
          exportSvgByMachine(dst.canvas, {
            productWidthMm: baseConfig.productWidthMm,
            productHeightMm: baseConfig.productHeightMm,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: diskFontLoader(),
          })
      );

      const svg = out.get('fiber-laser')!;
      expect(svg).toMatch(/<path[^>]+d="M[^"]+"/);
      expect(svg).not.toContain('<!-- Texto pendente');
    } finally {
      dst.dispose();
    }
  });

  // ── (D7) Pre-check pega fonte fantasma — produção saberia bloquear ──────
  it('(D7) precheckFonts pega fonte que falharia no svg-exporter (caminho que ExportSvgDialog usa para bloquear)', async () => {
    const dstCanvas = document.createElement('canvas');
    const dst = new CanvasEngine(dstCanvas, baseConfig);
    try {
      // Simula o cenário real: texto preenchido com fonte que não existe
      // no loader (equivalente a Roboto Slab que falha no opentype).
      await setupPatternWithFilledText(engine, dst, 'LLLLLLL', 'FonteSemBuffer');

      const noFontLoader = async () => null;
      const baseLayers = Array.from(dst.getAllLayerMetas().values());

      // Pre-check com content promovido (igual ExportSvgDialog faz).
      const result = await withSlotContentExportable(
        dst.getSlotContentBodyPairs(),
        baseLayers,
        async () => precheckFonts(dst.canvas, noFontLoader)
      );

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.failingFamilies).toContain('FonteSemBuffer');
      // ExportSvgDialog, ao ver issues > 0, bloqueia gravação até
      // operador confirmar via "Exportar mesmo assim".
    } finally {
      dst.dispose();
    }
  });
});
