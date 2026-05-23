/**
 * Onda 35 — Production Routing MVP — integração end-to-end.
 *
 * Cenário de produção:
 *  1. PadraoEditor cria layer com patternRole='APPLIQUE' + processType+machineTargets.
 *  2. PadraoEditor converte layer em TEXT_AREA / LOGO_AREA (Onda 33).
 *  3. NovoPedido aplica pattern (Onda 34: bridge → slots).
 *  4. Operador preenche texto via fillTextSlot.
 *  5. Export SVG via withSlotContentExportable → SVG por máquina contém
 *     texto vetorizado na cor correta da operação.
 *
 * Usa CanvasEngine real em jsdom + node-canvas, mesmo padrão de
 * pattern-meta.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { AssetLookupFn } from '@/core/export/asset-routing-types';
import { withSlotContentExportable } from '@/core/export/slot-content-promoter';
import { exportSvgByMachine } from '@/core/export/svg-exporter';

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

describe('Onda 35 — Production Routing MVP', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('APPLIQUE com patternRole completo SEM asset cadastrado → exporta na máquina+cor corretas', async () => {
    // Layer classificada pela Onda 33: corte na M1 (master-biro), preto.
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers,
      assetLookup: emptyLookup, // sem nenhum asset cadastrado
    });

    expect(Array.from(out.keys())).toEqual(['master-biro']);
    expect(out.get('master-biro')).toMatch(/stroke="#000000"|stroke:\s*#000000/i);
  });

  it('CONTOUR com processType=marcacao em M2+M3 → 2 SVGs, ambos em azul', async () => {
    const obj = engine.addRectangle(2, 2, 30, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'CONTOUR');
    engine.setProcessRouting(id, 'marcacao', ['M2', 'M3']);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers,
      assetLookup: emptyLookup,
    });

    expect(new Set(out.keys())).toEqual(new Set(['fiber-laser', 'due-laser']));
    expect(out.get('fiber-laser')).toMatch(/#0000FF/i);
    expect(out.get('due-laser')).toMatch(/#0000FF/i);
  });

  it('TEXT_AREA preenchida (via convertToArea + bridge + fillTextSlot) → SVG contém path do texto na cor de gravacao', async () => {
    // 1. PadraoEditor — cria retângulo, classifica como TEXT_AREA+processType+machineTargets, converte.
    const textRect = engine.addRectangle(8, 6, 30, 8);
    const textId = (textRect as unknown as { id: string }).id;
    engine.setProcessRouting(textId, 'gravacao', ['M2']);
    const okConvert = engine.convertToArea(textId, 'TEXT_AREA');
    expect(okConvert).toBe(true);

    // setPatternRole já foi setado por convertToArea. processType/machineTargets
    // ficam preservados pelo convertToArea (Onda 33.E).
    const layerMeta = engine.getLayerMeta(textId)!;
    expect(layerMeta.patternRole).toBe('TEXT_AREA');
    expect(layerMeta.processType).toBe('gravacao');
    expect(layerMeta.machineTargets).toEqual(['M2']);

    // 2. Salva e re-aplica (simula NovoPedido importando o pattern).
    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    const patternJson = engine.serialize(
      items as unknown as Parameters<typeof engine.serialize>[0]
    );

    // Engine novo pra simular pedido.
    const orderCanvasEl = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvasEl, baseConfig);
    try {
      await orderEngine.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });
      // 3. Operador preenche.
      orderEngine.fillTextSlot('nome', 'CAPI', 'Montserrat');

      // 4. Export — wrap com promoter para destravar excludeFromExport do content
      // E enriquecer layers com VisualLayerMeta sintética para o slot content.
      const baseLayers = Array.from(orderEngine.getAllLayerMetas().values());
      const out = await withSlotContentExportable(
        orderEngine.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) =>
          exportSvgByMachine(orderEngine.canvas, {
            productWidthMm: baseConfig.productWidthMm,
            productHeightMm: baseConfig.productHeightMm,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: diskFontLoader(),
          })
      );

      // Resultado: 1 SVG na M2 (fiber-laser), com path do texto em vermelho (gravacao).
      expect(Array.from(out.keys())).toEqual(['fiber-laser']);
      const svg = out.get('fiber-laser')!;
      // Path real do texto convertido por opentype.
      expect(svg).toMatch(/<path[^>]+d="M[^"]+"/);
      // Cor de gravação no fill do texto convertido.
      expect(svg).toMatch(/fill="#FF0000"/);
      // Placeholder XML NÃO deve estar presente — texto foi convertido.
      expect(svg).not.toContain('<!-- Texto pendente');
    } finally {
      orderEngine.dispose();
    }
  });

  it('promoter restaura excludeFromExport após o export (PNG/serialize continuam excluindo o content)', async () => {
    const textRect = engine.addRectangle(8, 6, 30, 8);
    const textId = (textRect as unknown as { id: string }).id;
    engine.setProcessRouting(textId, 'gravacao', ['M2']);
    engine.convertToArea(textId, 'TEXT_AREA');

    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    const patternJson = engine.serialize(
      items as unknown as Parameters<typeof engine.serialize>[0]
    );

    const orderCanvasEl = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvasEl, baseConfig);
    try {
      await orderEngine.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });
      orderEngine.fillTextSlot('nome', 'CAPI', 'Montserrat');

      // Antes do wrap: content tem excludeFromExport=true.
      const contentsBefore = orderEngine.getSlotContentFabricObjects();
      expect(contentsBefore.length).toBe(1);
      expect(contentsBefore[0].excludeFromExport).toBe(true);

      // Roda export inteiro.
      const baseLayers = Array.from(orderEngine.getAllLayerMetas().values());
      await withSlotContentExportable(
        orderEngine.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) =>
          exportSvgByMachine(orderEngine.canvas, {
            productWidthMm: baseConfig.productWidthMm,
            productHeightMm: baseConfig.productHeightMm,
            layers,
            assetLookup: emptyLookup,
            fontBufferLoader: diskFontLoader(),
          })
      );

      // Depois do wrap: voltou a excluir.
      const contentsAfter = orderEngine.getSlotContentFabricObjects();
      expect(contentsAfter[0].excludeFromExport).toBe(true);
    } finally {
      orderEngine.dispose();
    }
  });

  it('Onda 33 vence quando completa + asset presente (precedência decisão D)', async () => {
    // Layer com asset cadastrado E patternRole completo — espera-se que
    // o routing siga a patternRole, não o asset. `getAllLayerMetas` retorna
    // cópia rasa, então mutamos a entrada do snapshot que vai ao exporter
    // (a Map interna do engine não tem API pública para enriquecer
    // engravingId em rect avulso — uso de teste).
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']); // M1=master-biro, preto

    const lookup: AssetLookupFn = async (assetId) =>
      assetId === 'eng-legacy'
        ? { operation: 'gravacao', machines: ['fiber-laser'] } // vermelho na M2
        : null;

    const layers = Array.from(engine.getAllLayerMetas().values()).map((l) =>
      l.id === id ? { ...l, engravingId: 'eng-legacy' } : l
    );
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers,
      assetLookup: lookup,
    });

    // Esperado: M1 (Onda 33), não M2 (asset). Preto (corte), não vermelho.
    expect(Array.from(out.keys())).toEqual(['master-biro']);
    expect(out.get('master-biro')).toMatch(/stroke="#000000"|stroke:\s*#000000/i);
    expect(out.get('master-biro')).not.toMatch(/#FF0000/i);
  });

  it('layer sem patternRole completo cai no caminho legado (asset)', async () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    // patternRole presente mas processType ausente — incompleto.
    engine.setPatternRole(id, 'APPLIQUE');

    const lookup: AssetLookupFn = async (assetId) =>
      assetId === 'eng-legacy' ? { operation: 'marcacao', machines: ['due-laser'] } : null;

    const layers = Array.from(engine.getAllLayerMetas().values()).map((l) =>
      l.id === id ? { ...l, engravingId: 'eng-legacy' } : l
    );
    const out = await exportSvgByMachine(engine.canvas, {
      productWidthMm: baseConfig.productWidthMm,
      productHeightMm: baseConfig.productHeightMm,
      layers,
      assetLookup: lookup,
    });

    // Cai no asset → due-laser (M3), azul (marcacao).
    expect(Array.from(out.keys())).toEqual(['due-laser']);
    expect(out.get('due-laser')).toMatch(/#0000FF/i);
  });
});
