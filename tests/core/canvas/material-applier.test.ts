/**
 * Tests for material-applier.ts — Onda 5, Checkpoint B
 *
 * buildMaterialPattern accepts an optional `loader` parameter so tests can
 * inject a mock image without module-level mocking or real network requests.
 *
 * Checkpoint C clipping (applyPathClip / buildClippedMaterialPattern) was
 * removed in favour of fabric.clipPath + absolutePositioned in canvas-engine.ts
 * (Cenário 1, ADR 008). Clip tests now live in canvas-engine.test.ts.
 */
import * as fabric from 'fabric';
import { describe, expect, it, vi } from 'vitest';

import { buildMaterialPattern, loadImage } from '@/core/canvas/material-applier';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a fake HTMLImageElement with controlled naturalWidth/naturalHeight. */
function fakeImg(naturalWidth = 512, naturalHeight = 256): HTMLImageElement {
  const img = document.createElement('img');
  Object.defineProperty(img, 'naturalWidth', { value: naturalWidth, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: naturalHeight, configurable: true });
  return img;
}

const mockLoader = vi.fn((_url: string) => Promise.resolve(fakeImg(512, 256)));

// ── loadImage export ──────────────────────────────────────────────────────────

describe('loadImage', () => {
  it('is exported (required for external mocking in canvas-engine tests)', () => {
    expect(typeof loadImage).toBe('function');
  });

  // Onda 9.G — protege contra regressão do tainted-canvas no PNG export.
  //
  // O fix da Onda 9.G adiciona `crossOrigin = 'anonymous'` ANTES de `src = url`.
  // Sem isso, o browser carrega no-cors e ignora o header Access-Control-Allow-Origin
  // que o Tauri 2 envia automaticamente no asset protocol — a textura entra como
  // tainted no canvas e `canvas.toDataURL()` (Fase 9E) lança SecurityError.
  //
  // jsdom não implementa CORS de verdade — o teste protege apenas a INTENÇÃO
  // (atributo presente, ordem correta), não o comportamento real. Validação
  // visual no WebView Tauri é o teste real.
  it('seta crossOrigin=anonymous ANTES de src (proteção contra tainted canvas)', async () => {
    const writes: Array<{ prop: string; value: string }> = [];
    const fakeImg = new Proxy(
      { onload: null as null | (() => void), onerror: null },
      {
        set(target, prop, value) {
          writes.push({ prop: String(prop), value: String(value) });
          (target as Record<string, unknown>)[String(prop)] = value;
          // Dispara o handler de sucesso assim que o consumer setar src.
          if (prop === 'src' && (target as { onload?: () => void }).onload) {
            queueMicrotask(() => (target as { onload?: () => void }).onload?.());
          }
          return true;
        },
      }
    );

    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'img') return fakeImg as unknown as HTMLImageElement;
      return document.createDocumentFragment() as unknown as HTMLElement;
    }) as typeof document.createElement);

    try {
      await loadImage('http://asset.localhost/test.png');

      const crossOriginIdx = writes.findIndex((w) => w.prop === 'crossOrigin');
      const srcIdx = writes.findIndex((w) => w.prop === 'src');

      // 1. crossOrigin foi setado.
      expect(crossOriginIdx).toBeGreaterThanOrEqual(0);
      expect(writes[crossOriginIdx].value).toBe('anonymous');
      // 2. crossOrigin foi setado ANTES de src (regra do browser).
      expect(srcIdx).toBeGreaterThan(crossOriginIdx);
    } finally {
      createSpy.mockRestore();
    }
  });
});

// ── buildMaterialPattern ──────────────────────────────────────────────────────

describe('buildMaterialPattern', () => {
  it('calls the loader with the provided URL', async () => {
    await buildMaterialPattern('http://asset.localhost/mat.png', 240, 100, mockLoader);
    expect(mockLoader).toHaveBeenCalledWith('http://asset.localhost/mat.png');
  });

  it('returns a fabric.Pattern', async () => {
    const pattern = await buildMaterialPattern(
      'http://asset.localhost/mat.png',
      240,
      100,
      mockLoader
    );
    expect(pattern).toBeInstanceOf(fabric.Pattern);
  });

  it('sets repeat to no-repeat', async () => {
    const pattern = await buildMaterialPattern(
      'http://asset.localhost/mat.png',
      240,
      100,
      mockLoader
    );
    expect((pattern as fabric.Pattern).repeat).toBe('no-repeat');
  });

  it('computes patternTransform to cover localWidth × localHeight', async () => {
    // Loader returns 512×256. Object: 240×100 local units.
    // Expected scaleX = 240/512 ≈ 0.46875, scaleY = 100/256 ≈ 0.390625
    const pattern = await buildMaterialPattern(
      'http://asset.localhost/mat.png',
      240,
      100,
      mockLoader
    );
    const transform = (pattern as fabric.Pattern).patternTransform as number[];
    expect(transform).toBeDefined();
    expect(transform[0]).toBeCloseTo(240 / 512, 5); // scaleX
    expect(transform[3]).toBeCloseTo(100 / 256, 5); // scaleY
    expect(transform[1]).toBe(0);
    expect(transform[2]).toBe(0);
    expect(transform[4]).toBe(0);
    expect(transform[5]).toBe(0);
  });

  it('scales differently for different object dimensions', async () => {
    const patSmall = await buildMaterialPattern(
      'http://asset.localhost/mat.png',
      60,
      25,
      mockLoader
    );
    const patLarge = await buildMaterialPattern(
      'http://asset.localhost/mat.png',
      480,
      200,
      mockLoader
    );
    const tSmall = (patSmall as fabric.Pattern).patternTransform as number[];
    const tLarge = (patLarge as fabric.Pattern).patternTransform as number[];
    expect(tSmall[0]).toBeLessThan(tLarge[0]);
    expect(tSmall[3]).toBeLessThan(tLarge[3]);
  });

  it('uses different patternTransform for different natural image sizes', async () => {
    const smallLoader = vi.fn(() => Promise.resolve(fakeImg(128, 128)));
    const largeLoader = vi.fn(() => Promise.resolve(fakeImg(1024, 1024)));
    const pSmall = await buildMaterialPattern('url', 240, 100, smallLoader);
    const pLarge = await buildMaterialPattern('url', 240, 100, largeLoader);
    const tSmall = (pSmall as fabric.Pattern).patternTransform as number[];
    const tLarge = (pLarge as fabric.Pattern).patternTransform as number[];
    // Smaller source image → larger scale to fill same object
    expect(tSmall[0]).toBeGreaterThan(tLarge[0]);
  });
});
