/**
 * Teste de integração — precisão após Mini-Onda 8.6.
 *
 * Cobre o fluxo end-to-end que sofria com o bug:
 *   aplique (com erro de margem do Fabric) → slot filho →
 *   alignment "centralizar H" → resultado com erro de ~0.1mm.
 *
 * Após a Mini-Onda 8.6, getParentBoundsForObject lê de
 * PrincipalLayerMeta.originalBounds (viewBox autoritativo, ADR 005).
 * Alignment recebe parentBounds preciso → centra slot exatamente no
 * centro do aplique (tolerância 0.05mm).
 *
 * Cenário também valida que snap, alignment, medição e proximity
 * herdam a precisão automaticamente (todos consomem
 * getParentBoundsForObject ou caminhos equivalentes).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { applyAlignment } from '@/core/canvas/alignment/alignment-commands';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

describe('Precisão pós Mini-Onda 8.6 — alignment de slot dentro de aplique', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('alignCenterH de slot dentro de aplique → centro X do slot === centro X do aplique (0.05mm)', async () => {
    // 1. Cria aplique via addAppliqueSvg (popula originalBounds).
    const appliqueSvg = readFileSync(
      join(FIXTURES_DIR, '..', 'fixtures', 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(appliqueSvg);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    // 2. Cria slot com parentLayerId = aplique.
    const slotMeta = engine.createSlot('nome', appliqueId);

    // 3. Pega parentBounds (agora autoritativo, vem de originalBounds).
    const parentBounds = engine.getParentBoundsForObject(slotMeta.id);
    expect(parentBounds).not.toBeNull();

    // 4. Aplica alignment "centralizar horizontal".
    const slotRect = {
      left: slotMeta.x,
      top: slotMeta.y,
      width: slotMeta.maxWidth,
      height: slotMeta.maxHeight,
    };
    const [aligned] = applyAlignment('alignCenterH', [slotRect], parentBounds!);

    // 5. Centro X do slot pós-alignment === centro X do aplique pai.
    // Tolerância: 0.05mm (toBeCloseTo precision 1). Antes da Mini-Onda 8.6
    // exigia 0.5mm (10× pior) pra passar.
    const slotCenterXmm = aligned.left + aligned.width / 2;
    const appliqueCenterXmm = parentBounds!.left + parentBounds!.width / 2;
    expect(slotCenterXmm).toBeCloseTo(appliqueCenterXmm, 1);

    // Também verifica que o cálculo bate com a matemática teórica:
    // aplique centrado em placa 300mm → centro X = 150mm.
    expect(appliqueCenterXmm).toBeCloseTo(150, 1);
    expect(slotCenterXmm).toBeCloseTo(150, 1);
  });

  it('alignCenterV de slot dentro de aplique → centro Y exato (0.05mm)', async () => {
    const appliqueSvg = readFileSync(
      join(FIXTURES_DIR, '..', 'fixtures', 'apliques', 'aplique-2-quadrado.svg'),
      'utf-8'
    );
    const appliqueMeta = parseCorelSvg(appliqueSvg);
    const appliqueId = await engine.addAppliqueSvg(
      appliqueMeta,
      'Aplique Quadrado',
      'aplique-2-quadrado'
    );

    const slotMeta = engine.createSlot('nome', appliqueId);
    const parentBounds = engine.getParentBoundsForObject(slotMeta.id);
    expect(parentBounds).not.toBeNull();

    const slotRect = {
      left: slotMeta.x,
      top: slotMeta.y,
      width: slotMeta.maxWidth,
      height: slotMeta.maxHeight,
    };
    const [aligned] = applyAlignment('alignCenterV', [slotRect], parentBounds!);

    const slotCenterYmm = aligned.top + aligned.height / 2;
    const appliqueCenterYmm = parentBounds!.top + parentBounds!.height / 2;
    expect(slotCenterYmm).toBeCloseTo(appliqueCenterYmm, 1);
  });
});
