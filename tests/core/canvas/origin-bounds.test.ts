/**
 * Testes do PrincipalLayerMeta.originalBounds (Mini-Onda 8.6).
 *
 * Causa raiz coberta: fabric.util.groupSVGElements usa bbox dos shapes em vez
 * do viewBox declarado do SVG. Isso fazia getParentBoundsForObject retornar
 * bounds com erro de ~0.1-0.4mm dependendo da margem interna do SVG do Corel.
 *
 * Fix: PrincipalLayerMeta.originalBounds carrega bounds do viewBox SVG
 * (autoritativo, ADR 005), atualizado em drag/scale via object:modified.
 * getParentBoundsForObject prefere originalBounds quando disponível, com
 * fallback ao cálculo antigo (migração lazy pra padrões anteriores).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as fabric from 'fabric';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { isPrincipalLayer } from '@/core/canvas/layer-meta';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

describe('PrincipalLayerMeta.originalBounds (Mini-Onda 8.6)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  // ── 1. addAppliqueSvg popula originalBounds a partir do viewBox ────────────
  it('addAppliqueSvg popula originalBounds com meta.widthMm/heightMm exatos do viewBox', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const meta = parseCorelSvg(svgString);
    // viewBox declara 100.2 × 90.2mm no SVG header.
    expect(meta.widthMm).toBe(100.2);
    expect(meta.heightMm).toBe(90.2);

    const id = await engine.addAppliqueSvg(meta, 'Aplique Quadrado', 'aplique-2-quadrado');
    const layerMeta = engine.getLayerMeta(id);
    expect(layerMeta).not.toBeNull();
    expect(isPrincipalLayer(layerMeta!)).toBe(true);
    const principal = layerMeta!;
    if (!isPrincipalLayer(principal)) throw new Error('expected principal');

    expect(principal.originalBounds).toBeDefined();
    // Largura/altura vêm DIRETO de meta.widthMm/heightMm (ADR 005, viewBox).
    // Não passam pelo group.width × scaleX do Fabric (que tem erro de margem).
    expect(principal.originalBounds!.width).toBe(100.2);
    expect(principal.originalBounds!.height).toBe(90.2);
    // Posição: centro do canvas (productWidthMm - widthMm) / 2.
    expect(principal.originalBounds!.left).toBeCloseTo((300 - 100.2) / 2, 6);
    expect(principal.originalBounds!.top).toBeCloseTo((90 - 90.2) / 2, 6);
  });

  // ── 2. getParentBoundsForObject retorna originalBounds quando presente ─────
  it('getParentBoundsForObject retorna originalBounds do aplique pai (precisão exata)', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(svgString);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    // Cria slot com parentLayerId = aplique
    const slotMeta = engine.createSlot('nome', appliqueId);

    const parentBounds = engine.getParentBoundsForObject(slotMeta.id);
    expect(parentBounds).not.toBeNull();
    // Bate EXATO com originalBounds do aplique (sem erro de margem do Fabric).
    expect(parentBounds!.width).toBe(100.2);
    expect(parentBounds!.height).toBe(90.2);
    expect(parentBounds!.left).toBeCloseTo((300 - 100.2) / 2, 6);
    expect(parentBounds!.top).toBeCloseTo((90 - 90.2) / 2, 6);
  });

  // ── 3. Fallback quando originalBounds === undefined (migração lazy) ────────
  it('getParentBoundsForObject usa fallback (cálculo antigo) quando originalBounds é undefined', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(svgString);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    // Simula padrão salvo antes da Mini-Onda 8.6: limpa originalBounds.
    const allMetas = engine.getAllLayerMetas();
    const principalMeta = allMetas.get(appliqueId)!;
    delete (principalMeta as unknown as Record<string, unknown>).originalBounds;

    const slotMeta = engine.createSlot('nome', appliqueId);

    // Fallback DEVE retornar bounds (não null) e NÃO crashar.
    const parentBounds = engine.getParentBoundsForObject(slotMeta.id);
    expect(parentBounds).not.toBeNull();
    // Os valores aqui carregam o erro de margem antigo, mas devem estar
    // próximos do correto (100.2±0.5mm).
    expect(parentBounds!.width).toBeGreaterThan(99);
    expect(parentBounds!.width).toBeLessThan(101);
  });

  // ── 4. object:modified após drag atualiza left/top ──────────────────────────
  it('object:modified após drag (left/top mudados) atualiza originalBounds.left/top', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(svgString);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === appliqueId)!;
    // Simula drag: muda left/top e dispara object:modified.
    obj.set({ left: 200, top: 80 }); // 200px / 80px (= 50mm / 20mm)
    obj.setCoords();
    engine.canvas.fire('object:modified', { target: obj });

    const principal = engine.getLayerMeta(appliqueId)!;
    if (!isPrincipalLayer(principal)) throw new Error('expected principal');
    expect(principal.originalBounds!.left).toBeCloseTo(50, 3); // 200px / 4
    expect(principal.originalBounds!.top).toBeCloseTo(20, 3); // 80px / 4
    // width/height inalterados nesse cenário (drag não escala).
    // Margem do Fabric reaparece aqui (post-modify usa obj.width × scaleX),
    // mas isso é decisão de design — após interação a fonte é o Fabric.
    expect(principal.originalBounds!.width).toBeGreaterThan(99);
    expect(principal.originalBounds!.width).toBeLessThan(101);
  });

  // ── 5. object:modified após scale atualiza width/height ─────────────────────
  it('object:modified após scale atualiza originalBounds.width/height proporcionais', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(svgString);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === appliqueId)!;
    const scaleBefore = obj.scaleX ?? 1;
    const widthBefore = obj.width ?? 0;
    const widthMmBefore = (widthBefore * scaleBefore) / 4; // pxToMm

    // Dobra a escala — width deve dobrar.
    obj.set({ scaleX: scaleBefore * 2, scaleY: (obj.scaleY ?? 1) * 2 });
    obj.setCoords();
    engine.canvas.fire('object:modified', { target: obj });

    const principal = engine.getLayerMeta(appliqueId)!;
    if (!isPrincipalLayer(principal)) throw new Error('expected principal');
    // Width dobrou (com erro de margem do Fabric, mas consistente).
    expect(principal.originalBounds!.width).toBeCloseTo(widthMmBefore * 2, 3);
  });

  // ── 6. Não atualiza originalBounds em object:modified de slot ──────────────
  it('object:modified em slot (não-principal) NÃO toca em originalBounds de outros principais', async () => {
    const svgString = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(svgString);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    const principalBefore = engine.getLayerMeta(appliqueId)!;
    if (!isPrincipalLayer(principalBefore)) throw new Error('expected principal');
    const boundsBefore = { ...principalBefore.originalBounds! };

    // Cria slot e dispara object:modified pro slot (não pro aplique).
    const slotMeta = engine.createSlot('nome', appliqueId);
    const slotObj = engine.canvas.getObjects().find((o) => {
      const capi = (o as unknown as { capiSlot?: { id?: string } }).capiSlot;
      return capi?.id === slotMeta.id;
    })!;
    expect(slotObj).toBeDefined();
    engine.canvas.fire('object:modified', { target: slotObj as fabric.FabricObject });

    // originalBounds do principal segue intacto.
    const principalAfter = engine.getLayerMeta(appliqueId)!;
    if (!isPrincipalLayer(principalAfter)) throw new Error('expected principal');
    expect(principalAfter.originalBounds).toEqual(boundsBefore);
  });
});
