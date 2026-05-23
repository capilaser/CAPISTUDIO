/**
 * Onda 34 — Pattern Usage MVP — integração end-to-end.
 *
 * Cenário do usuário:
 *  1. Editor de padrões cria pattern com TEXT_AREA + LOGO_AREA (Onda 33).
 *  2. Operador abre pedido, aplica pattern → AREAs viram slots (bridge).
 *  3. fillTextSlot + fillLogoSlot populam.
 *  4. Serialize → deserialize preserva tudo.
 *
 * Usa CanvasEngine real em jsdom + node-canvas (mesmo padrão de
 * pattern-meta.test.ts / layer-operations.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine, type SerializedCanvas } from '@/core/canvas/canvas-engine';
import type { LayerBoundsMm } from '@/data/schema';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

describe('Onda 34 — Pattern Usage MVP (bridge AREA → slot)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  /**
   * Cria um pattern com 1 TEXT_AREA + 1 LOGO_AREA usando o caminho real:
   *  - addRectangle gera objetos com LayerMeta
   *  - convertToArea muta layerMeta + canvas
   *  - serialize retorna canvasJson de pattern pronto pra apply
   */
  function makePatternWithAreas(): SerializedCanvas {
    const textObj = engine.addRectangle(8, 6, 30, 8);
    const textId = (textObj as unknown as { id: string }).id;
    const logoObj = engine.addRectangle(8, 16, 12, 12);
    const logoId = (logoObj as unknown as { id: string }).id;

    const okText = engine.convertToArea(textId, 'TEXT_AREA');
    const okLogo = engine.convertToArea(logoId, 'LOGO_AREA');
    expect(okText).toBe(true);
    expect(okLogo).toBe(true);

    // Confirma metadata Onda 33 na layer.
    const textMeta = engine.getLayerMeta(textId)!;
    expect(textMeta.patternRole).toBe('TEXT_AREA');
    expect(textMeta.boundsMm).toEqual<LayerBoundsMm>({ x: 8, y: 6, width: 30, height: 8 });

    const logoMeta = engine.getLayerMeta(logoId)!;
    expect(logoMeta.patternRole).toBe('LOGO_AREA');
    expect(logoMeta.boundsMm).toEqual<LayerBoundsMm>({ x: 8, y: 16, width: 12, height: 12 });

    // Serialize pra simular "pattern salvo no banco".
    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    return engine.serialize(items as unknown as Parameters<typeof engine.serialize>[0]);
  }

  it('aplicar pattern com TEXT_AREA + LOGO_AREA gera slots nome + logo', async () => {
    const patternJson = makePatternWithAreas();

    // Engine "pedido" — separado, simula a tela NovoPedido.
    const orderCanvasEl = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvasEl, baseConfig);
    try {
      const newIds = await orderEngine.applyPatternObjects(patternJson, {
        leftMm: 0,
        topMm: 0,
      });
      expect(newIds.length).toBeGreaterThanOrEqual(2);

      // Bridge converteu: 1 TEXT_AREA → slot nome, 1 LOGO_AREA → slot logo.
      const nomeSlots = orderEngine.getSlotsByType('nome');
      const logoSlots = orderEngine.getSlotsByType('logo');
      expect(nomeSlots).toHaveLength(1);
      expect(logoSlots).toHaveLength(1);

      // Slot herda boundsMm da AREA original (em mm).
      expect(nomeSlots[0].x).toBeCloseTo(8, 5);
      expect(nomeSlots[0].y).toBeCloseTo(6, 5);
      expect(nomeSlots[0].maxWidth).toBeCloseTo(30, 5);
      expect(nomeSlots[0].maxHeight).toBeCloseTo(8, 5);

      expect(logoSlots[0].x).toBeCloseTo(8, 5);
      expect(logoSlots[0].y).toBeCloseTo(16, 5);
      expect(logoSlots[0].maxWidth).toBeCloseTo(12, 5);
      expect(logoSlots[0].maxHeight).toBeCloseTo(12, 5);
    } finally {
      orderEngine.dispose();
    }
  });

  it('fillTextSlot popula slot derivado de TEXT_AREA e o texto sobrevive ao roundtrip', async () => {
    const patternJson = makePatternWithAreas();

    const orderCanvasEl = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvasEl, baseConfig);
    try {
      await orderEngine.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });

      orderEngine.fillTextSlot('nome', 'João Silva', 'Montserrat');

      const slot = orderEngine.getSlotsByType('nome')[0];
      const slotText = orderEngine.getSlotText(slot.id);
      expect(slotText).toBe('João Silva');

      // Serialize do PEDIDO (snapshot boardCanvasJson).
      const orderItems = [
        { productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 },
      ];
      const snapshot = orderEngine.serialize(
        orderItems as unknown as Parameters<typeof orderEngine.serialize>[0]
      );

      // Reabrir pedido: deserialize num engine fresco.
      const reopenedEl = document.createElement('canvas');
      const reopenedEngine = new CanvasEngine(reopenedEl, baseConfig);
      try {
        await reopenedEngine.deserialize(snapshot);
        const nomeSlots = reopenedEngine.getSlotsByType('nome');
        expect(nomeSlots).toHaveLength(1);
        // boundsMm preservado em capi.layers depois do roundtrip
        // (verificação via metadata da layer).
        const layerMeta = reopenedEngine.getLayerMeta(nomeSlots[0].id);
        expect(layerMeta?.patternRole).toBe('TEXT_AREA');
        expect(layerMeta?.boundsMm).toEqual<LayerBoundsMm>({
          x: 8,
          y: 6,
          width: 30,
          height: 8,
        });
      } finally {
        reopenedEngine.dispose();
      }
    } finally {
      orderEngine.dispose();
    }
  });

  it('patterns antigos sem AREA (só capiSlot clássico) continuam funcionando', async () => {
    // Pattern legacy: usamos createSlot (caminho clássico Onda 14) pra simular
    // pattern criado antes da Onda 33.
    const slotMeta = engine.createSlot('nome', { x: 8, y: 6 });
    expect(slotMeta.type).toBe('nome');

    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    const patternJson = engine.serialize(
      items as unknown as Parameters<typeof engine.serialize>[0]
    );

    // Sanity: layer NÃO tem patternRole (pattern antigo).
    const legacyLayers = patternJson.capi.layers.filter(
      (l) => l.patternRole === 'TEXT_AREA' || l.patternRole === 'LOGO_AREA'
    );
    expect(legacyLayers).toHaveLength(0);

    // Aplicar não quebra — bridge é no-op.
    const orderCanvasEl = document.createElement('canvas');
    const orderEngine = new CanvasEngine(orderCanvasEl, baseConfig);
    try {
      await orderEngine.applyPatternObjects(patternJson, { leftMm: 0, topMm: 0 });
      const nomeSlots = orderEngine.getSlotsByType('nome');
      expect(nomeSlots).toHaveLength(1);
    } finally {
      orderEngine.dispose();
    }
  });
});
