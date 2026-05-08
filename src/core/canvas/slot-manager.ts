import * as fabric from 'fabric';

import { fabricMeasure, PT_TO_PX } from './fabric-measure';
import { fitText } from './fit-text';
import { parseAndStripRootDimensions } from './svg-utils';
import type { SlotMeta, SlotType } from './types';
import { mmToPx, pxToMm } from './units';

// ─── Defaults by slot type ─────────────────────────────────────────────────

interface SlotDefaults {
  maxWidth: number;
  maxHeight: number;
  autoFit: boolean;
}

const SLOT_DEFAULTS: Record<SlotType, SlotDefaults> = {
  nome: { maxWidth: 40, maxHeight: 8, autoFit: true },
  profissao: { maxWidth: 40, maxHeight: 6, autoFit: true },
  logo: { maxWidth: 15, maxHeight: 15, autoFit: false },
  custom: { maxWidth: 30, maxHeight: 10, autoFit: true },
};

// ─── Visual constants ──────────────────────────────────────────────────────

// laser #dc2626 at 60% opacity — red industrial = "área de edição" (Lightburn idiom)
const OVERLAY_STROKE = 'rgba(220, 38, 38, 0.6)';
const OVERLAY_STROKE_DASH: number[] = [5, 4];
const OVERLAY_WIDTH_DEFAULT = 1;
const OVERLAY_WIDTH_SELECTED = 2;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SlotManagerConfig {
  productWidthMm: number;
  productHeightMm: number;
}

export interface SlotManagerOptions {
  onSelectionChange?: (id: string | null) => void;
}

interface SlotEntry {
  meta: SlotMeta;
  /** Transparent Rect that carries capiSlot, is selectable/draggable, persists in canvasJson. */
  body: fabric.Rect;
  /** Dashed Rect overlay — visual only, not exported, not selectable. */
  overlay: fabric.Rect;
  /** Current operator content: fabric.Text (nome/profissao) or logo Group. Not exported. */
  content?: fabric.FabricObject;
  /** Gray placeholder shown in Operator mode when logo slot is empty. Not exported. */
  placeholder?: fabric.Group;
}

// ─── SlotManager ───────────────────────────────────────────────────────────

export class SlotManager {
  private readonly canvas: fabric.Canvas;
  private readonly config: SlotManagerConfig;
  private readonly onSelectionChangeCb?: (id: string | null) => void;
  private readonly slots = new Map<string, SlotEntry>();

  constructor(canvas: fabric.Canvas, config: SlotManagerConfig, options?: SlotManagerOptions) {
    this.canvas = canvas;
    this.config = config;
    this.onSelectionChangeCb = options?.onSelectionChange;
    this.attachCanvasListeners();
  }

  // ─── Public CRUD ─────────────────────────────────────────────────────────

  createSlot(type: SlotType, position?: { x: number; y: number }): SlotMeta {
    const defaults = SLOT_DEFAULTS[type];
    const x = position?.x ?? (this.config.productWidthMm - defaults.maxWidth) / 2;
    const y = position?.y ?? (this.config.productHeightMm - defaults.maxHeight) / 2;

    const meta: SlotMeta = {
      id: generateId(),
      type,
      x,
      y,
      maxWidth: defaults.maxWidth,
      maxHeight: defaults.maxHeight,
      autoCenter: true,
      autoFit: defaults.autoFit,
    };

    const body = this.buildBodyRect(meta);
    const overlay = this.buildOverlayRect(meta);
    setCapiSlot(body, meta);

    this.canvas.add(body);
    this.canvas.add(overlay);
    this.canvas.requestRenderAll();

    this.slots.set(meta.id, { meta, body, overlay });
    return { ...meta };
  }

  updateSlot(id: string, patch: Partial<Omit<SlotMeta, 'id' | 'type'>>): SlotMeta {
    const entry = this.slots.get(id);
    if (!entry) throw new Error(`[slot-manager] slot not found: ${id}`);

    const updated: SlotMeta = { ...entry.meta, ...patch, id, type: entry.meta.type };
    entry.meta = updated;

    if (
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.maxWidth !== undefined ||
      patch.maxHeight !== undefined
    ) {
      const geo = {
        left: mmToPx(updated.x),
        top: mmToPx(updated.y),
        width: mmToPx(updated.maxWidth),
        height: mmToPx(updated.maxHeight),
      };
      entry.body.set(geo);
      entry.body.setCoords();
      entry.overlay.set(geo);
      entry.overlay.setCoords();
    }

    setCapiSlot(entry.body, updated);
    this.canvas.requestRenderAll();
    return { ...updated };
  }

