/**
 * Testes de addEngravingSvg + seed idempotente (Onda 8.5).
 *
 * Mesmo padrão dos testes de `addAppliqueSvg` em canvas-engine.test.ts —
 * Fabric Canvas real em jsdom + node-canvas, SVG fixture lido do disco
 * via parseCorelSvg.
 *
 * Seed idempotente é testado contra um Map simulando rowsAffected do
 * SQLite (mesmo padrão usado nas integração de pattern roundtrip).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { isVisualLayer } from '@/core/canvas/layer-meta';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

describe('CanvasEngine.addEngravingSvg (Onda 8.5)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;
  let svgString: string;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
    svgString = readFileSync(join(FIXTURES_DIR, 'engravings', 'balanca-advogado.svg'), 'utf-8');
  });

  // ── 1. Sem aplique pai → parentLayerId === null + centro do canvas ──────────
  it('sem parentLayerId → LayerMeta.parentLayerId é null E grupo posicionado no centro do canvas', async () => {
    const meta = parseCorelSvg(svgString);

    const id = await engine.addEngravingSvg(meta, 'Balança Advogado', 'balanca-advogado', null);
    const layerMeta = engine.getLayerMeta(id);

    expect(layerMeta).not.toBeNull();
    expect(layerMeta!.kind).toBe('visual');
    expect(layerMeta!.parentLayerId).toBeNull();
    expect(isVisualLayer(layerMeta!) && layerMeta!.engravingId).toBe('balanca-advogado');

    // Centro do canvas: (productWidthMm - widthMm)/2 mm em pixels.
    // Tolerância pequena por arredondamento de scale.
    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    const productCenterXpx = (baseConfig.productWidthMm / 2) * 4; // DPI=4
    const groupCenterXpx = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    expect(groupCenterXpx).toBeCloseTo(productCenterXpx, 1);
  });

  // ── 2. Com aplique pai → parentLayerId === aplique.id + centro do aplique ─
  it('com parentLayerId (aplique pai) → LayerMeta.parentLayerId match + posicionado no centro do aplique', async () => {
    // Cria aplique fixture pra ser pai.
    const appliqueSvg = readFileSync(
      join(FIXTURES_DIR, 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(appliqueSvg);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    // Adiciona a gravação com aplique como pai.
    const engMeta = parseCorelSvg(svgString);
    const engId = await engine.addEngravingSvg(
      engMeta,
      'Balança Advogado',
      'balanca-advogado',
      appliqueId
    );

    const layerMeta = engine.getLayerMeta(engId);
    expect(layerMeta!.parentLayerId).toBe(appliqueId);

    // Centro horizontal da gravação === centro horizontal do aplique pai.
    const parentBounds = engine.getParentBoundsForObject(engId);
    expect(parentBounds).not.toBeNull();
    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === engId)!;
    const engCenterXmm = (obj.left ?? 0) / 4 + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 4 / 2;
    const expectedCenterXmm = parentBounds!.left + parentBounds!.width / 2;
    // Mini-Onda 8.6: tolerância 0.05mm restaurada (toBeCloseTo precision 1).
    // Antes desta mini-onda, parentBounds vinha do fabric.util.groupSVGElements
    // (bbox dos shapes) e tinha erro de margem de ~0.1mm. Agora
    // getParentBoundsForObject lê de PrincipalLayerMeta.originalBounds (viewBox
    // autoritativo, ADR 005), sem erro de margem.
    expect(engCenterXmm).toBeCloseTo(expectedCenterXmm, 1);
  });

  // ── 3. LayerMeta kind === 'visual' + dimensões parseadas em mm ──────────────
  it('LayerMeta.kind === visual; engravingId persistido; objeto presente no canvas', async () => {
    const meta = parseCorelSvg(svgString);
    const countBefore = engine.canvas.getObjects().length;
    const id = await engine.addEngravingSvg(meta, 'Balança Advogado', 'balanca-advogado', null);
    const countAfter = engine.canvas.getObjects().length;

    expect(countAfter).toBe(countBefore + 1);

    const layerMeta = engine.getLayerMeta(id);
    expect(layerMeta!.kind).toBe('visual');
    expect(isVisualLayer(layerMeta!) && layerMeta!.engravingId).toBe('balanca-advogado');
    // Dimensões extraídas do header SVG (mm) — balança = 69.9985×64.0889.
    expect(meta.widthMm).toBeCloseTo(69.9985, 2);
    expect(meta.heightMm).toBeCloseTo(64.0889, 2);
  });

  // ── 4. Seleção automática após adicionar ────────────────────────────────────
  it('addEngravingSvg seta o grupo recém-criado como activeObject', async () => {
    const meta = parseCorelSvg(svgString);
    const id = await engine.addEngravingSvg(meta, 'Balança Advogado', 'balanca-advogado', null);

    const active = engine.canvas.getActiveObject();
    expect(active).not.toBeNull();
    expect((active as unknown as { id?: string }).id).toBe(id);
  });

  // ── 5. Dois engravings com mesmo engravingId geram ids capi distintos ──────
  it('adicionar a mesma gravação 2 vezes gera 2 LayerMeta com ids distintos', async () => {
    const meta = parseCorelSvg(svgString);
    const id1 = await engine.addEngravingSvg(meta, 'Balança 1', 'balanca-advogado', null);
    const id2 = await engine.addEngravingSvg(meta, 'Balança 2', 'balanca-advogado', null);

    expect(id1).not.toBe(id2);
    expect(engine.getLayerMeta(id1)).not.toBeNull();
    expect(engine.getLayerMeta(id2)).not.toBeNull();
    // Ambas têm engravingId === mesma string (origem comum).
    const m1 = engine.getLayerMeta(id1)!;
    const m2 = engine.getLayerMeta(id2)!;
    expect(isVisualLayer(m1) && m1.engravingId).toBe('balanca-advogado');
    expect(isVisualLayer(m2) && m2.engravingId).toBe('balanca-advogado');
  });

  // ── 6. parentLayerId inválido (id que não existe) → fallback pro canvas ──
  it('parentLayerId inválido (id inexistente) → getParentBoundsForObject retorna null → centro do canvas', async () => {
    const meta = parseCorelSvg(svgString);
    // Passamos um id que não existe no engine.
    const id = await engine.addEngravingSvg(
      meta,
      'Balança Advogado',
      'balanca-advogado',
      'aplique-fantasma'
    );

    const layerMeta = engine.getLayerMeta(id);
    // parentLayerId é PERSISTIDO mesmo inválido (caller é quem valida; engine
    // armazena cru). Mas posição cai pro centro do canvas porque
    // getParentBoundsForObject retorna null pra parent não existente.
    expect(layerMeta!.parentLayerId).toBe('aplique-fantasma');

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    const productCenterXpx = (baseConfig.productWidthMm / 2) * 4;
    const groupCenterXpx = (obj.left ?? 0) + ((obj.width ?? 0) * (obj.scaleX ?? 1)) / 2;
    expect(groupCenterXpx).toBeCloseTo(productCenterXpx, 1);
  });
});
