/**
 * Testes da sincronização body → overlay + content (Onda 7.5).
 *
 * Cobre os 2 bugs de severidade alta do DEBT.md:
 *   - #3: overlay tracejado não seguia body em resize (cache do Fabric 6)
 *   - #4: content (texto/logo) não seguia body em drag/scale/modified
 *
 * Estratégia (lição da Onda 6b): NÃO testar só funções puras — exercitar
 * a cadeia de eventos real do Fabric (`canvas.fire('object:moving' | ...)`)
 * pra garantir que os listeners realmente fazem o que prometem em runtime.
 *
 * `canvas.fire` aqui simula o que o Fabric dispara durante drag/resize.
 * O teste muda `body.left/top/scaleX/scaleY` ANTES de disparar — mesmo
 * fluxo do Fabric real (modifica primeiro, dispara depois).
 */
import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SlotManager } from '@/core/canvas/slot-manager';
import { mmToPx } from '@/core/canvas/units';

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>`;

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
};

describe('SlotManager — sincronização body → overlay + content (Onda 7.5)', () => {
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

  // Helper: pega o overlay associado a um slot (o Rect com excludeFromExport
  // que NÃO carrega capiSlot, na ordem em que foi adicionado).
  function findOverlayFor(bodyId: string): fabric.Rect | undefined {
    const objects = canvas.getObjects();
    // Body do slot indicado.
    const body = objects.find((o) => {
      const rec = o as unknown as Record<string, unknown>;
      const capi = rec.capiSlot as { id?: string } | undefined;
      return capi?.id === bodyId;
    });
    if (!body) return undefined;
    // Overlay foi adicionado logo depois do body em createSlot.
    const bodyIdx = objects.indexOf(body);
    const candidate = objects[bodyIdx + 1];
    if (!candidate) return undefined;
    const rec = candidate as unknown as Record<string, unknown>;
    if (rec.excludeFromExport !== true) return undefined;
    if (rec.capiSlot !== undefined) return undefined;
    return candidate as fabric.Rect;
  }

  // ── 1. Mover body → overlay tem nova posição (Fix #3 indireto) ─────────────
  it('object:moving — overlay segue body em drag', () => {
    const meta = manager.createSlot('nome');
    const body = manager.getFabricObject(meta.id)!;
    const overlay = findOverlayFor(meta.id)!;

    const newLeftPx = mmToPx(50);
    const newTopPx = mmToPx(20);
    body.set({ left: newLeftPx, top: newTopPx });
    canvas.fire('object:moving', { target: body });

    expect(overlay.left).toBe(newLeftPx);
    expect(overlay.top).toBe(newTopPx);
  });

  // ── 2. Mover body → content (texto) tem nova posição (Fix #4) ──────────────
  it('object:moving — texto segue body em drag', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João', 'Arial');
    const body = manager.getFabricObject(meta.id)!;
    const textObj = canvas.getObjects().find((o) => o.type === 'text') as fabric.Text;
    expect(textObj).toBeDefined();

    const newLeftPx = mmToPx(80);
    const newTopPx = mmToPx(30);
    body.set({ left: newLeftPx, top: newTopPx });
    canvas.fire('object:moving', { target: body });

    // Texto tem originX/Y='center' → fica no centro do body.
    const bodyW = (body.width ?? 0) * (body.scaleX ?? 1);
    const bodyH = (body.height ?? 0) * (body.scaleY ?? 1);
    expect(textObj.left).toBeCloseTo(newLeftPx + bodyW / 2, 3);
    expect(textObj.top).toBeCloseTo(newTopPx + bodyH / 2, 3);
  });

  // ── 3. Escalar body → overlay tem novo tamanho (Fix #3) ─────────────────────
  it('object:scaling — overlay reescala com body', () => {
    const meta = manager.createSlot('nome');
    const body = manager.getFabricObject(meta.id)!;
    const overlay = findOverlayFor(meta.id)!;

    body.set({ scaleX: 2, scaleY: 1.5 });
    canvas.fire('object:scaling', { target: body });

    expect(overlay.scaleX).toBe(2);
    expect(overlay.scaleY).toBe(1.5);
  });

  // ── 4. Escalar body → texto recentraliza (Fix #4, fase 'transform') ─────────
  it('object:scaling — texto recentraliza, NÃO refaz fitText durante scale', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João', 'Arial');
    const body = manager.getFabricObject(meta.id)!;
    const textObj = canvas.getObjects().find((o) => o.type === 'text') as fabric.Text;
    const fontBefore = textObj.fontSize ?? 0;

    // Encolhe o body via scale.
    body.set({ scaleX: 0.5, scaleY: 0.5 });
    canvas.fire('object:scaling', { target: body });

    // Texto recentralizou no centro do body encolhido.
    const bodyW = (body.width ?? 0) * 0.5;
    const bodyH = (body.height ?? 0) * 0.5;
    const bodyLeftPx = body.left ?? 0;
    const bodyTopPx = body.top ?? 0;
    expect(textObj.left).toBeCloseTo(bodyLeftPx + bodyW / 2, 3);
    expect(textObj.top).toBeCloseTo(bodyTopPx + bodyH / 2, 3);

    // Decisão de design: durante scaling NÃO refaz fitText (custoso a 60fps).
    expect(textObj.fontSize).toBe(fontBefore);
  });

  // ── 5. object:modified → texto refaz fitText com nova dimensão (Fix #4) ────
  it('object:modified — texto refaz fitText quando slot encolhe (fase commit)', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João Silva Pereira', 'Arial');
    const body = manager.getFabricObject(meta.id)!;
    const textObj = canvas.getObjects().find((o) => o.type === 'text') as fabric.Text;
    const fontBefore = textObj.fontSize ?? 0;

    // Encolhe o body bastante via scale (slot pequeno demais pro nome longo).
    body.set({ scaleX: 0.3, scaleY: 0.5 });
    canvas.fire('object:modified', { target: body });

    // Modified é fase 'commit' → fontSize DEVE ter diminuído pra caber.
    expect(textObj.fontSize).toBeLessThan(fontBefore);
    expect(textObj.fontSize).toBeGreaterThan(0);
  });

  // ── 6. Logo segue body em drag e reescala em resize ────────────────────────
  it('object:moving + object:scaling — logo segue body e reescala proporcional', async () => {
    const meta = manager.createSlot('logo');
    await manager.addLogo(meta.id, MINIMAL_SVG);
    const body = manager.getFabricObject(meta.id)!;
    const group = canvas
      .getObjects()
      .find(
        (o) =>
          o.type === 'group' && (o as unknown as Record<string, unknown>).capiPlaceholder !== true
      ) as fabric.Group;
    expect(group).toBeDefined();

    // Mover body — logo deve acompanhar (canto superior-esquerdo do body).
    const newLeftPx = mmToPx(40);
    const newTopPx = mmToPx(30);
    body.set({ left: newLeftPx, top: newTopPx });
    canvas.fire('object:moving', { target: body });

    // A logo é centralizada dentro do body. Sua bbox vai ficar
    // dentro do retângulo (newLeftPx, newTopPx, bodyW, bodyH).
    const bodyW = (body.width ?? 0) * (body.scaleX ?? 1);
    const bodyH = (body.height ?? 0) * (body.scaleY ?? 1);
    expect(group.left).toBeGreaterThanOrEqual(newLeftPx - 0.5);
    expect(group.top).toBeGreaterThanOrEqual(newTopPx - 0.5);
    const scaledW = (group.width ?? 0) * (group.scaleX ?? 1);
    const scaledH = (group.height ?? 0) * (group.scaleY ?? 1);
    expect(scaledW).toBeLessThanOrEqual(bodyW + 0.5);
    expect(scaledH).toBeLessThanOrEqual(bodyH + 0.5);

    // Encolhe o body — logo reescala proporcional pra continuar cabendo.
    body.set({ scaleX: 0.5, scaleY: 0.5 });
    canvas.fire('object:scaling', { target: body });
    const newBodyW = (body.width ?? 0) * 0.5;
    const newBodyH = (body.height ?? 0) * 0.5;
    const newScaledW = (group.width ?? 0) * (group.scaleX ?? 1);
    const newScaledH = (group.height ?? 0) * (group.scaleY ?? 1);
    expect(newScaledW).toBeLessThanOrEqual(newBodyW + 0.5);
    expect(newScaledH).toBeLessThanOrEqual(newBodyH + 0.5);
  });

  // ── 7. updateSlot via API (caminho do painel) também sincroniza content ────
  it('updateSlot — caminho programático sincroniza overlay e content', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João', 'Arial');
    const body = manager.getFabricObject(meta.id)!;
    const overlay = findOverlayFor(meta.id)!;
    const textObj = canvas.getObjects().find((o) => o.type === 'text') as fabric.Text;

    // Move via painel (não via drag): updateSlot(x, y).
    manager.updateSlot(meta.id, { x: 100, y: 50, maxWidth: 30, maxHeight: 12 });

    // Body, overlay e text devem estar na nova posição.
    expect(body.left).toBe(mmToPx(100));
    expect(body.top).toBe(mmToPx(50));
    expect(overlay.left).toBe(mmToPx(100));
    expect(overlay.top).toBe(mmToPx(50));
    expect(overlay.width).toBe(mmToPx(30));

    // Texto centralizado no novo body.
    expect(textObj.left).toBeCloseTo(mmToPx(100 + 30 / 2), 3);
    expect(textObj.top).toBeCloseTo(mmToPx(50 + 12 / 2), 3);
  });

  // ── 8. Overlay tem objectCaching=false (Fix #3 direto) ─────────────────────
  it('Fix DEBT #3: overlay tem objectCaching=false pra evitar staleness em scale', () => {
    const meta = manager.createSlot('nome');
    const overlay = findOverlayFor(meta.id)!;
    expect(overlay.objectCaching).toBe(false);
  });

  // ── 9. Idempotência da escala da logo (não acumula scale a cada chamada) ───
  it('idempotência: múltiplas chamadas de scaling não acumulam scale na logo', async () => {
    const meta = manager.createSlot('logo');
    await manager.addLogo(meta.id, MINIMAL_SVG);
    const body = manager.getFabricObject(meta.id)!;
    const group = canvas
      .getObjects()
      .find(
        (o) =>
          o.type === 'group' && (o as unknown as Record<string, unknown>).capiPlaceholder !== true
      ) as fabric.Group;

    body.set({ scaleX: 0.5, scaleY: 0.5 });
    canvas.fire('object:scaling', { target: body });
    const scaleFirst = group.scaleX;

    // Dispara de novo SEM mudar body — scale do group deve permanecer igual.
    canvas.fire('object:scaling', { target: body });
    expect(group.scaleX).toBeCloseTo(scaleFirst ?? 0, 6);

    // Dispara de novo com mesmo body — idem.
    canvas.fire('object:scaling', { target: body });
    expect(group.scaleX).toBeCloseTo(scaleFirst ?? 0, 6);
  });
});
