/**
 * Onda 37 — integração end-to-end dos polimentos de UX para AREA editing.
 *
 *  - Fix-1: `labelFromPatternRole` produz label correto pra cada role
 *           (helper exportado pela página, testado isoladamente).
 *  - Fix-3: `getLayersHierarchy` carrega campos opcionais Onda 33
 *           (patternRole/processType/machineTargets/boundsMm/lockGranular)
 *           pro LayerRow ler sem chamar getLayerMeta por linha.
 *
 * Usa CanvasEngine real em jsdom + node-canvas (mesmo padrão das ondas
 * anteriores).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { labelFromPatternRole } from '@/ui/pages/padroes/label-from-pattern-role';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

// ── Fix-1: labelFromPatternRole ─────────────────────────────────────────────

describe('Onda 37 Fix-1 — labelFromPatternRole', () => {
  it('PRODUCT → "Produto"', () => {
    expect(labelFromPatternRole('PRODUCT')).toBe('Produto');
  });
  it('APPLIQUE → "Aplique"', () => {
    expect(labelFromPatternRole('APPLIQUE')).toBe('Aplique');
  });
  it('CONTOUR → "Contorno"', () => {
    expect(labelFromPatternRole('CONTOUR')).toBe('Contorno');
  });
  it('TEXT_AREA → "Área · Texto"', () => {
    expect(labelFromPatternRole('TEXT_AREA')).toBe('Área · Texto');
  });
  it('LOGO_AREA → "Área · Logo"', () => {
    expect(labelFromPatternRole('LOGO_AREA')).toBe('Área · Logo');
  });
  it('undefined → fallback "Forma"', () => {
    expect(labelFromPatternRole(undefined)).toBe('Forma');
  });
});

// ── Fix-3: LayerNode carrega campos Onda 33 ─────────────────────────────────

describe('Onda 37 Fix-3 — getLayersHierarchy carrega LayerNodeClassification', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('layer classificada (APPLIQUE + corte + M1) aparece com campos no hierarchy', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    const hierarchy = engine.getLayersHierarchy();
    // Layer foi top-level visual (sem aplique pai).
    const node = hierarchy.find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node!.patternRole).toBe('APPLIQUE');
    expect(node!.processType).toBe('corte');
    expect(node!.machineTargets).toEqual(['M1']);
  });

  it('layer não-classificada aparece sem patternRole no hierarchy (retrocompat)', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;

    const hierarchy = engine.getLayersHierarchy();
    const node = hierarchy.find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node!.patternRole).toBeUndefined();
    expect(node!.processType).toBeUndefined();
    expect(node!.machineTargets).toBeUndefined();
  });

  it('TEXT_AREA convertida via convertToArea expõe boundsMm no hierarchy', () => {
    const rect = engine.addRectangle(8, 6, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    engine.setProcessRouting(id, 'gravacao', ['M2']);
    const ok = engine.convertToArea(id, 'TEXT_AREA');
    expect(ok).toBe(true);

    const hierarchy = engine.getLayersHierarchy();
    const node = hierarchy.find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node!.patternRole).toBe('TEXT_AREA');
    expect(node!.boundsMm).toEqual({ x: 8, y: 6, width: 30, height: 8 });
    expect(node!.processType).toBe('gravacao');
    expect(node!.machineTargets).toEqual(['M2']);
  });

  it('locks granular setados aparecem no hierarchy', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'CONTOUR');
    engine.setLayerLocks(id, { position: true, scale: true });

    const hierarchy = engine.getLayersHierarchy();
    const node = hierarchy.find((n) => n.id === id);
    expect(node).toBeDefined();
    expect(node!.lockGranular).toMatchObject({ position: true, scale: true });
  });
});
