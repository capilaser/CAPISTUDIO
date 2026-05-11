/**
 * Testes do getter getSlotText (Onda 9.F — autorizado pelo Gabriell).
 *
 * Escopo mínimo: 3 cenários do briefing. NÃO adicionar outros testes —
 * o getter é pure read e os 3 cenários cobrem todas as branches.
 */
import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlotManager } from '@/core/canvas/slot-manager';

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>`;

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
};

describe('SlotManager.getSlotText (Onda 9.F)', () => {
  let canvasEl: HTMLCanvasElement;
  let canvas: fabric.Canvas;
  let manager: SlotManager;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    canvas = new fabric.Canvas(canvasEl, { width: 1600, height: 600 });
    manager = new SlotManager(canvas, baseConfig);
  });

  afterEach(() => {
    void canvas.dispose();
  });

  // ── 1. Slot de texto com conteúdo → retorna texto correto ────────────────
  it('slot de texto preenchido retorna o texto exato', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João Silva', 'Montserrat');

    expect(manager.getSlotText(meta.id)).toBe('João Silva');
  });

  // ── 2. Slot de logo → retorna null (não é texto) ─────────────────────────
  it('slot de logo retorna null (content é Group/SVG, não fabric.Text)', async () => {
    const meta = manager.createSlot('logo');
    await manager.addLogo(meta.id, MINIMAL_SVG);

    expect(manager.getSlotText(meta.id)).toBeNull();
  });

  // ── 3. Slot inexistente → retorna null ───────────────────────────────────
  it('slot id inexistente retorna null (sem throws)', () => {
    expect(manager.getSlotText('id-que-nao-existe-em-lugar-nenhum')).toBeNull();
  });
});
