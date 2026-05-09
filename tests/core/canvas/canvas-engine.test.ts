import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasEngine, isBaseObject, BASE_OBJECT_FLAG } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { mmToPx } from '@/core/canvas/units';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

// ── Mock material-applier so applyMaterialToLayer works without real images ──
// buildMaterialPattern is mocked to return a real fabric.Pattern backed by a
// <canvas> element (avoids naturalWidth/naturalHeight read-only issues in jsdom).
// The mock invokes the optional `loader` argument so the engine's cachedLoader
// is exercised and cache-hit tests can verify call counts on loadImage.
vi.mock('@/core/canvas/material-applier', () => ({
  loadImage: vi.fn(
    (_url: string): Promise<HTMLImageElement> => Promise.resolve(document.createElement('img'))
  ),
  buildMaterialPattern: vi.fn(
    async (
      url: string,
      localWidth: number,
      localHeight: number,
      loader?: (u: string) => Promise<HTMLImageElement>
    ): Promise<fabric.Pattern> => {
      if (loader) await loader(url); // invoke so cachedLoader runs (cache test support)
      return new fabric.Pattern({
        source: document.createElement('canvas'),
        repeat: 'no-repeat',
        patternTransform: [localWidth / 512, 0, 0, localHeight / 256, 0, 0],
      });
    }
  ),
}));

// ── Config ────────────────────────────────────────────────────────────────────

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

