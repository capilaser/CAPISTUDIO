import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine, isBaseObject, BASE_OBJECT_FLAG } from '@/core/canvas/canvas-engine';
import { mmToPx } from '@/core/canvas/units';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

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
    expect(data.capi.layers).toEqual([]);
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
});
