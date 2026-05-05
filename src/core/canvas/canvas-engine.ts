import * as fabric from 'fabric';

import { parseAndStripRootDimensions, type ParsedViewBox } from './svg-utils';
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
 */
const CAPI_CUSTOM_PROPS = ['id', 'capiSlot'] as const;

export interface SerializedCanvas {
  version: string;
  objects: Array<Record<string, unknown>>;
  capi: {
    productId: string;
    units: 'mm';
    layers: never[];
  };
}

const BASE_OBJECT_FLAG = '__capiBase';
const ASPECT_TOLERANCE = 1e-3;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class CanvasEngine {
  readonly canvas: fabric.Canvas;
  readonly config: EngineConfig;

  private isPanModeActive = false;
  private isDragging = false;
  private lastPanX = 0;
  private lastPanY = 0;

  constructor(canvasEl: HTMLCanvasElement, config: EngineConfig) {
    this.config = config;
    this.canvas = new fabric.Canvas(canvasEl, {
      width: config.viewportWidthPx,
      height: config.viewportHeightPx,
      backgroundColor: '#0d1117',
      preserveObjectStacking: true,
      selection: true,
    });

    this.centerProductInViewport();
    this.attachPanHandlers();
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
   * Loads the product base SVG as a locked background group.
   *
   * Scale comes from the authoritative viewBox + canvasMm (NOT from
   * `group.width`), and the SVG's root width/height are stripped first
   * so Fabric treats viewBox user units as 1:1.
   */
  async loadProductSvg(svgString: string, viewBox: ParsedViewBox): Promise<void> {
    const stripped = parseAndStripRootDimensions(svgString);
    const { objects } = await fabric.loadSVGFromString(stripped);
    const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
    if (validObjects.length === 0) return;

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

    this.canvas.add(group);
    this.canvas.sendObjectToBack(group);
    this.canvas.requestRenderAll();
  }

  /**
   * Adds a user-editable rectangle in product mm coordinates.
   * Top-left positioning, dimensions in mm.
   */
  addRectangle(xMm: number, yMm: number, wMm: number, hMm: number): fabric.Rect {
    const rect = new fabric.Rect({
      left: mmToPx(xMm),
      top: mmToPx(yMm),
      width: mmToPx(wMm),
      height: mmToPx(hMm),
      originX: 'left',
      originY: 'top',
      fill: 'rgba(122, 162, 247, 0.18)',
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
    this.canvas.setActiveObject(rect);
    this.canvas.requestRenderAll();
    return rect;
  }

  /**
   * Removes every object that wasn't tagged as base (product SVG).
   */
  clearUserObjects(): void {
    const toRemove = this.canvas.getObjects().filter((o) => !isBaseObject(o));
    toRemove.forEach((o) => this.canvas.remove(o));
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  /**
   * Multiplies current zoom by `factor`, clamped, centered on viewport center.
   */
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

  /**
   * Resets zoom to 1 and re-centers the product.
   */
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

  /**
   * Serializes user objects (excludeFromExport=true on the base SVG keeps it
   * out of the output). Each object gets a stable `id` if it didn't already
   * have one. The CAPI_CUSTOM_PROPS list is the contract with the schema's
   * FabricCanvasJson type — keep them in sync.
   */
  serialize(productId: string): SerializedCanvas {
    // Ensure user objects have ids before snapshot (mutation in place is fine —
    // ids are stable and persisting them is the whole point).
    this.canvas.forEachObject((o) => {
      if (isBaseObject(o)) return;
      const rec = o as unknown as Record<string, unknown>;
      if (typeof rec.id !== 'string' || !rec.id) {
        rec.id = generateObjectId();
      }
    });

    const json = this.canvas.toObject([...CAPI_CUSTOM_PROPS]) as {
      version: string;
      objects: Array<Record<string, unknown>>;
    };

    return {
      version: json.version,
      objects: json.objects,
      capi: {
        productId,
        units: 'mm',
        layers: [],
      },
    };
  }

  /**
   * Replaces user objects with the ones described in `data`. The base SVG is
   * preserved (clearUserObjects only removes non-base objects, then enliven +
   * add re-creates the user objects). Idempotent: deserialize(serialize()) is
   * a no-op visually.
   */
  async deserialize(data: SerializedCanvas): Promise<void> {
    this.clearUserObjects();
    if (!data.objects || data.objects.length === 0) {
      this.canvas.requestRenderAll();
      return;
    }

    const enlivened = await fabric.util.enlivenObjects<fabric.FabricObject>(data.objects);
    for (const obj of enlivened) {
      this.canvas.add(obj);
    }
    this.canvas.requestRenderAll();
  }

  dispose(): void {
    void this.canvas.dispose();
  }
}

export function isBaseObject(obj: fabric.FabricObject): boolean {
  return (obj as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] === true;
}

export { BASE_OBJECT_FLAG };
