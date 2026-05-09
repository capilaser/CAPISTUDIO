import * as fabric from 'fabric';

import type { LayerMeta, VisualLayerMeta } from '@/data/schema';
import { buildMaterialPattern, loadImage } from './material-applier';
import type { CorelSvgMeta } from './corel-svg-parser';
import { isOperationLayer } from './layer-meta';
import { extractClipShapes, parseAndStripRootDimensions, type ParsedViewBox } from './svg-utils';
import { SlotManager } from './slot-manager';
import type { SlotMeta, SlotType } from './types';
import { mmToPx } from './units';

export interface EngineConfig {
  productWidthMm: number;
  productHeightMm: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
}

/**
 * Custom Capi properties that must be carried through Fabric serialization.
 * Fabric's toObject only persists these if explicitly listed (Risco 3).
 *
 *  - id        : stable per-object UUID, generated on first serialize
 *  - capiSlot  : SlotMeta (Onda 4+) — type/maxArea/auto* for slot-typed objects
 *
 * Add to this list when introducing new Capi-specific object metadata.
 * NOTE: materialId is NOT listed here — it lives in capi.layers (LayerMeta),
 * not as a per-Fabric-object property (ADR 008).
 */
export const CAPI_CUSTOM_PROPS = ['id', 'capiSlot'] as const;

export interface SerializedCanvas {
  version: string;
  objects: Array<Record<string, unknown>>;
  capi: {
    productId: string;
    units: 'mm';
    /**
     * Schema version for LayerMeta format (mirrors FabricCanvasJson.capi.schemaVersion).
     *   2 = discriminated union (ADR 010 §1, Fase C+). Absent/1 = flat (pre-Fase C).
     */
    schemaVersion: number;
    /** LayerMeta array — one entry per user object. Onda 5+. */
    layers: LayerMeta[];
  };
}

const BASE_OBJECT_FLAG = '__capiBase';
const ASPECT_TOLERANCE = 1e-3;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
/** Default fill restored when a material is removed from a visual layer. */
const DEFAULT_LAYER_FILL = 'rgba(122, 162, 247, 0.18)';
/**
 * Default stroke applied to base-layer paths after cleanCorelSvg strips fills.
 * ADR 010 §3: contorno da peça = ink-700. Canvas engine is authoritative for colour.
 * Matches tailwind token ink-700 (#2a2c2e) — do NOT use CSS var() here (Fabric doesn't resolve them).
 */
const SVG_BASE_STROKE = '#2a2c2e';

