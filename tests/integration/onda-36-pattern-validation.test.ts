/**
 * Onda 36 — Pattern Validation integração end-to-end.
 *
 * Roda o validator contra LayerMeta produzido pelo CanvasEngine real,
 * cobrindo os 3 caminhos críticos:
 *   1. patternRole sem processType/machineTargets → errors.
 *   2. convertToArea preenche boundsMm corretamente → validator passa para
 *      esse aspecto (mas ainda falta processType até setProcessRouting rodar).
 *   3. Layer completa → 0 issues.
 *
 * Usa CanvasEngine real em jsdom + node-canvas, mesmo padrão das ondas
 * anteriores.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { validatePattern, type PatternIssueCode } from '@/core/patterns/validate-pattern';

const baseConfig = {
  productWidthMm: 60,
  productHeightMm: 25,
  viewportWidthPx: 800,
  viewportHeightPx: 500,
};

function codesOf(items: { code: PatternIssueCode }[]): PatternIssueCode[] {
  return items.map((i) => i.code);
}

describe('Onda 36 — Pattern Validation (integração com CanvasEngine)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  it('layer com patternRole sem processType/machineTargets gera erros bloqueantes', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');

    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors, warnings } = validatePattern(layers, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });

    expect(codesOf(errors)).toEqual(
      expect.arrayContaining(['MISSING_PROCESS_TYPE', 'MISSING_MACHINE_TARGETS'])
    );
    // Warnings: nenhum (vetor existe).
    expect(warnings).toEqual([]);
  });

  it('convertToArea preenche boundsMm — validator não reclama de bounds, mas ainda exige processType', () => {
    const rect = engine.addRectangle(8, 6, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    const ok = engine.convertToArea(id, 'TEXT_AREA');
    expect(ok).toBe(true);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors } = validatePattern(layers);

    // boundsMm está OK (convertToArea preencheu).
    expect(codesOf(errors)).not.toContain('AREA_MISSING_BOUNDS');
    expect(codesOf(errors)).not.toContain('AREA_INVALID_BOUNDS');
    // Mas processType e machineTargets continuam ausentes — erros.
    expect(codesOf(errors)).toEqual(
      expect.arrayContaining(['MISSING_PROCESS_TYPE', 'MISSING_MACHINE_TARGETS'])
    );
  });

  it('layer totalmente classificada (Onda 33 completa) → 0 issues', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    engine.setProcessRouting(id, 'corte', ['M1']);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors, warnings } = validatePattern(layers, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('pattern legado (sem patternRole em nenhuma layer) → 0 issues (retrocompat)', () => {
    engine.addRectangle(5, 5, 20, 10);
    engine.addRectangle(10, 10, 5, 5);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors, warnings } = validatePattern(layers);

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('TEXT_AREA convertida + setProcessRouting completo → 0 issues', () => {
    const rect = engine.addRectangle(8, 6, 30, 8);
    const id = (rect as unknown as { id: string }).id;
    engine.setProcessRouting(id, 'gravacao', ['M2']);
    const ok = engine.convertToArea(id, 'TEXT_AREA');
    expect(ok).toBe(true);

    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors, warnings } = validatePattern(layers);

    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('roundtrip via serialize → JSON.parse → validatePattern preserva issues', () => {
    const obj = engine.addRectangle(5, 5, 20, 10);
    const id = (obj as unknown as { id: string }).id;
    engine.setPatternRole(id, 'APPLIQUE');
    // setProcessRouting NÃO chamado — fica incompleto

    const items = [{ productId: 'p1', offsetX: 0, offsetY: 0, sizeWidth: 60, sizeHeight: 25 }];
    const serialized = engine.serialize(items as unknown as Parameters<typeof engine.serialize>[0]);
    const roundtrip = JSON.parse(JSON.stringify(serialized)) as typeof serialized;

    const { errors } = validatePattern(roundtrip.capi.layers);
    expect(codesOf(errors)).toEqual(
      expect.arrayContaining(['MISSING_PROCESS_TYPE', 'MISSING_MACHINE_TARGETS'])
    );
  });
});
