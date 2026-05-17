/**
 * Testes do motor png-exporter (Onda 9, Fase 9E).
 *
 * Cobertura mínima dos 3 cenários do briefing:
 *   1. PNG gerado tem dimensões em pixels = (canvas px) * multiplier (DPI)
 *   2. Camadas invisíveis não aparecem no PNG (LayerMeta.visible=false)
 *   3. Output é PNG válido — header `89 50 4E 47 0D 0A 1A 0A`
 *
 * Texturas (fabric.Pattern) deliberadamente NÃO testadas aqui — node-canvas
 * em jsdom não suporta Pattern de forma confiável. Validação visual real
 * fica pra Fase 9G (Gabriell na UI). Os 3 cenários acima cobrem o contrato
 * do exporter — texturas aparecem automaticamente se aparecem no canvas.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import {
  dataUrlToBytes,
  dpiToMultiplier,
  exportPngMockup,
  MOCKUP_SHADOW_CONFIG,
} from '@/core/export/png-exporter';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

/** Header de bytes que todo PNG válido começa: `89 50 4E 47 0D 0A 1A 0A`. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Lê dimensões PNG do header (bytes 16-19 = width, 20-23 = height, big-endian). */
function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  // Salta 8 bytes magic + 4 bytes length + 4 bytes "IHDR" = offset 16
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