  deleteSlot(id: string): void {
    const entry = this.slots.get(id);
    if (!entry) return;
    this.canvas.remove(entry.body);
    this.canvas.remove(entry.overlay);
    this.slots.delete(id);
    this.canvas.requestRenderAll();
  }

  getSlot(id: string): SlotMeta | undefined {
    const entry = this.slots.get(id);
    return entry ? { ...entry.meta } : undefined;
  }

  listSlots(): SlotMeta[] {
    return Array.from(this.slots.values()).map((e) => ({ ...e.meta }));
  }

  /** Returns the body Rect for a slot (carries capiSlot, used in tests and engine). */
  getFabricObject(id: string): fabric.Rect | undefined {
    return this.slots.get(id)?.body;
  }

  // ─── Content management (stubs — implemented in Checkpoint C Phase 4) ────

  /** Applies fitText and places a read-only fabric.Text centred inside the slot. */
  addText(slotId: string, text: string, fontFamily: string): void {
    const entry = this.slots.get(slotId);
    if (!entry) throw new Error(`[slot-manager] slot not found: ${slotId}`);

    if (entry.content) {
      this.canvas.remove(entry.content);
      entry.content = undefined;
    }

    if (!text) {
      this.canvas.requestRenderAll();
      return;
    }

    const result = fitText({
      text,
      maxWidth: entry.meta.maxWidth,
      maxHeight: entry.meta.maxHeight,
      fontFamily,
      measureFn: fabricMeasure,
    });

    const textObj = new fabric.Text(text, {
      left: mmToPx(entry.meta.x + entry.meta.maxWidth / 2),
      top: mmToPx(entry.meta.y + entry.meta.maxHeight / 2),
      originX: 'center',
      originY: 'center',
      fontFamily,
      fontSize: result.fontSize * PT_TO_PX,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    });

    this.canvas.add(textObj);
    entry.content = textObj;
    this.canvas.requestRenderAll();
  }

  /** Loads an SVG string, scales it to fit the slot, centres it, and removes any placeholder. */
  async addLogo(slotId: string, svgString: string): Promise<void> {
    const entry = this.slots.get(slotId);
    if (!entry) throw new Error(`[slot-manager] slot not found: ${slotId}`);

    // Remove previous content.
    if (entry.content) {
      this.canvas.remove(entry.content);
      entry.content = undefined;
    }

    // Remove placeholder (if Operator mode had created one).
    this.removePlaceholder(entry);

    const stripped = parseAndStripRootDimensions(svgString);
    const { objects, options } = await fabric.loadSVGFromString(stripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) throw new Error('SVG não contém objetos válidos');

    // Always wrap in a Group so we get a predictable type and bounding box.
    const group = new fabric.Group(validObjects);

    const natW = group.width || mmToPx(entry.meta.maxWidth);
    const natH = group.height || mmToPx(entry.meta.maxHeight);
    const scale = Math.min(mmToPx(entry.meta.maxWidth) / natW, mmToPx(entry.meta.maxHeight) / natH);
    const scaledW = natW * scale;
    const scaledH = natH * scale;

    group.set({
      left: mmToPx(entry.meta.x) + (mmToPx(entry.meta.maxWidth) - scaledW) / 2,
      top: mmToPx(entry.meta.y) + (mmToPx(entry.meta.maxHeight) - scaledH) / 2,
      originX: 'left',
      originY: 'top',
      scaleX: scale,
      scaleY: scale,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    });
    void options; // parsed but dimensions come from Group bounding box

    this.canvas.add(group);
    entry.content = group;
    this.canvas.requestRenderAll();
  }

  /** Removes text or logo content from the slot (leaves body + overlay intact). */
  clearSlotContent(slotId: string): void {
    const entry = this.slots.get(slotId);
    if (!entry?.content) return;
    this.canvas.remove(entry.content);
    entry.content = undefined;
    this.canvas.requestRenderAll();
  }

