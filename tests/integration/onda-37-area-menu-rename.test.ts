/**
 * Onda 37 (ajuste de conceito) — "Adicionar campo" no PadraoEditor agora
 * cria Áreas inteligentes (TEXT_AREA / LOGO_AREA), não slots fixos.
 *
 * Este teste exercita o caminho exato usado por `handleAddTextArea` /
 * `handleAddLogoArea` no PadraoEditorPage (addRectangle → convertToArea),
 * pra garantir que:
 *  - O resultado é uma layer com patternRole correto.
 *  - boundsMm é preenchido (validatePattern aceita sem erro).
 *  - LOGO_AREA recebe fitMode='contain' (spec Onda 33).
 *  - O slotType antigo "profissao" NÃO aparece (removido do menu).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

describe('Onda 37 — "Adicionar campo" cria Áreas inteligentes', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('"Área de Texto" gera TEXT_AREA genérico com boundsMm preenchido', () => {
    // Mesmo cálculo de handleAddTextArea: 50% × 15% do produto, centralizado.
    const w = baseConfig.productWidthMm * 0.5;
    const h = baseConfig.productHeightMm * 0.15;
    const x = (baseConfig.productWidthMm - w) / 2;
    const y = (baseConfig.productHeightMm - h) / 2;
    const rect = engine.addRectangle(x, y, w, h);
    const id = (rect as unknown as { id: string }).id;
    const ok = engine.convertToArea(id, 'TEXT_AREA');
    expect(ok).toBe(true);

    const meta = engine.getLayerMeta(id);
    expect(meta?.patternRole).toBe('TEXT_AREA');
    expect(meta?.boundsMm).toEqual({ x, y, width: w, height: h });
  });

  it('"Área de Logo" gera LOGO_AREA com fitMode="contain"', () => {
    const w = baseConfig.productWidthMm * 0.3;
    const h = baseConfig.productHeightMm * 0.3;
    const x = (baseConfig.productWidthMm - w) / 2;
    const y = (baseConfig.productHeightMm - h) / 2;
    const rect = engine.addRectangle(x, y, w, h);
    const id = (rect as unknown as { id: string }).id;
    const ok = engine.convertToArea(id, 'LOGO_AREA');
    expect(ok).toBe(true);

    const meta = engine.getLayerMeta(id);
    expect(meta?.patternRole).toBe('LOGO_AREA');
    expect(meta?.fitMode).toBe('contain');
    expect(meta?.boundsMm?.width).toBeGreaterThan(0);
    expect(meta?.boundsMm?.height).toBeGreaterThan(0);
  });

  it('TEXT_AREA criada não é slot tradicional (slotType ausente em capiSlot direto)', () => {
    // O placeholder de AREA NÃO tem capiSlot nativo do slotManager
    // (createSlot não foi chamado). A bridge da Onda 34 injeta capiSlot
    // SOMENTE quando o pattern é aplicado num pedido. No próprio editor,
    // a layer aparece como AREA pura.
    const rect = engine.addRectangle(10, 5, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    engine.convertToArea(id, 'TEXT_AREA');

    // Como verificação prática: getSlotsByType('profissao') retorna vazio
    // depois de criar uma Área de Texto via "Adicionar campo". O slot
    // "profissao" só vem via bridge ao aplicar pattern em pedido (e mesmo
    // assim só se houver MAIS de uma TEXT_AREA).
    expect(engine.getSlotsByType('profissao')).toHaveLength(0);
  });

  it('múltiplas Áreas de Texto coexistem como layers TEXT_AREA distintas (sem slot fixo)', () => {
    const r1 = engine.addRectangle(5, 2, 20, 4);
    const id1 = (r1 as unknown as { id: string }).id;
    engine.convertToArea(id1, 'TEXT_AREA');

    const r2 = engine.addRectangle(5, 10, 20, 4);
    const id2 = (r2 as unknown as { id: string }).id;
    engine.convertToArea(id2, 'TEXT_AREA');

    const layers = Array.from(engine.getAllLayerMetas().values());
    const textAreas = layers.filter((l) => l.patternRole === 'TEXT_AREA');
    expect(textAreas).toHaveLength(2);

    // Cada uma tem bounds próprio.
    const ids = textAreas.map((l) => l.id).sort();
    expect(ids).toEqual([id1, id2].sort());
  });
});