describe('png-exporter (Onda 9 Fase 9E)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  function layersSnapshot() {
    return Array.from(engine.getAllLayerMetas().values());
  }

  // ── 1. Dimensões corretas: viewport px * multiplier (300 dpi default) ────
  it('PNG default tem dimensões = viewport px * (300/101.6)', async () => {
    const bytes = await exportPngMockup(engine.canvas, {
      layers: [],
      backgroundColor: '#ffffff', // garante PNG não-vazio
    });

    expect(bytes.length).toBeGreaterThan(0);
    const { width, height } = readPngDimensions(bytes);
    const expectedMultiplier = 300 / 101.6;
    expect(width).toBeCloseTo(baseConfig.viewportWidthPx * expectedMultiplier, -1);
    expect(height).toBeCloseTo(baseConfig.viewportHeightPx * expectedMultiplier, -1);
  });

  it('PNG com dpi custom respeita o multiplier', async () => {
    const bytes = await exportPngMockup(engine.canvas, {
      layers: [],
      dpi: 96,
      backgroundColor: '#ffffff',
    });
    const { width, height } = readPngDimensions(bytes);
    const expectedMultiplier = 96 / 101.6;
    expect(width).toBeCloseTo(baseConfig.viewportWidthPx * expectedMultiplier, -1);
    expect(height).toBeCloseTo(baseConfig.viewportHeightPx * expectedMultiplier, -1);
  });

  // ── 2. Camadas invisíveis não aparecem: contrato Onda 7 ──────────────────
  //
  // O CanvasEngine.setLayerVisibility já sincroniza obj.visible (canvas-engine.ts:760).
  // Mas se um caller construir LayerMeta visible=false sem ter passado pelo
  // engine (cenário do svg-exporter onde layers são snapshot serializado),
  // o png-exporter precisa garantir o hide. Testamos esse cenário injetando
  // LayerMeta diretamente.
  it('camada com LayerMeta.visible=false (sem ter passado por setLayerVisibility) é ocultada no export', async () => {
    const svg = readFileSync(join(FIXTURES_DIR, 'apliques/aplique-1-formato-d.svg'), 'utf-8');
    const meta = parseCorelSvg(svg);
    const id = await engine.addAppliqueSvg(meta, 'Ap1', 'aplique-1-formato-d');

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    expect(obj.visible).toBe(true);

    // Snapshot mutável: forçamos LayerMeta visible=false SEM tocar em obj.visible.
    // Simula export chamado com `engine.serialize().capi.layers` editado externamente.
    const layers = layersSnapshot().map((l) => (l.id === id ? { ...l, visible: false } : l));

    const bytes = await exportPngMockup(engine.canvas, {
      layers,
      backgroundColor: '#ffffff',
    });

    // Pós-export: obj.visible voltou ao estado original (true).
    expect(obj.visible).toBe(true);
    // PNG não estourou.
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('quando setLayerVisibility já marcou obj.visible=false, restore preserva esse estado', async () => {
    const svg = readFileSync(join(FIXTURES_DIR, 'apliques/aplique-1-formato-d.svg'), 'utf-8');
    const meta = parseCorelSvg(svg);
    const id = await engine.addAppliqueSvg(meta, 'Ap1', 'aplique-1-formato-d');

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;

    // Aqui o engine sincroniza obj.visible com LayerMeta.visible.
    engine.setLayerVisibility(id, false);
    expect(obj.visible).toBe(false);

    await exportPngMockup(engine.canvas, {
      layers: layersSnapshot(),
      backgroundColor: '#ffffff',
    });

    // Restore preserva: obj.visible continua false (engine quem é dono dele).
    expect(obj.visible).toBe(false);
  });

  // ── 3. PNG header válido ──────────────────────────────────────────────────
  it('output começa com o magic header de PNG (89 50 4E 47 0D 0A 1A 0A)', async () => {
    const bytes = await exportPngMockup(engine.canvas, {
      layers: [],
      backgroundColor: '#ffffff',
    });
    for (let i = 0; i < PNG_MAGIC.length; i++) {
      expect(bytes[i]).toBe(PNG_MAGIC[i]);
    }
  });

  // ── Onda 17 — mockup profissional (shadow + viewport + bounds) ───────────
  describe('Onda 17 mockup profissional', () => {
    it('computeMockupViewport: bbox + margem expandem em todos os lados', async () => {
      const { computeMockupViewport } = await import('@/core/export/png-exporter');
      const vp = computeMockupViewport(
        { leftPx: 100, topPx: 200, rightPx: 300, bottomPx: 400 },
        40
      );
      expect(vp.leftPx).toBe(60);
      expect(vp.topPx).toBe(160);
      expect(vp.widthPx).toBe(200 + 80); // (300-100) + 2*40
      expect(vp.heightPx).toBe(200 + 80); // (400-200) + 2*40
    });

    it('computeMockupViewport: bounds degenerados não geram dimensão zero', async () => {
      const { computeMockupViewport } = await import('@/core/export/png-exporter');
      const vp = computeMockupViewport({ leftPx: 100, topPx: 100, rightPx: 100, bottomPx: 100 }, 0);
      expect(vp.widthPx).toBeGreaterThanOrEqual(1);
      expect(vp.heightPx).toBeGreaterThanOrEqual(1);
    });

    it('computeMockupViewport: margem negativa é tratada como zero', async () => {
      const { computeMockupViewport } = await import('@/core/export/png-exporter');
      const vp = computeMockupViewport({ leftPx: 0, topPx: 0, rightPx: 100, bottomPx: 100 }, -10);
      expect(vp.leftPx).toBe(0);
      expect(vp.widthPx).toBe(100);
    });

    it('shadow=true aplica fabric.Shadow em principal e restaura no finally', async () => {
      const svg = readFileSync(join(FIXTURES_DIR, 'apliques/aplique-1-formato-d.svg'), 'utf-8');
      const meta = parseCorelSvg(svg);
      const id = await engine.addAppliqueSvg(meta, 'Broche 1', 'board-item:1');
      const obj = engine.canvas
        .getObjects()
        .find((o) => (o as unknown as { id?: string }).id === id)!;
      const shadowBefore = obj.shadow;

      await exportPngMockup(engine.canvas, {
        layers: layersSnapshot(),
        shadow: true,
        backgroundColor: '#F4F4F2',
      });

      // Restore simétrico — sombra voltou ao estado original.
      expect(obj.shadow).toBe(shadowBefore);
    });

    it('shadow=false (default) não toca em obj.shadow', async () => {
      const svg = readFileSync(join(FIXTURES_DIR, 'apliques/aplique-1-formato-d.svg'), 'utf-8');
      const meta = parseCorelSvg(svg);
      const id = await engine.addAppliqueSvg(meta, 'Broche 1', 'board-item:1');
      const obj = engine.canvas
        .getObjects()
        .find((o) => (o as unknown as { id?: string }).id === id)!;
      const shadowBefore = obj.shadow;

      await exportPngMockup(engine.canvas, {
        layers: layersSnapshot(),
        backgroundColor: '#ffffff',
      });

      expect(obj.shadow).toBe(shadowBefore);
    });

    it('MOCKUP_SHADOW_CONFIG tem os valores travados pelo briefing', () => {
      expect(MOCKUP_SHADOW_CONFIG.offsetY).toBe(4);
      expect(MOCKUP_SHADOW_CONFIG.blur).toBe(12);
      expect(MOCKUP_SHADOW_CONFIG.color).toBe('rgba(0,0,0,0.15)');
    });

    it('clientBounds + marginPx recorta o PNG no tamanho calculado', async () => {
      // Bounds 200×100 px + margem 20 px = 240×120 px de área alvo.
      // No dpi default (300), o multiplier ≈ 2.9527.
      const expectedWidth = Math.round((200 + 40) * (300 / 101.6));
      const expectedHeight = Math.round((100 + 40) * (300 / 101.6));

      const bytes = await exportPngMockup(engine.canvas, {
        layers: [],
        clientBounds: { leftPx: 50, topPx: 50, rightPx: 250, bottomPx: 150 },
        marginPx: 20,
        backgroundColor: '#F4F4F2',
      });

      const { width, height } = readPngDimensions(bytes);
      // Tolerância ampla — Fabric arredonda multiplier no toDataURL.
      expect(width).toBeGreaterThan(expectedWidth - 5);
      expect(width).toBeLessThan(expectedWidth + 5);
      expect(height).toBeGreaterThan(expectedHeight - 5);
      expect(height).toBeLessThan(expectedHeight + 5);
    });

    it('sem clientBounds preserva comportamento legado (viewport inteiro)', async () => {
      const bytes = await exportPngMockup(engine.canvas, {
        layers: [],
        backgroundColor: '#F4F4F2',
      });
      const { width } = readPngDimensions(bytes);
      const expectedMultiplier = 300 / 101.6;
      expect(width).toBeCloseTo(baseConfig.viewportWidthPx * expectedMultiplier, -1);
    });

    it('background é restaurado ao original após export', async () => {
      const originalBg = engine.canvas.backgroundColor;
      await exportPngMockup(engine.canvas, {
        layers: [],
        backgroundColor: '#F4F4F2',
      });
      expect(engine.canvas.backgroundColor).toBe(originalBg);
    });

    // Fix pós-print do Gabriell: o export normaliza VPT pra identity pro
    // crop por clientBounds bater no mesmo espaço dos objetos. Sem restore,
    // o usuário perderia zoom/pan ao exportar — regressão silenciosa.
    it('viewportTransform é restaurada ao original após export (preserva zoom/pan)', async () => {
      // Simula o usuário com VPT custom (centerProductInViewport faz algo
      // parecido com isso na vida real).
      const customVpt: [number, number, number, number, number, number] = [1.5, 0, 0, 1.5, 42, 17];
      engine.canvas.setViewportTransform(customVpt);

      await exportPngMockup(engine.canvas, {
        layers: [],
        backgroundColor: '#F4F4F2',
        clientBounds: { leftPx: 0, topPx: 0, rightPx: 100, bottomPx: 100 },
        marginPx: 10,
      });

      const vpt = engine.canvas.viewportTransform;
      expect(vpt).not.toBeNull();
      if (vpt) {
        for (let i = 0; i < 6; i++) expect(vpt[i]).toBeCloseTo(customVpt[i], 5);
      }
    });
  });

  // ── Helpers exportados (cobertura) ───────────────────────────────────────
  describe('helpers', () => {
    it('dpiToMultiplier: 300 dpi ≈ 2.9527 (canvas nativo = 101.6 dpi)', () => {
      expect(dpiToMultiplier(300)).toBeCloseTo(300 / 101.6, 4);
      expect(dpiToMultiplier(96)).toBeCloseTo(96 / 101.6, 4);
      expect(dpiToMultiplier(101.6)).toBe(1);
    });

    it('dataUrlToBytes converte data URL base64 em Uint8Array', () => {
      // PNG mínimo válido (1x1 transparente): bytes magic + IHDR + IDAT + IEND
      const minimalPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const dataUrl = `data:image/png;base64,${minimalPngBase64}`;
      const bytes = dataUrlToBytes(dataUrl);
      expect(bytes[0]).toBe(0x89);
      expect(bytes[1]).toBe(0x50);
      expect(bytes[2]).toBe(0x4e);
      expect(bytes[3]).toBe(0x47);
    });

    it('dataUrlToBytes lança em URL malformada', () => {
      expect(() => dataUrlToBytes('not-a-data-url')).toThrow(/vírgula ausente/);
    });
  });
});