  /** Returns all SlotMeta objects whose type matches the given value. */
  getSlotsByType(type: SlotType): SlotMeta[] {
    return Array.from(this.slots.values())
      .filter((e) => e.meta.type === type)
      .map((e) => ({ ...e.meta }));
  }

  // ─── Mode ─────────────────────────────────────────────────────────────────

  /**
   * Toggles overlay visibility for all slots.
   * Designer = overlay visible. Operator = overlay hidden (only content shows).
   */
  setMode(mode: 'designer' | 'operator'): void {
    const interactive = mode === 'designer';
    for (const entry of this.slots.values()) {
      entry.overlay.set({ visible: interactive });
      entry.body.set({
        selectable: interactive,
        evented: interactive,
        hoverCursor: interactive ? 'move' : 'default',
      });

      // Show placeholder for empty logo slots in Operator; remove in Designer.
      if (entry.meta.type === 'logo') {
        if (mode === 'operator' && !entry.content) {
          this.createPlaceholder(entry);
        } else {
          this.removePlaceholder(entry);
        }
      }
    }
    if (mode === 'operator') {
      this.canvas.discardActiveObject();
    }
    this.canvas.requestRenderAll();
  }

  private createPlaceholder(entry: SlotEntry): void {
    if (entry.placeholder) return;

    const slotW = mmToPx(entry.meta.maxWidth);
    const slotH = mmToPx(entry.meta.maxHeight);

    const bg = new fabric.Rect({
      width: slotW,
      height: slotH,
      fill: '#3a3d40',
      stroke: undefined,
      strokeWidth: 0,
      originX: 'left',
      originY: 'top',
      left: -slotW / 2,
      top: -slotH / 2,
    });

    const label = new fabric.Text('Logo', {
      fontSize: 10,
      fill: '#8a8e92',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
    });

    const group = new fabric.Group([bg, label], {
      left: mmToPx(entry.meta.x + entry.meta.maxWidth / 2),
      top: mmToPx(entry.meta.y + entry.meta.maxHeight / 2),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    });
    (group as unknown as Record<string, unknown>).capiPlaceholder = true;

    this.canvas.add(group);
    entry.placeholder = group;
  }

  private removePlaceholder(entry: SlotEntry): void {
    if (!entry.placeholder) return;
    this.canvas.remove(entry.placeholder);
    entry.placeholder = undefined;
  }

  // ─── Persistence ──────────────────────────────────────────────────────────