describe('CanvasEngine', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
  });

  afterEach(() => {
    engine?.dispose();
  });

  it('initializes the fabric canvas at the viewport size', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    expect(engine.canvas.getWidth()).toBe(baseConfig.viewportWidthPx);
    expect(engine.canvas.getHeight()).toBe(baseConfig.viewportHeightPx);
  });

  it('centers the product origin in the viewport at zoom 1', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const vpt = engine.canvas.viewportTransform!;
    expect(vpt[0]).toBe(1);
    expect(vpt[3]).toBe(1);
    // tx = (800 - 240) / 2 = 280; ty = (500 - 100) / 2 = 200
    expect(vpt[4]).toBe(280);
    expect(vpt[5]).toBe(200);
  });

  it('addRectangle positions and sizes the object in mm × DPI', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const rect = engine.addRectangle(10, 10, 20, 10);
    expect(rect.left).toBe(mmToPx(10));
    expect(rect.top).toBe(mmToPx(10));
    expect(rect.width).toBe(mmToPx(20));
    expect(rect.height).toBe(mmToPx(10));
  });

  it('addRectangle registers a LayerMeta entry with kind=visual', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const rect = engine.addRectangle(10, 10, 20, 10);
    const id = (rect as unknown as Record<string, unknown>).id as string;
    const meta = engine.getLayerMeta(id);
    expect(meta).not.toBeNull();
    expect(meta!.kind).toBe('visual');
    expect(meta!.materialId).toBeNull();
    expect(meta!.id).toBe(id);
  });

  it('clearUserObjects removes user objects but preserves base-tagged ones', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    // Simulate a base object (loadProductSvg path) by adding a rect and tagging it.
    const fakeBase = engine.addRectangle(0, 0, 60, 25);
    (fakeBase as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;
    expect(isBaseObject(fakeBase)).toBe(true);

    engine.addRectangle(5, 5, 10, 5);
    engine.addRectangle(20, 5, 10, 5);
    expect(engine.canvas.getObjects()).toHaveLength(3);

    engine.clearUserObjects();
    const remaining = engine.canvas.getObjects();
    expect(remaining).toHaveLength(1);
    expect(isBaseObject(remaining[0])).toBe(true);
  });

  it('clearUserObjects also clears layerMeta', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const rect = engine.addRectangle(10, 10, 20, 10);
    const id = (rect as unknown as Record<string, unknown>).id as string;
    expect(engine.getLayerMeta(id)).not.toBeNull();

    engine.clearUserObjects();
    expect(engine.getLayerMeta(id)).toBeNull();
  });

  it('zoomBy multiplies and clamps zoom', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    expect(engine.canvas.getZoom()).toBe(1);

    engine.zoomBy(1.1);
    expect(engine.canvas.getZoom()).toBeCloseTo(1.1, 5);

    engine.zoomBy(1 / 1.1);
    expect(engine.canvas.getZoom()).toBeCloseTo(1, 5);

    // Push past max → clamped to 10
    for (let i = 0; i < 100; i++) engine.zoomBy(2);
    expect(engine.canvas.getZoom()).toBe(10);

    // And back below min → clamped to 0.1
    for (let i = 0; i < 100; i++) engine.zoomBy(0.5);
    expect(engine.canvas.getZoom()).toBe(0.1);
  });

  it('resetView returns viewport to centered, zoom=1', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    engine.zoomBy(2);
    expect(engine.canvas.getZoom()).not.toBe(1);

    engine.resetView();
    const vpt = engine.canvas.viewportTransform!;
    expect(engine.canvas.getZoom()).toBe(1);
    expect(vpt[4]).toBe(280);
    expect(vpt[5]).toBe(200);
  });

  it('setPanMode disables selection on user objects and restores it', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const rect = engine.addRectangle(10, 10, 20, 10);
    expect(rect.selectable).toBe(true);

    engine.setPanMode(true);
    expect(engine.canvas.selection).toBe(false);
    expect(rect.selectable).toBe(false);
    expect(rect.evented).toBe(false);

    engine.setPanMode(false);
    expect(engine.canvas.selection).toBe(true);
    expect(rect.selectable).toBe(true);
    expect(rect.evented).toBe(true);
  });

  it('serialize returns envelope with productId, mm units, and exported objects', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    engine.addRectangle(10, 10, 20, 10);
    engine.addRectangle(35, 5, 15, 8);

    const data = engine.serialize('broche-60x25');

    expect(data.capi.productId).toBe('broche-60x25');
    expect(data.capi.units).toBe('mm');
    // layers now contains LayerMeta entries — one per user object
    expect(data.capi.layers).toHaveLength(2);
    expect(data.capi.layers[0].kind).toBe('visual');
    expect(data.objects).toHaveLength(2);
    expect(typeof data.version).toBe('string');

    // Each object got a stable id assigned
    for (const o of data.objects) {
      expect(typeof o.id).toBe('string');
      expect((o.id as string).length).toBeGreaterThan(0);
    }
  });

  it('serialize is idempotent on ids — re-serializing keeps the same id', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    engine.addRectangle(10, 10, 20, 10);

    const first = engine.serialize('broche-60x25');
    const second = engine.serialize('broche-60x25');

    expect(second.objects[0].id).toBe(first.objects[0].id);
  });

  it('serialize excludes the base-tagged object', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const base = engine.addRectangle(0, 0, 60, 25);
    (base as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;
    base.excludeFromExport = true;
    engine.addRectangle(10, 10, 20, 10);

    const data = engine.serialize('broche-60x25');
    expect(data.objects).toHaveLength(1);
  });

  it('round-trips: deserialize(serialize()) preserves position, size, rotation', async () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const rect = engine.addRectangle(15, 7, 22, 11);
    rect.set({ angle: 23, scaleX: 1.4, scaleY: 0.9 });
    engine.canvas.requestRenderAll();

    const snapshot = engine.serialize('broche-60x25');
    const originalLeft = rect.left;
    const originalTop = rect.top;
    const originalWidth = rect.width;
    const originalHeight = rect.height;

    await engine.deserialize(snapshot);

    const objects = engine.canvas.getObjects().filter((o) => !isBaseObject(o));
    expect(objects).toHaveLength(1);
    const restored = objects[0] as fabric.Rect;
    expect(restored.left).toBeCloseTo(originalLeft, 5);
    expect(restored.top).toBeCloseTo(originalTop, 5);
    expect(restored.width).toBeCloseTo(originalWidth, 5);
    expect(restored.height).toBeCloseTo(originalHeight, 5);
    expect(restored.angle).toBeCloseTo(23, 5);
    expect(restored.scaleX).toBeCloseTo(1.4, 5);
    expect(restored.scaleY).toBeCloseTo(0.9, 5);
  });

  it('deserialize with empty objects clears user content but keeps base', async () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const fakeBase = engine.addRectangle(0, 0, 60, 25);
    (fakeBase as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;
    engine.addRectangle(10, 10, 20, 10);

    await engine.deserialize({
      version: 'test',
      objects: [],
      capi: { productId: 'broche-60x25', units: 'mm', layers: [] },
    });

    const remaining = engine.canvas.getObjects();
    expect(remaining).toHaveLength(1);
    expect(isBaseObject(remaining[0])).toBe(true);
  });

  it('setPanMode does not toggle base-tagged objects', () => {
    engine = new CanvasEngine(canvasEl, baseConfig);
    const fakeBase = engine.addRectangle(0, 0, 60, 25);
    (fakeBase as unknown as Record<string, unknown>)[BASE_OBJECT_FLAG] = true;
    fakeBase.selectable = false; // simulate locked base
    fakeBase.evented = false;

    engine.setPanMode(true);
    engine.setPanMode(false);
    // Still locked — pan toggle never re-enabled the base
    expect(fakeBase.selectable).toBe(false);
    expect(fakeBase.evented).toBe(false);
  });

  // ─── Material round-trip ─────────────────────────────────────────────────

  describe('material round-trip', () => {
    it('applyMaterialToLayer sets Pattern fill on the object', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');

      expect(rect.fill).toBeInstanceOf(fabric.Pattern);
    });

    it('applyMaterialToLayer updates materialId in layerMeta', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');

      expect(engine.getLayerMeta(id)!.materialId).toBe('abs-escovado-prata');
    });

    it('strips Pattern fill on serialize — no Tauri URL baked into JSON', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');
      expect(rect.fill).toBeInstanceOf(fabric.Pattern); // Pattern is live before serialize

      const json = engine.serialize('broche-60x25');

      // The serialized object fill must NOT be a pattern (URL stripped)
      const serializedFill = json.objects[0]?.fill;
      expect(serializedFill).not.toBeInstanceOf(fabric.Pattern);
      // It should be the transparent sentinel string
      expect(typeof serializedFill === 'string' || serializedFill === 'transparent').toBeTruthy();

      // But materialId is preserved in capi.layers
      expect(json.capi.layers[0].materialId).toBe('abs-escovado-prata');
    });

    it('restores Pattern fill after serialize (live canvas not permanently mutated)', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');
      engine.serialize('broche-60x25'); // strip + restore

      // After serialize, the live canvas object must have its Pattern back
      expect(rect.fill).toBeInstanceOf(fabric.Pattern);
    });

    it('deserialize re-applies Pattern via resolveUrl callback', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');
      const snapshot = engine.serialize('broche-60x25');

      // snapshot.objects[0].fill is 'transparent' (stripped)
      // deserialize must re-apply using the resolveUrl callback
      const resolveUrl = vi.fn(async (_matId: string) => 'http://asset.localhost/restored.png');
      await engine.deserialize(snapshot, resolveUrl);

      expect(resolveUrl).toHaveBeenCalledWith('abs-escovado-prata');

      // The restored object on canvas must have a Pattern fill
      const objs = engine.canvas.getObjects().filter((o) => !isBaseObject(o));
      expect(objs).toHaveLength(1);
      expect(objs[0].fill).toBeInstanceOf(fabric.Pattern);
    });

    it('deserialize restores materialId in layerMeta from capi.layers', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');
      const snapshot = engine.serialize('broche-60x25');

      await engine.deserialize(snapshot);

      // Even without resolveUrl, layerMeta should have the materialId restored
      const restored = engine.getLayerMeta(id);
      expect(restored?.materialId).toBe('abs-escovado-prata');
    });

    it('removeMaterialFromLayer clears Pattern and sets materialId=null', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');
      expect(rect.fill).toBeInstanceOf(fabric.Pattern);

      engine.removeMaterialFromLayer(id);
      expect(rect.fill).not.toBeInstanceOf(fabric.Pattern);
      expect(engine.getLayerMeta(id)!.materialId).toBeNull();
    });
  });

  // ─── Image cache (C.2) ───────────────────────────────────────────────────

  describe('materialImageCache', () => {
    it('calls loadImage only once for the same materialId across two layers', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const r1 = engine.addRectangle(5, 5, 20, 10);
      const r2 = engine.addRectangle(5, 15, 20, 10);
      const id1 = (r1 as unknown as Record<string, unknown>).id as string;
      const id2 = (r2 as unknown as Record<string, unknown>).id as string;

      const { loadImage: mockLoad } = await import('@/core/canvas/material-applier');
      vi.mocked(mockLoad).mockClear();

      await engine.applyMaterialToLayer(id1, 'mat-A', 'http://x/a.png');
      await engine.applyMaterialToLayer(id2, 'mat-A', 'http://x/a.png');

      expect(vi.mocked(mockLoad)).toHaveBeenCalledTimes(1);
    });

    it('calls loadImage for a different materialId (separate cache slot)', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const r1 = engine.addRectangle(5, 5, 20, 10);
      const r2 = engine.addRectangle(5, 15, 20, 10);
      const id1 = (r1 as unknown as Record<string, unknown>).id as string;
      const id2 = (r2 as unknown as Record<string, unknown>).id as string;

      const { loadImage: mockLoad } = await import('@/core/canvas/material-applier');
      vi.mocked(mockLoad).mockClear();

      await engine.applyMaterialToLayer(id1, 'mat-A', 'http://x/a.png');
      await engine.applyMaterialToLayer(id2, 'mat-B', 'http://x/b.png');

      expect(vi.mocked(mockLoad)).toHaveBeenCalledTimes(2);
    });

    it('clearMaterialCache forces loadImage to be called again', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const r1 = engine.addRectangle(5, 5, 20, 10);
      const r2 = engine.addRectangle(5, 15, 20, 10);
      const id1 = (r1 as unknown as Record<string, unknown>).id as string;
      const id2 = (r2 as unknown as Record<string, unknown>).id as string;

      const { loadImage: mockLoad } = await import('@/core/canvas/material-applier');
      vi.mocked(mockLoad).mockClear();

      await engine.applyMaterialToLayer(id1, 'mat-A', 'http://x/a.png');
      engine.clearMaterialCache();
      await engine.applyMaterialToLayer(id2, 'mat-A', 'http://x/a.png');

      expect(vi.mocked(mockLoad)).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Product clip path (C.3, Cenário 1) ─────────────────────────────────

  describe('applyProductClipToObject (Checkpoint C)', () => {
    const svgWithRect =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25">' +
      '<rect x="0" y="0" width="60" height="25"/>' +
      '</svg>';

    it('does not apply clipPath when no product SVG is loaded', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'mat-x', 'http://x/a.png');

      // No product loaded → no clip
      expect(rect.clipPath).toBeUndefined();
    });

    it('applies a fabric.Path clipPath when product SVG with shapes is loaded', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      await engine.loadProductSvg(svgWithRect, { minX: 0, minY: 0, width: 60, height: 25 });

      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'mat-x', 'http://x/a.png');

      expect(rect.clipPath).toBeDefined();
      expect(rect.clipPath).toBeInstanceOf(fabric.Path);
    });

    it('clipPath has absolutePositioned: true', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      await engine.loadProductSvg(svgWithRect, { minX: 0, minY: 0, width: 60, height: 25 });

      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'mat-x', 'http://x/a.png');

      expect((rect.clipPath as fabric.Path).absolutePositioned).toBe(true);
    });

    it('clipPath scaleX = mmToPx(productWidthMm) / viewBox.width', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      await engine.loadProductSvg(svgWithRect, { minX: 0, minY: 0, width: 60, height: 25 });

      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'mat-x', 'http://x/a.png');

      const cp = rect.clipPath as fabric.Path;
      // productWidthMm=60, viewBox.width=60 → sx = mmToPx(60) / 60 = 4
      expect(cp.scaleX).toBeCloseTo(mmToPx(baseConfig.productWidthMm) / 60, 5);
      expect(cp.scaleY).toBeCloseTo(mmToPx(baseConfig.productHeightMm) / 25, 5);
    });

    it('removeMaterialFromLayer clears clipPath', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);
      await engine.loadProductSvg(svgWithRect, { minX: 0, minY: 0, width: 60, height: 25 });

      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;

      await engine.applyMaterialToLayer(id, 'mat-x', 'http://x/a.png');
      expect(rect.clipPath).toBeDefined();

      engine.removeMaterialFromLayer(id);
      expect(rect.clipPath).toBeUndefined();
    });
  });

  // ─── serialize() invariant ────────────────────────────────────────────────

  describe('serialize() state invariant', () => {
    it('does not mutate canvas state — fill and clipPath survive serialize()', async () => {
      engine = new CanvasEngine(canvasEl, baseConfig);

      const svgWithRect =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 25">' +
        '<rect x="0" y="0" width="60" height="25"/>' +
        '</svg>';
      await engine.loadProductSvg(svgWithRect, { minX: 0, minY: 0, width: 60, height: 25 });

      const rect = engine.addRectangle(10, 10, 20, 10);
      const id = (rect as unknown as Record<string, unknown>).id as string;
      await engine.applyMaterialToLayer(id, 'abs-escovado-prata', 'http://asset.localhost/mat.png');

      // Capture live state before serialize
      const fillBefore = rect.fill;
      const clipPathBefore = rect.clipPath;
      expect(fillBefore).toBeInstanceOf(fabric.Pattern);
      expect(clipPathBefore).toBeDefined();

      const json = engine.serialize('broche-60x25');

      // Live canvas must be UNCHANGED after serialize (symmetric restore)
      expect(rect.fill).toBe(fillBefore);
      expect(rect.clipPath).toBe(clipPathBefore);

      // JSON must NOT contain a baked Pattern fill
      const serializedFill = json.objects[0]?.fill;
      expect(serializedFill).not.toBeInstanceOf(fabric.Pattern);

      // JSON must NOT contain a baked clipPath (null/undefined/absent)
      const serializedClipPath = (json.objects[0] as Record<string, unknown>)?.clipPath;
      expect(serializedClipPath == null).toBe(true);

      // materialId still preserved in capi.layers
      expect(json.capi.layers[0].materialId).toBe('abs-escovado-prata');
    });
  });

  // ─── loadProductSvgFromMeta — fill regression guard ──────────────────────
  // Regression: cleanCorelSvg (Fase B) strips fill from all SVG elements.
  // Without step 9 (inject fill="none"), Fabric 6 defaults paths to black.
  // This test ensures shapes parsed by loadProductSvgFromMeta have fill='none'.

  describe('loadProductSvgFromMeta', () => {
    it('base group children têm fill "none" (ADR 010 §3 regression guard)', async () => {
      const svgString = readFileSync(
        join(FIXTURES_DIR, 'camadas-base', 'broche-simples.svg'),
        'utf-8'
      );
      const meta = parseCorelSvg(svgString);

      engine = new CanvasEngine(canvasEl, {
        productWidthMm: meta.widthMm,
        productHeightMm: meta.heightMm,
        viewportWidthPx: 800,
        viewportHeightPx: 500,
      });
      await engine.loadProductSvgFromMeta(meta);

      // The base group is the only object on a fresh canvas.
      const baseObj = engine.canvas.getObjects().find((o) => isBaseObject(o));
      expect(baseObj).toBeDefined();

      // Fabric 6 groupSVGElements behaviour:
      //   - multi-path SVG  → returns a fabric.Group; children accessed via getObjects()
      //   - single-path SVG → returns the element directly (no Group wrapper)
      // broche-simples.svg has 1 path, so baseObj IS the path.
      // fill must be '' (empty string) — NOT 'none'.
      // Canvas2D does not recognise 'none' as a valid fillStyle and falls back to black.
      // Fabric's sentinel for "no fill" is the empty string ''.
      if (typeof (baseObj as fabric.Group).getObjects === 'function') {
        const children = (baseObj as fabric.Group).getObjects();
        expect(children.length).toBeGreaterThan(0);
        for (const child of children) {
          expect(child.fill).toBe('');
        }
      } else {
        // Single-element result: the base object itself is the path.
        expect(baseObj!.fill).toBe('');
      }
    });
  });
});