function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Helper: find a user (non-base) object by its capi id. */
function findById(canvas: fabric.Canvas, id: string): fabric.FabricObject | undefined {
  return canvas
    .getObjects()
    .find((o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === id);
}

export class CanvasEngine {
  readonly canvas: fabric.Canvas;
  readonly config: EngineConfig;

  private isPanModeActive = false;
  private isDragging = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private readonly slotManager: SlotManager;

  /**
   * Per-layer metadata map. Key = capi object id.
   * Populated on addRectangle / createSlot and restored on deserialize.
   * Serialized into capi.layers[] by serialize().
   */
  private readonly layerMeta = new Map<string, LayerMeta>();

  /**
   * Path `d` strings extracted from the loaded product SVG (SVG user units).
   * Set by loadProductSvg; empty when no product is loaded.
   * Used by applyMaterialToLayer to build a clipped Pattern (Checkpoint C).
   */
  private productPaths: string[] = [];

  /**
   * Coordinate space of the loaded product SVG (width/height in user units).
   * Null when no product is loaded.
   */
  private productSvgViewBox: { width: number; height: number } | null = null;

  /**
   * Per-session HTMLImageElement cache, keyed by materialId.
   * Avoids repeated network / IPC round-trips when the same material is
   * applied to multiple layers or re-applied after removal.
   */
  private readonly materialImageCache = new Map<string, HTMLImageElement>();

  /** Optional callback — set from outside to receive slot selection changes. */
  onSlotSelectionChange?: (id: string | null) => void;

  /**
   * Optional callback — fires whenever the active Fabric selection changes.
   * id   = capi object id of the newly selected object, or null on deselect.
   * meta = current LayerMeta for that id, or null.
   */
  onLayerSelectionChange?: (id: string | null, meta: LayerMeta | null) => void;

  constructor(canvasEl: HTMLCanvasElement, config: EngineConfig) {
    this.config = config;
    this.canvas = new fabric.Canvas(canvasEl, {
      width: config.viewportWidthPx,
      height: config.viewportHeightPx,
      backgroundColor: '#0d1117',
      preserveObjectStacking: true,
      selection: true,
    });

    this.slotManager = new SlotManager(
      this.canvas,
      { productWidthMm: config.productWidthMm, productHeightMm: config.productHeightMm },
      { onSelectionChange: (id) => this.onSlotSelectionChange?.(id) }
    );

    this.centerProductInViewport();
    this.attachPanHandlers();
    this.attachSelectionHandlers();
  }

  /**
   * Translates the viewport so the product origin (0,0 mm) lands at the
   * top-left of the centered product area. Resets zoom to 1.
   */
  private centerProductInViewport(): void {
    const productPxW = mmToPx(this.config.productWidthMm);
    const productPxH = mmToPx(this.config.productHeightMm);
    const tx = (this.config.viewportWidthPx - productPxW) / 2;
    const ty = (this.config.viewportHeightPx - productPxH) / 2;
    this.canvas.setViewportTransform([1, 0, 0, 1, tx, ty]);
  }

  /**
   * Wires fabric mouse events; the handlers are gated on `isPanModeActive`
   * so they only act while pan mode is on (Risco 4 mitigation: no conflict
   * with selection drag).
   */
  private attachPanHandlers(): void {
    this.canvas.on('mouse:down', (opt) => {
      if (!this.isPanModeActive) return;
      const evt = opt.e as MouseEvent;
      this.isDragging = true;
      this.lastPanX = evt.clientX;
      this.lastPanY = evt.clientY;
      this.canvas.setCursor('grabbing');
    });

    this.canvas.on('mouse:move', (opt) => {
      if (!this.isPanModeActive || !this.isDragging) return;
      const evt = opt.e as MouseEvent;
      const vpt = this.canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += evt.clientX - this.lastPanX;
      vpt[5] += evt.clientY - this.lastPanY;
      this.canvas.setViewportTransform(vpt);
      this.lastPanX = evt.clientX;
      this.lastPanY = evt.clientY;
    });

    this.canvas.on('mouse:up', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.isPanModeActive) {
        this.canvas.setCursor('grab');
      }
    });
  }

  /**
   * Wires selection:created / selection:updated / selection:cleared to
   * onLayerSelectionChange. Only fires for user objects (non-base).
   */
  private attachSelectionHandlers(): void {
    const notify = (obj: fabric.FabricObject | undefined): void => {
      if (!obj || isBaseObject(obj)) {
        this.onLayerSelectionChange?.(null, null);
        return;
      }
      const id = (obj as unknown as Record<string, unknown>).id as string | undefined;
      if (!id) {
        this.onLayerSelectionChange?.(null, null);
        return;
      }
      const meta = this.layerMeta.get(id) ?? null;
      this.onLayerSelectionChange?.(id, meta);
    };

    this.canvas.on('selection:created', (e) => {
      notify((e as unknown as { selected?: fabric.FabricObject[] }).selected?.[0]);
    });
    this.canvas.on('selection:updated', (e) => {
      notify((e as unknown as { selected?: fabric.FabricObject[] }).selected?.[0]);
    });
    this.canvas.on('selection:cleared', () => {
      this.onLayerSelectionChange?.(null, null);
    });
  }

  // ─── Layer metadata ───────────────────────────────────────────────────────

  /** Returns a copy of the LayerMeta for the given capi id, or null. */
  getLayerMeta(id: string): LayerMeta | null {
    const m = this.layerMeta.get(id);
    return m ? { ...m } : null;
  }

  /** Returns a snapshot of all LayerMeta entries (for restore after deserialize). */
  getAllLayerMetas(): Map<string, LayerMeta> {
    return new Map(this.layerMeta);
  }

  // ─── Material API ─────────────────────────────────────────────────────────

  /**
   * Applies a PNG material to a visual layer.
   *
   * - Sets a `fabric.Pattern` fill on the Fabric object (Checkpoint B).
   * - When a product SVG has been loaded, also applies an `absolutePositioned`
   *   `fabric.Path` clip matching the product's contour (Checkpoint C, Cenário 1).
   *   The clip is a fixed canvas-space window: only the portion of the layer
   *   that overlaps the product silhouette is rendered.
   *
   * @param layerId    capi object id
   * @param materialId id from the materials table (persisted in LayerMeta)
   * @param assetUrl   WebView-accessible URL (from resolveAssetUrl)
   */
  async applyMaterialToLayer(layerId: string, materialId: string, assetUrl: string): Promise<void> {
    const obj = findById(this.canvas, layerId);
    if (!obj) return;

    const w = obj.width ?? 0;
    const h = obj.height ?? 0;

    // Cached loader: reuse the HTMLImageElement for the same materialId
    // across calls within a session (avoids repeated IPC / network round-trips).
    // Cache key is materialId — stable across Tauri asset-URL regeneration.
    const cachedLoader = async (url: string): Promise<HTMLImageElement> => {
      const hit = this.materialImageCache.get(materialId);
      if (hit) return hit;
      const img = await loadImage(url);
      this.materialImageCache.set(materialId, img);
      return img;
    };

    const pattern = await buildMaterialPattern(assetUrl, w, h, cachedLoader);

    // Single set() call — avoids any intermediate render on the animation frame
    // between setting fill and clipPath (Fabric Q3 recommendation).
    const clipPath = this.buildProductClipPath();
    obj.set(clipPath !== null ? { fill: pattern, clipPath } : { fill: pattern });

    // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
    const meta = this.layerMeta.get(layerId);
    if (meta && !isOperationLayer(meta)) meta.materialId = materialId;

    this.canvas.requestRenderAll();
  }

  /**
   * Builds a `fabric.Path` representing the product's SVG contour for use as
   * an `absolutePositioned` clipPath (Checkpoint C, Cenário 1 — ADR 008).
   *
   * Returns null when no product SVG has been loaded yet.
   *
   * Coordinate mapping:
   *   Path data is in SVG user units (mm). `scaleX`/`scaleY` map those units
   *   to canvas pixels so the clip aligns with the product group, which is
   *   always placed at canvas (0, 0) with the same scale factors.
   *
   * Multiple shapes are concatenated into a single compound path string to
   * avoid `fabric.Group` — which has known `absolutePositioned` issues in
   * Fabric 6 (GitHub #7742).
   */
  private buildProductClipPath(): fabric.Path | null {
    if (this.productPaths.length === 0 || !this.productSvgViewBox) return null;

    const sx = mmToPx(this.config.productWidthMm) / this.productSvgViewBox.width;
    const sy = mmToPx(this.config.productHeightMm) / this.productSvgViewBox.height;

    // Resolve the product group's canvas position so the clip aligns precisely.
    // With absolutePositioned: true, left/top are in canvas absolute space — they
    // must match the product group's origin. originX/originY: 'left'/'top' forces
    // Fabric to skip auto-centering (which would offset the path to its bbox center).
    const productGroup = this.canvas.getObjects().find((o) => isBaseObject(o));
    const pgLeft = productGroup?.left ?? 0;
    const pgTop = productGroup?.top ?? 0;

    const clipPath = new fabric.Path(this.productPaths.join(' '), {
      left: pgLeft,
      top: pgTop,
      originX: 'left',
      originY: 'top',
      scaleX: sx,
      scaleY: sy,
      absolutePositioned: true,
    });

    return clipPath;
  }

  /**
   * Clears the per-session HTMLImageElement cache.
   * After calling this, the next applyMaterialToLayer call for any materialId
   * will reload the image from the asset URL.
   * Exposed for tests and for scenarios where asset URLs are regenerated.
   */
  clearMaterialCache(): void {
    this.materialImageCache.clear();
  }

  /**
   * Pre-loads HTMLImageElement instances into the cache so that subsequent
   * applyMaterialToLayer calls for the same materialId are instant.
   *
   * Call this from the UI layer after deserialize() — pass the materialIds
   * found in capi.layers together with their resolved Tauri asset URLs.
   *
   * @param entries  Array of { id: materialId, url: resolved asset URL }
   */
  async preloadMaterials(entries: Array<{ id: string; url: string }>): Promise<void> {
    await Promise.all(
      entries.map(async ({ id, url }) => {
        if (this.materialImageCache.has(id)) return; // already cached
        try {
          const img = await loadImage(url);
          this.materialImageCache.set(id, img);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn(`[canvas-engine] preloadMaterials: failed to load "${id}":`, err);
          }
        }
      })
    );
  }

  /**
   * Removes the material from a layer, restoring the default layer fill
   * and clearing the product-contour clipPath if one was applied.
   */
  removeMaterialFromLayer(layerId: string): void {
    const obj = findById(this.canvas, layerId);
    if (!obj) return;

    obj.set({ fill: DEFAULT_LAYER_FILL, clipPath: undefined });

    // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
    const meta = this.layerMeta.get(layerId);
    if (meta && !isOperationLayer(meta)) meta.materialId = null;

    this.canvas.requestRenderAll();
  }

  // ─── Product SVG ─────────────────────────────────────────────────────────

  /**
   * Loads the product base SVG as a locked background group.
   *
   * Scale comes from the authoritative viewBox + canvasMm (NOT from
   * `group.width`), and the SVG's root width/height are stripped first
   * so Fabric treats viewBox user units as 1:1.
   *
   * @deprecated Prefer `loadProductSvgFromMeta` when the SVG comes from a
   * user upload — it reuses the already-parsed `CorelSvgMeta` and avoids
   * double-parsing.
   */
  async loadProductSvg(svgString: string, viewBox: ParsedViewBox): Promise<void> {
    const stripped = parseAndStripRootDimensions(svgString);
    const { objects } = await fabric.loadSVGFromString(stripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) return;

    // ADR 010 §3: canvas engine is authoritative for base-layer colour.
    // fill: '' = no fill in Fabric/Canvas2D. Do NOT use 'none' here — Canvas2D
    // does not recognise 'none' as a valid fillStyle and falls back to black.
    // (SVG fill="none" is injected by cleanCorelSvg step 9 for the SVG parser,
    // but Fabric's Canvas2D renderer needs the empty-string sentinel instead.)
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = mmToPx(this.config.productWidthMm) / viewBox.width;
    const scaleY = mmToPx(this.config.productHeightMm) / viewBox.height;

    if (import.meta.env.DEV && Math.abs(scaleX - scaleY) > ASPECT_TOLERANCE) {
      console.warn(
        `[canvas-engine] Non-uniform product scale: ` +
          `canvasMm=${this.config.productWidthMm}×${this.config.productHeightMm}, ` +
          `viewBox=${viewBox.width}×${viewBox.height} → scale ${scaleX.toFixed(4)} vs ${scaleY.toFixed(4)}. ` +
          `Product viewBox and canvasMm should agree on aspect ratio.`
      );
    }

    group.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX,
      scaleY,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
    });
    (group as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;

    // Extract clip shapes AFTER confirming valid Fabric objects were found.
    // Coordinates are in SVG user units (mm); scale is applied at clip time.
    this.productPaths = extractClipShapes(svgString);
    this.productSvgViewBox = { width: viewBox.width, height: viewBox.height };

    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    this.canvas.requestRenderAll();
  }

  /**
   * Loads the product base SVG from already-parsed `CorelSvgMeta`.
   *
   * Preferred over `loadProductSvg` for user-uploaded SVGs: the SVG has
   * already passed the 6 validation gates in `parseCorelSvg`, and
   * `meta.svgStripped` is ready for Fabric without further processing.
   *
   * Scale is derived from `meta.scaleFactor` (width axis), with the height
   * axis computed independently. Both axes are guaranteed to agree within
   * 0.1% by gate 2 of `parseCorelSvg`, so the product always renders at
   * its exact physical size.
   *
   * In DEV mode, logs a warning when the SVG's physical dimensions diverge
   * from the engine's `EngineConfig.productWidthMm` by more than 0.5% —
   * which would indicate a mismatch between the DB product record and the
   * file on disk.
   */
  async loadProductSvgFromMeta(meta: CorelSvgMeta): Promise<void> {
    const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) return;

    // ADR 010 §3: canvas engine is authoritative for base-layer colour.
    // fill: '' = no fill in Fabric/Canvas2D. Do NOT use 'none' here — Canvas2D
    // does not recognise 'none' as a valid fillStyle and falls back to black.
    // (SVG fill="none" is injected by cleanCorelSvg step 9 for the SVG parser,
    // but Fabric's Canvas2D renderer needs the empty-string sentinel instead.)
    for (const obj of validObjects) {
      obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
    }

    const group = fabric.util.groupSVGElements(validObjects);

    const scaleX = meta.scaleFactor; // (MM_TO_PX × widthMm) / viewBoxW
    const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH; // independent axis for symmetry

    if (import.meta.env.DEV) {
      const configW = this.config.productWidthMm;
      const drift = Math.abs(meta.widthMm - configW) / configW;
      if (drift > 0.005) {
        console.warn(
          `[canvas-engine] SVG widthMm (${meta.widthMm.toFixed(3)}) differs from ` +
            `EngineConfig.productWidthMm (${configW}) by ${(drift * 100).toFixed(2)}%. ` +
            `Check that the product DB record matches the file.`
        );
      }
    }

    group.set({
      left: 0,
      top: 0,
      originX: 'left',
      originY: 'top',
      scaleX,
      scaleY,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
    });
    (group as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;

    // svgStripped has root width/height removed but all path data intact —
    // extractClipShapes only reads <path d="…"> elements, which are preserved.
    this.productPaths = extractClipShapes(meta.svgStripped);
    this.productSvgViewBox = { width: meta.viewBoxW, height: meta.viewBoxH };

    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    this.canvas.requestRenderAll();
  }

  /**
   * Adds a user-editable rectangle in product mm coordinates.
   * Top-left positioning, dimensions in mm.
   * Automatically registers a LayerMeta entry (kind='visual').
   */
  addRectangle(xMm: number, yMm: number, wMm: number, hMm: number): fabric.Rect {
    const rect = new fabric.Rect({
      left: mmToPx(xMm),
      top: mmToPx(yMm),
      width: mmToPx(wMm),
      height: mmToPx(hMm),
      originX: 'left',
      originY: 'top',
      fill: DEFAULT_LAYER_FILL,
      stroke: '#7aa2f7',
      strokeWidth: 1,
      strokeUniform: true,
      cornerColor: '#7aa2f7',
      cornerStrokeColor: '#7aa2f7',
      borderColor: '#7aa2f7',
      transparentCorners: false,
      cornerSize: 8,
    });
    this.canvas.add(rect);

    // Assign a stable id immediately so layerMeta can be keyed by it.
    const rec = rect as unknown as Record<string, unknown>;
    if (typeof rec.id !== 'string' || !rec.id) {
      rec.id = generateObjectId();
    }
    this.registerLayerMeta(rec.id as string);

    this.canvas.setActiveObject(rect);
    this.canvas.requestRenderAll();
    return rect;
  }

  /**
   * Removes every object that wasn't tagged as base (product SVG).
   * Also clears the SlotManager's internal map and all LayerMeta entries.
   */
  clearUserObjects(): void {
    const toRemove = this.canvas.getObjects().filter((o) => !isBaseObject(o));
    toRemove.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.slotManager.clear();
    this.layerMeta.clear();
    this.canvas.requestRenderAll();
  }

  // ─── Slot API ─────────────────────────────────────────────────────────────

  /**
   * Creates a new slot at the centre of the product area and returns its metadata.
   * Automatically registers a LayerMeta entry for the slot (kind='visual').
   */
  createSlot(type: SlotType): SlotMeta {
    const meta = this.slotManager.createSlot(type);
    this.registerLayerMeta(meta.id);
    return meta;
  }

  /**
   * Switches between Designer and Operator modes.
   * Designer = slot overlays visible. Operator = overlays hidden, content only.
   */
  setMode(mode: 'designer' | 'operator'): void {
    this.slotManager.setMode(mode);
  }

  /**
   * Rebuilds the SlotManager state from objects currently on the canvas.
   * Call this after `deserialize()` to restore slot overlays and internal map.
   */
  loadSlotsFromCanvas(): void {
    this.slotManager.loadSlotsFromCanvas();
  }

  /** Returns all SlotMeta objects of the given type (read-only snapshot). */
  getSlotsByType(type: SlotType): SlotMeta[] {
    return this.slotManager.getSlotsByType(type);
  }

  /**
   * Applies fitText and renders the text inside the first slot of the given type.
   * No-op if no slot of that type exists.
   */
  fillTextSlot(type: 'nome' | 'profissao', text: string, fontFamily: string): void {
    const slots = this.slotManager.getSlotsByType(type);
    if (slots.length === 0) return;
    this.slotManager.addText(slots[0].id, text, fontFamily);
  }

  /**
   * Loads an SVG string into the first logo slot, scaled and centred.
   * No-op if no logo slot exists.
   */
  async fillLogoSlot(svgString: string): Promise<void> {
    const slots = this.slotManager.getSlotsByType('logo');
    if (slots.length === 0) return;
    await this.slotManager.addLogo(slots[0].id, svgString);
  }

  /**
   * Removes text or logo content from the first slot of the given type.
   * No-op if no slot of that type exists.
   */
  clearSlotContent(type: SlotType): void {
    const slots = this.slotManager.getSlotsByType(type);
    if (slots.length === 0) return;
    this.slotManager.clearSlotContent(slots[0].id);
  }

  // ─── Zoom / Pan ───────────────────────────────────────────────────────────

  /** Multiplies current zoom by `factor`, clamped, centered on viewport center. */
  zoomBy(factor: number): void {
    const current = this.canvas.getZoom();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
    if (next === current) return;
    const center = new fabric.Point(
      this.config.viewportWidthPx / 2,
      this.config.viewportHeightPx / 2
    );
    this.canvas.zoomToPoint(center, next);
    this.canvas.requestRenderAll();
  }

  /** Resets zoom to 1 and re-centers the product. */
  resetView(): void {
    this.centerProductInViewport();
    this.canvas.requestRenderAll();
  }

  /**
   * Toggles pan mode. While active: selection disabled, all user objects
   * un-selectable/un-evented, cursor becomes grab/grabbing during drag.
   * Disabling restores selectability.
   */
  setPanMode(active: boolean): void {
    if (this.isPanModeActive === active) return;
    this.isPanModeActive = active;

    if (active) {
      this.canvas.discardActiveObject();
      this.canvas.selection = false;
      this.canvas.forEachObject((o) => {
        if (!isBaseObject(o)) {
          o.selectable = false;
          o.evented = false;
        }
      });
      this.canvas.defaultCursor = 'grab';
      this.canvas.hoverCursor = 'grab';
      this.canvas.setCursor('grab');
    } else {
      this.isDragging = false;
      this.canvas.selection = true;
      this.canvas.forEachObject((o) => {
        if (!isBaseObject(o)) {
          o.selectable = true;
          o.evented = true;
        }
      });
      this.canvas.defaultCursor = 'default';
      this.canvas.hoverCursor = 'move';
    }
    this.canvas.requestRenderAll();
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Serializes user objects (excludeFromExport=true on the base SVG keeps it
   * out of the output). Each object gets a stable `id` if it didn't already
   * have one.
   *
   * STRIP-BEFORE-SERIALIZE (symmetric): before `canvas.toObject()` we temporarily
   * remove two transient state values that must NOT be baked into the JSON:
   *   1. `fill` Pattern — references Tauri asset URLs that may become stale.
   *      Replaced with 'transparent'; restored from capi.layers on deserialize.
   *   2. `clipPath` — derived deterministically from `productPaths` at runtime.
   *      Re-applied by `applyMaterialToLayer` → `buildProductClipPath` on deserialize.
   * Both are restored on the live canvas immediately after the snapshot, so
   * `serialize()` has zero side-effects on the visible canvas state.
   */
  serialize(productId: string): SerializedCanvas {
    // Ensure user objects have ids.
    this.canvas.forEachObject((o) => {
      if (isBaseObject(o)) return;
      const rec = o as unknown as Record<string, unknown>;
      if (typeof rec.id !== 'string' || !rec.id) {
        rec.id = generateObjectId();
      }
    });

    // STRIP — remove Pattern fills and clipPaths before snapshot.
    // Rationale: Pattern fills reference Tauri asset URLs that may become stale
    // across app installs; clipPaths are derived from productPaths (engine state)
    // and must be rebuilt deterministically on deserialize — not baked in JSON.
    // The canonical materialId is preserved in capi.layers instead.
    const savedFills = new Map<string, fabric.Pattern>();
    const savedClipPaths = new Map<string, fabric.FabricObject>();
    this.canvas.forEachObject((o) => {
      if (isBaseObject(o)) return;
      const id = (o as unknown as Record<string, unknown>).id as string;
      if (o.fill instanceof fabric.Pattern) {
        savedFills.set(id, o.fill as fabric.Pattern);
        o.set({ fill: 'transparent' });
      }
      if (o.clipPath) {
        savedClipPaths.set(id, o.clipPath as fabric.FabricObject);
        o.set({ clipPath: undefined });
      }
    });

    const json = this.canvas.toObject([...CAPI_CUSTOM_PROPS]) as {
      version: string;
      objects: Array<Record<string, unknown>>;
    };

    // RESTORE — symmetric: live canvas state must not be permanently mutated.
    savedFills.forEach((pattern, id) => {
      const obj = findById(this.canvas, id);
      obj?.set({ fill: pattern });
    });
    savedClipPaths.forEach((clipPath, id) => {
      const obj = findById(this.canvas, id);
      obj?.set({ clipPath });
    });

    // Build layers array, computing current zIndex from canvas order.
    const allObjects = this.canvas.getObjects();
    const layers: LayerMeta[] = Array.from(this.layerMeta.values()).map((m) => ({
      ...m,
      zIndex: allObjects.findIndex(
        (o) => !isBaseObject(o) && (o as unknown as Record<string, unknown>).id === m.id
      ),
    }));

    return {
      version: json.version,
      objects: json.objects,
      capi: {
        productId,
        units: 'mm',
        schemaVersion: 2,
        layers,
      },
    };
  }

  /**
   * Replaces user objects with the ones described in `data`. The base SVG is
   * preserved (clearUserObjects only removes non-base objects, then enliven +
   * add re-creates the user objects). Idempotent: deserialize(serialize()) is
   * a no-op visually.
   *
   * @param resolveUrl  Optional async resolver: materialId → WebView URL.
   *                    When provided, material Patterns are re-applied for every
   *                    layer with a non-null materialId after enlivening objects.
   *                    The engine itself has no knowledge of Tauri APIs — the
   *                    caller supplies resolution (CanvasTest, tests, etc.).
   */
  async deserialize(
    data: SerializedCanvas,
    resolveUrl?: (materialId: string) => Promise<string>
  ): Promise<void> {
    this.clearUserObjects();

    // Restore layerMeta from the persisted array.
    for (const layer of data.capi?.layers ?? []) {
      this.layerMeta.set(layer.id, { ...layer });
    }

    if (!data.objects || data.objects.length === 0) {
      this.canvas.requestRenderAll();
      return;
    }

    const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(data.objects);
    for (const obj of enlivened) {
      this.canvas.add(obj);
    }
    this.slotManager.loadSlotsFromCanvas();

    // Re-apply material Patterns for all layers that had a materialId.
    // OperationLayerMeta has no materialId field — filter it out before accessing.
    if (resolveUrl) {
      await Promise.all(
        Array.from(this.layerMeta.entries())
          .filter(
            ([, meta]) => !isOperationLayer(meta) && (meta as VisualLayerMeta).materialId !== null
          )
          .map(async ([id, meta]) => {
            // Safe: filter above guarantees meta is PrincipalLayerMeta | VisualLayerMeta.
            const materialId = (meta as VisualLayerMeta).materialId!;
            try {
              const url = await resolveUrl(materialId);
              await this.applyMaterialToLayer(id, materialId, url);
            } catch (err) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[canvas-engine] Failed to re-apply material ${materialId} on layer ${id}:`,
                  err
                );
              }
            }
          })
      );
    }

    this.canvas.requestRenderAll();
  }

  dispose(): void {
    void this.canvas.dispose();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Registers a new LayerMeta entry with default values for a visual layer.
   * Called after every user-object creation (addRectangle, createSlot).
   */
  private registerLayerMeta(id: string): void {
    if (this.layerMeta.has(id)) return; // idempotent
    // Emit VisualLayerMeta (ADR 010 §1, Fase C). Principal/operation layers are
    // created explicitly by higher-level flows (Onda 7+), not by this internal helper.
    const meta: VisualLayerMeta = {
      id,
      parentLayerId: null,
      name: `Camada ${this.layerMeta.size + 1}`,
      zIndex: this.canvas.getObjects().length - 1,
      visible: true,
      locked: false,
      kind: 'visual',
      materialId: null,
    };
    this.layerMeta.set(id, meta);
  }
}

export function isBaseObject(obj: fabric.FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] === true;
}

export { BASE_OBJECT_FLAG };