  /**
   * Rebuilds the internal slot map by scanning the canvas for body objects
   * that carry a `capiSlot` property, then creates fresh overlay Rects for
   * each one. Safe to call multiple times — cleans up existing overlays
   * before rebuilding (zero orphan leak).
   */
  loadSlotsFromCanvas(): void {
    // Remove overlays that are still on canvas (idempotency guard).
    const live = new Set(this.canvas.getObjects());
    for (const entry of this.slots.values()) {
      if (live.has(entry.overlay)) {
        this.canvas.remove(entry.overlay);
      }
    }
    this.slots.clear();

    // Re-scan canvas for body objects carrying capiSlot.
    for (const obj of this.canvas.getObjects()) {
      const meta = getCapiSlot(obj);
      if (!meta?.id) continue;

      const body = obj as fabric.Rect;
      body.set({ lockRotation: true }); // re-enforce invariant after deserialization
      const overlay = this.buildOverlayRect(meta);
      this.canvas.add(overlay);
      this.slots.set(meta.id, { meta: { ...meta }, body, overlay });
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Clears internal state without touching the canvas.
   * Called by CanvasEngine.clearUserObjects() after it already removed all
   * non-base objects from the canvas.
   */
  clear(): void {
    this.slots.clear();
  }

  // ─── Canvas event listeners ───────────────────────────────────────────────

  private attachCanvasListeners(): void {
    // Position sync during drag.
    this.canvas.on('object:moving', (e) => {
      const entry = this.findEntryByBody(e.target);
      if (!entry) return;
      entry.overlay.set({ left: e.target.left ?? 0, top: e.target.top ?? 0 });
      entry.overlay.setCoords();
    });

    // Size sync during scale (object:rotating is ignored — lockRotation=true on body).
    this.canvas.on('object:scaling', (e) => {
      const entry = this.findEntryByBody(e.target);
      if (!entry) return;
      entry.overlay.set({
        left: e.target.left ?? 0,
        top: e.target.top ?? 0,
        scaleX: e.target.scaleX ?? 1,
        scaleY: e.target.scaleY ?? 1,
      });
      entry.overlay.setCoords();
    });

    // Persist final position + size into meta after any transform.
    this.canvas.on('object:modified', (e) => {
      const entry = this.findEntryByBody(e.target);
      if (!entry) return;
      const body = e.target;

      entry.meta.x = pxToMm(body.left ?? 0);
      entry.meta.y = pxToMm(body.top ?? 0);
      entry.meta.maxWidth = pxToMm((body.width ?? 0) * (body.scaleX ?? 1));
      entry.meta.maxHeight = pxToMm((body.height ?? 0) * (body.scaleY ?? 1));
      setCapiSlot(body, { ...entry.meta });

      entry.overlay.set({
        left: body.left ?? 0,
        top: body.top ?? 0,
        scaleX: body.scaleX ?? 1,
        scaleY: body.scaleY ?? 1,
      });
      entry.overlay.setCoords();
    });

    // Selection visual feedback (strokeWidth 2 on selected slot overlay).
    this.canvas.on('selection:created', (e) => {
      this.handleFabricSelection((e as unknown as { selected?: fabric.FabricObject[] }).selected);
    });
    this.canvas.on('selection:updated', (e) => {
      this.handleFabricSelection((e as unknown as { selected?: fabric.FabricObject[] }).selected);
    });
    this.canvas.on('selection:cleared', () => {
      this.updateSelectionVisual(null);
      this.onSelectionChangeCb?.(null);
    });
  }

  private handleFabricSelection(selected: fabric.FabricObject[] | undefined): void {
    const meta = selected?.[0] ? getCapiSlot(selected[0]) : undefined;
    const id = meta?.id ?? null;
    this.updateSelectionVisual(id);
    this.onSelectionChangeCb?.(id);
  }

  private updateSelectionVisual(selectedId: string | null): void {
    for (const entry of this.slots.values()) {
      const isSelected = entry.meta.id === selectedId;
      entry.overlay.set({
        strokeWidth: isSelected ? OVERLAY_WIDTH_SELECTED : OVERLAY_WIDTH_DEFAULT,
      });
    }
    this.canvas.requestRenderAll();
  }

  private findEntryByBody(obj: fabric.FabricObject): SlotEntry | undefined {
    for (const entry of this.slots.values()) {
      if (entry.body === obj) return entry;
    }
    return undefined;
  }

  // ─── Fabric object builders ───────────────────────────────────────────────

  private buildBodyRect(meta: SlotMeta): fabric.Rect {
    return new fabric.Rect({
      left: mmToPx(meta.x),
      top: mmToPx(meta.y),
      width: mmToPx(meta.maxWidth),
      height: mmToPx(meta.maxHeight),
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: undefined,
      strokeWidth: 0,
      selectable: true,
      evented: true,
      lockRotation: true,
      cornerColor: '#8a8e92',
      transparentCorners: false,
      cornerSize: 6,
    });
  }

  private buildOverlayRect(meta: SlotMeta): fabric.Rect {
    return new fabric.Rect({
      left: mmToPx(meta.x),
      top: mmToPx(meta.y),
      width: mmToPx(meta.maxWidth),
      height: mmToPx(meta.maxHeight),
      originX: 'left',
      originY: 'top',
      fill: 'transparent',
      stroke: OVERLAY_STROKE,
      strokeWidth: OVERLAY_WIDTH_DEFAULT,
      strokeDashArray: OVERLAY_STROKE_DASH,
      strokeUniform: true,
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCapiSlot(obj: fabric.FabricObject): SlotMeta | undefined {
  return (obj as unknown as Record<string, unknown>).capiSlot as SlotMeta | undefined;
}

function setCapiSlot(obj: fabric.FabricObject, meta: SlotMeta): void {
  (obj as unknown as Record<string, unknown>).capiSlot = meta;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
