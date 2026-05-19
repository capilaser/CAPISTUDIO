import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CAPI_CUSTOM_PROPS } from '@/core/canvas/canvas-engine';
import { PT_TO_PX } from '@/core/canvas/fabric-measure';
import { SlotManager } from '@/core/canvas/slot-manager';
import type { SlotMeta } from '@/core/canvas/types';
import { mmToPx } from '@/core/canvas/units';

const MINIMAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50" fill="red"/></svg>`;

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
};

describe('SlotManager', () => {
  let canvasEl: HTMLCanvasElement;
  let canvas: fabric.Canvas;
  let manager: SlotManager;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    canvas = new fabric.Canvas(canvasEl, { width: 800, height: 500 });
    manager = new SlotManager(canvas, baseConfig);
  });

  afterEach(() => {
    void canvas.dispose();
  });

  // ── 1. createSlot returns correct defaults and appears in listSlots ─────
  it('createSlot("nome") returns SlotMeta with correct defaults and appears in listSlots', () => {
    const meta = manager.createSlot('nome');

    expect(meta.type).toBe('nome');
    expect(meta.maxWidth).toBe(40);
    expect(meta.maxHeight).toBe(8);
    expect(meta.autoFit).toBe(true);
    expect(meta.autoCenter).toBe(true);
    expect(meta.id).toBeTruthy();

    const list = manager.listSlots();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(meta.id);
  });

  // ── 2. updateSlot patches meta; getSlot reflects the change ─────────────
  it('updateSlot updates content and getSlot reflects the change', () => {
    const meta = manager.createSlot('nome');
    manager.updateSlot(meta.id, { content: 'Flavinha' });

    const updated = manager.getSlot(meta.id);
    expect(updated?.content).toBe('Flavinha');
    expect(updated?.type).toBe('nome'); // immutable
    expect(updated?.id).toBe(meta.id); // immutable
  });

  // ── 3. deleteSlot removes from map and canvas ────────────────────────────
  it('deleteSlot removes the slot from listSlots and getSlot', () => {
    const meta = manager.createSlot('profissao');
    expect(manager.listSlots()).toHaveLength(1);

    manager.deleteSlot(meta.id);

    expect(manager.getSlot(meta.id)).toBeUndefined();
    expect(manager.listSlots()).toHaveLength(0);
  });

  // ── 4. Defaults differ correctly by type ─────────────────────────────────
  it('applies correct default dimensions and autoFit per slot type', () => {
    const nome = manager.createSlot('nome');
    const profissao = manager.createSlot('profissao');
    const logo = manager.createSlot('logo');
    const custom = manager.createSlot('custom');

    expect(nome.maxWidth).toBe(40);
    expect(nome.maxHeight).toBe(8);
    expect(nome.autoFit).toBe(true);

    expect(profissao.maxWidth).toBe(40);
    expect(profissao.maxHeight).toBe(6);
    expect(profissao.autoFit).toBe(true);

    expect(logo.maxWidth).toBe(15);
    expect(logo.maxHeight).toBe(15);
    expect(logo.autoFit).toBe(false);

    expect(custom.maxWidth).toBe(30);
    expect(custom.maxHeight).toBe(10);
    expect(custom.autoFit).toBe(true);
  });

  // ── 5. capiSlot is stored on the Fabric object ───────────────────────────
  it('stores capiSlot on the Fabric Rect after createSlot', () => {
    const meta = manager.createSlot('nome');

    // SlotManager exposes the Fabric object via getFabricObject.
    const obj = manager.getFabricObject(meta.id) as unknown as Record<string, unknown>;
    expect(obj).toBeDefined();

    const stored = obj['capiSlot'] as SlotMeta;
    expect(stored).toBeDefined();
    expect(stored.id).toBe(meta.id);
    expect(stored.type).toBe('nome');
    expect(stored.maxWidth).toBe(40);
    expect(stored.maxHeight).toBe(8);
  });

  // ── 5b. Onda 31 — body.id sincronizado com capiSlot.id ──────────────────
  it('Onda 31: body.id equals capiSlot.id after createSlot (eliminates dual-path)', () => {
    const meta = manager.createSlot('nome');
    const obj = manager.getFabricObject(meta.id) as unknown as Record<string, unknown>;

    // Antes da Onda 31, body.id era undefined — findById(canvas, slotId)
    // não achava slots. A partir da Onda 31, o slot manager seta body.id
    // = meta.id na criação, então TANTO findById quanto findByCapiId
    // encontram o slot.
    expect(obj['id']).toBe(meta.id);
    expect((obj['capiSlot'] as SlotMeta).id).toBe(meta.id);

    // Findable via canvas direto (caminho do `findById`).
    const found = canvas
      .getObjects()
      .find((o) => (o as unknown as Record<string, unknown>).id === meta.id);
    expect(found).toBe(manager.getFabricObject(meta.id));
  });

  // ── 6. Default position is centred in the product area ──────────────────
  it('positions the slot at the centre of the product area by default', () => {
    const meta = manager.createSlot('nome');
    // centro X = (60 - 40) / 2 = 10 mm; centro Y = (25 - 8) / 2 = 8.5 mm
    expect(meta.x).toBeCloseTo(10, 5);
    expect(meta.y).toBeCloseTo(8.5, 5);
  });

  // ── 7. Fabric object position matches slot mm position ───────────────────
  it('Fabric Rect left/top match mmToPx of the slot position', () => {
    const meta = manager.createSlot('logo');
    const obj = manager.getFabricObject(meta.id)!;

    expect(obj.left).toBeCloseTo(mmToPx(meta.x), 5);
    expect(obj.top).toBeCloseTo(mmToPx(meta.y), 5);
    expect(obj.width).toBeCloseTo(mmToPx(meta.maxWidth), 5);
    expect(obj.height).toBeCloseTo(mmToPx(meta.maxHeight), 5);
  });

  // ── 8. updateSlot with custom position is rejected for id/type patches ───
  it('updateSlot cannot change id or type', () => {
    const meta = manager.createSlot('nome');
    // @ts-expect-error — deliberately passing id/type to verify they are ignored
    manager.updateSlot(meta.id, { id: 'hacked', type: 'logo' });

    const slot = manager.getSlot(meta.id)!;
    expect(slot.id).toBe(meta.id);
    expect(slot.type).toBe('nome');
  });

  // ── 9. Multiple slots coexist independently ───────────────────────────────
  it('manages multiple independent slots without interference', () => {
    const a = manager.createSlot('nome');
    const b = manager.createSlot('profissao');
    const c = manager.createSlot('logo');

    expect(manager.listSlots()).toHaveLength(3);

    manager.deleteSlot(b.id);

    expect(manager.listSlots()).toHaveLength(2);
    expect(manager.getSlot(a.id)).toBeDefined();
    expect(manager.getSlot(b.id)).toBeUndefined();
    expect(manager.getSlot(c.id)).toBeDefined();
  });

  // ── 10. Round-trip: serialize → clear → deserialize preserves slots ───────
  it('persists slots through serialize → clear → deserialize', async () => {
    const logoMeta = manager.createSlot('logo');
    const nomeMeta = manager.createSlot('nome');
    const profMeta = manager.createSlot('profissao');

    // Serialize — overlays excluded (excludeFromExport=true), only bodies in JSON
    const json = canvas.toObject([...CAPI_CUSTOM_PROPS]);

    // Clear canvas and internal map (mirrors CanvasEngine.clearUserObjects flow)
    canvas.clear();
    manager.clear();

    // Restore body objects (mirrors CanvasEngine.deserialize)
    const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(
      json.objects as fabric.FabricObject[]
    );
    for (const obj of enlivened) {
      canvas.add(obj);
    }

    // Rebuild slot state from canvas
    manager.loadSlotsFromCanvas();

    // ── Assert: 3 slots recovered ──────────────────────────────────────────
    const slots = manager.listSlots();
    expect(slots).toHaveLength(3);

    const logo = manager.getSlot(logoMeta.id);
    expect(logo).toBeDefined();
    expect(logo?.type).toBe('logo');
    expect(logo?.maxWidth).toBe(15);
    expect(logo?.maxHeight).toBe(15);
    expect(logo?.x).toBeCloseTo(logoMeta.x, 5);
    expect(logo?.y).toBeCloseTo(logoMeta.y, 5);

    const nome = manager.getSlot(nomeMeta.id);
    expect(nome).toBeDefined();
    expect(nome?.type).toBe('nome');
    expect(nome?.maxWidth).toBe(40);
    expect(nome?.id).toBe(nomeMeta.id);

    const prof = manager.getSlot(profMeta.id);
    expect(prof).toBeDefined();
    expect(prof?.type).toBe('profissao');
    expect(prof?.maxWidth).toBe(40);
    expect(prof?.maxHeight).toBe(6);
  });

  // ── 11. setMode("operator") hides ALL overlays ────────────────────────────
  it('setMode("operator") esconde overlay de TODOS os slots', () => {
    manager.createSlot('nome');
    manager.createSlot('profissao');
    manager.createSlot('logo');

    manager.setMode('operator');

    // Overlays are excludeFromExport=true objects that are NOT placeholders.
    // Placeholders are a separate concept (capiPlaceholder=true) added in Checkpoint C.
    const overlays = canvas.getObjects().filter((o) => {
      const rec = o as unknown as Record<string, unknown>;
      return rec.excludeFromExport === true && rec.capiPlaceholder !== true;
    });
    expect(overlays).toHaveLength(3);
    for (const o of overlays) {
      expect(o.visible).toBe(false);
    }
  });

  // ── 12. setMode("operator") locks body selection; Designer restores it ────
  it('setMode("operator") trava seleção dos bodies; setMode("designer") restaura', () => {
    manager.createSlot('nome');
    manager.createSlot('profissao');
    manager.createSlot('logo');

    manager.setMode('operator');

    // Bodies carry capiSlot — overlays do not.
    const bodies = canvas
      .getObjects()
      .filter((o) => (o as unknown as Record<string, unknown>).capiSlot !== undefined);
    expect(bodies).toHaveLength(3);
    for (const b of bodies) {
      expect(b.selectable).toBe(false);
      expect(b.evented).toBe(false);
    }

    manager.setMode('designer');

    for (const b of bodies) {
      expect(b.selectable).toBe(true);
      expect(b.evented).toBe(true);
    }
  });

  // ── 13. addText applies fitText and places fabric.Text in the slot ─────────
  it('addText places a fabric.Text with correct text and fontSize ≤ maxFontSize', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'João', 'Arial');

    const texts = canvas.getObjects().filter((o) => o.type === 'text');
    expect(texts).toHaveLength(1);

    const t = texts[0] as fabric.Text;
    expect(t.text).toBe('João');
    // fontSize stored in px; maxFontSize default = 24pt × PT_TO_PX
    expect(t.fontSize).toBeGreaterThan(0);
    expect(t.fontSize).toBeLessThanOrEqual(Math.ceil(24 * PT_TO_PX) + 1);
  });

  // ── 14. addText long text → smaller fontSize than short text ──────────────
  it('addText with a long name produces a smaller fontSize than a short name', () => {
    const meta = manager.createSlot('nome');

    manager.addText(meta.id, 'Jo', 'Arial');
    const shortSize =
      (canvas.getObjects().find((o) => o.type === 'text') as fabric.Text).fontSize ?? 0;

    manager.addText(meta.id, 'João Silva da Costa Junior', 'Arial');
    const longSize =
      (canvas.getObjects().find((o) => o.type === 'text') as fabric.Text).fontSize ?? 0;

    expect(longSize).toBeLessThan(shortSize);
  });

  // ── 15. clearSlotContent removes fabric.Text from canvas ──────────────────
  it('clearSlotContent removes the fabric.Text added by addText', () => {
    const meta = manager.createSlot('nome');
    manager.addText(meta.id, 'Test', 'Arial');
    expect(canvas.getObjects().filter((o) => o.type === 'text')).toHaveLength(1);

    manager.clearSlotContent(meta.id);

    expect(canvas.getObjects().filter((o) => o.type === 'text')).toHaveLength(0);
  });

  // ── 16. addLogo creates fabric.Group positioned within slot bounds ─────────
  it('addLogo creates a fabric.Group whose bounds fit inside the slot area', async () => {
    const meta = manager.createSlot('logo');
    await manager.addLogo(meta.id, MINIMAL_SVG);

    const groups = canvas
      .getObjects()
      .filter(
        (o) =>
          o.type === 'group' && (o as unknown as Record<string, unknown>).capiPlaceholder !== true
      );
    expect(groups).toHaveLength(1);

    const g = groups[0];
    const scaledW = (g.width ?? 0) * (g.scaleX ?? 1);
    const scaledH = (g.height ?? 0) * (g.scaleY ?? 1);

    expect(g.left).toBeGreaterThanOrEqual(mmToPx(meta.x) - 1);
    expect(g.top).toBeGreaterThanOrEqual(mmToPx(meta.y) - 1);
    expect(scaledW).toBeLessThanOrEqual(mmToPx(meta.maxWidth) + 1);
    expect(scaledH).toBeLessThanOrEqual(mmToPx(meta.maxHeight) + 1);
  });

  // ── 17. setMode("operator") on empty logo slot adds placeholder ───────────
  it('setMode("operator") adds a placeholder for empty logo slots', () => {
    manager.createSlot('logo');
    const countBefore = canvas.getObjects().length;

    manager.setMode('operator');

    const placeholders = canvas
      .getObjects()
      .filter((o) => (o as unknown as Record<string, unknown>).capiPlaceholder === true);
    expect(placeholders).toHaveLength(1);
    expect(canvas.getObjects().length).toBe(countBefore + 1);
  });

  // ── 18. addLogo in slot with placeholder removes the placeholder ──────────
  it('addLogo removes the placeholder and adds the logo group', async () => {
    const meta = manager.createSlot('logo');
    manager.setMode('operator'); // creates placeholder

    const placeholdersBefore = canvas
      .getObjects()
      .filter((o) => (o as unknown as Record<string, unknown>).capiPlaceholder === true);
    expect(placeholdersBefore).toHaveLength(1);

    await manager.addLogo(meta.id, MINIMAL_SVG);

    const placeholdersAfter = canvas
      .getObjects()
      .filter((o) => (o as unknown as Record<string, unknown>).capiPlaceholder === true);
    expect(placeholdersAfter).toHaveLength(0);

    const logoGroups = canvas
      .getObjects()
      .filter(
        (o) =>
          o.type === 'group' && (o as unknown as Record<string, unknown>).capiPlaceholder !== true
      );
    expect(logoGroups).toHaveLength(1);
  });
});
