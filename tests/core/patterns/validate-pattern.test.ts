/**
 * Testes do validate-pattern (Onda 36).
 *
 * Função pura — todos os cenários montados via fixture LayerMeta sintético,
 * sem Fabric / canvas / engine.
 */
import { describe, expect, it } from 'vitest';

import { validatePattern, type PatternIssueCode } from '@/core/patterns/validate-pattern';
import type { LayerMeta, PrincipalLayerMeta, VisualLayerMeta } from '@/data/schema';

// ── Fixtures ───────────────────────────────────────────────────────────────

function visual(overrides: Partial<VisualLayerMeta> = {}): VisualLayerMeta {
  return {
    kind: 'visual',
    id: 'v1',
    parentLayerId: null,
    name: 'visual-1',
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    ...overrides,
  };
}

function principal(overrides: Partial<PrincipalLayerMeta> = {}): PrincipalLayerMeta {
  return {
    kind: 'principal',
    id: 'p1',
    parentLayerId: null,
    name: 'principal-1',
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    appliqueId: null,
    ...overrides,
  };
}

function codesOf(arr: { code: PatternIssueCode }[]): PatternIssueCode[] {
  return arr.map((i) => i.code);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('validatePattern (Onda 36)', () => {
  it('pattern vazio → sem issues', () => {
    const r = validatePattern([]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('layers legadas (sem patternRole) → sem issues (retrocompat)', () => {
    const layers: LayerMeta[] = [visual({ id: 'a' }), principal({ id: 'b' })];
    const r = validatePattern(layers);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('patternRole inválido → error INVALID_PATTERN_ROLE', () => {
    const layers: LayerMeta[] = [
      visual({
        // @ts-expect-error — forçando valor inválido
        patternRole: 'BOGUS',
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('INVALID_PATTERN_ROLE');
    // patternRole inválido curto-circuita demais regras
    expect(r.errors.length).toBe(1);
  });

  it('TEXT_AREA sem boundsMm → error AREA_MISSING_BOUNDS', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'TEXT_AREA',
        processType: 'gravacao',
        machineTargets: ['M2'],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('AREA_MISSING_BOUNDS');
  });

  it('LOGO_AREA com boundsMm width=0 → error AREA_INVALID_BOUNDS', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'LOGO_AREA',
        processType: 'gravacao',
        machineTargets: ['M2'],
        boundsMm: { x: 0, y: 0, width: 0, height: 10 },
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('AREA_INVALID_BOUNDS');
  });

  it('LOGO_AREA com fitMode inválido → error LOGO_AREA_INVALID_FIT_MODE', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'LOGO_AREA',
        processType: 'gravacao',
        machineTargets: ['M2'],
        boundsMm: { x: 0, y: 0, width: 10, height: 10 },
        // @ts-expect-error — forçando valor inválido
        fitMode: 'cover',
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('LOGO_AREA_INVALID_FIT_MODE');
  });

  it('APPLIQUE sem processType → error MISSING_PROCESS_TYPE', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        machineTargets: ['M1'],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('MISSING_PROCESS_TYPE');
  });

  it('CONTOUR sem machineTargets → error MISSING_MACHINE_TARGETS', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'CONTOUR',
        processType: 'marcacao',
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('MISSING_MACHINE_TARGETS');
  });

  it('machineTargets vazio → error MISSING_MACHINE_TARGETS', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'PRODUCT',
        processType: 'corte',
        machineTargets: [],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('MISSING_MACHINE_TARGETS');
  });

  it('machineTargets com código inválido → error INVALID_MACHINE_CODE', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        processType: 'corte',
        // @ts-expect-error — forçando código inválido
        machineTargets: ['M1', 'M9'],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('INVALID_MACHINE_CODE');
  });

  it('machineTargets > 3 → error TOO_MANY_MACHINE_TARGETS', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        processType: 'corte',
        // @ts-expect-error — forçando length>3
        machineTargets: ['M1', 'M2', 'M3', 'M1'],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('TOO_MANY_MACHINE_TARGETS');
  });

  it('processType inválido → error INVALID_PROCESS_TYPE', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        // @ts-expect-error — forçando valor inválido
        processType: 'risque',
        machineTargets: ['M1'],
      }),
    ];
    const r = validatePattern(layers);
    expect(codesOf(r.errors)).toContain('INVALID_PROCESS_TYPE');
  });

  it('machineTargets com duplicatas → warning DUPLICATE_MACHINE_TARGETS (não error)', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        processType: 'corte',
        machineTargets: ['M1', 'M1', 'M2'],
      }),
    ];
    const r = validatePattern(layers);
    expect(r.errors).toEqual([]);
    expect(codesOf(r.warnings)).toContain('DUPLICATE_MACHINE_TARGETS');
  });

  it('PRODUCT sem callback hasFabricObject → 0 warnings de vetor', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'PRODUCT',
        processType: 'corte',
        machineTargets: ['M1'],
      }),
    ];
    const r = validatePattern(layers); // sem opts
    expect(r.warnings).toEqual([]);
  });

  it('PRODUCT/APPLIQUE/CONTOUR com hasFabricObject=false → warning PRODUCT_NO_VECTOR', () => {
    const layers: LayerMeta[] = [
      visual({
        id: 'a',
        patternRole: 'APPLIQUE',
        processType: 'corte',
        machineTargets: ['M1'],
      }),
    ];
    const r = validatePattern(layers, { hasFabricObject: () => false });
    expect(codesOf(r.warnings)).toContain('PRODUCT_NO_VECTOR');
  });

  it('AREA com hasFabricObject=false → NÃO gera PRODUCT_NO_VECTOR (areas não precisam vetor)', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'TEXT_AREA',
        processType: 'gravacao',
        machineTargets: ['M2'],
        boundsMm: { x: 0, y: 0, width: 30, height: 8 },
      }),
    ];
    const r = validatePattern(layers, { hasFabricObject: () => false });
    expect(codesOf(r.warnings)).not.toContain('PRODUCT_NO_VECTOR');
  });

  it('layer totalmente válida → 0 issues', () => {
    const layers: LayerMeta[] = [
      visual({
        patternRole: 'APPLIQUE',
        processType: 'corte',
        machineTargets: ['M1', 'M2'],
      }),
    ];
    const r = validatePattern(layers, { hasFabricObject: () => true });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('mistura — só layer quebrada gera issue, válida fica intocada', () => {
    const layers: LayerMeta[] = [
      visual({
        id: 'ok',
        patternRole: 'APPLIQUE',
        processType: 'corte',
        machineTargets: ['M1'],
      }),
      visual({
        id: 'broken',
        patternRole: 'TEXT_AREA',
        // sem boundsMm, sem processType, sem machineTargets
      }),
      visual({ id: 'legacy' }), // sem patternRole — ignorada
    ];
    const r = validatePattern(layers);
    const allIssues = [...r.errors, ...r.warnings];
    expect(allIssues.every((i) => i.layerId === 'broken')).toBe(true);
    expect(codesOf(r.errors)).toEqual(
      expect.arrayContaining([
        'AREA_MISSING_BOUNDS',
        'MISSING_PROCESS_TYPE',
        'MISSING_MACHINE_TARGETS',
      ])
    );
  });

  it('mensagem do issue inclui nome da layer e código', () => {
    const layers: LayerMeta[] = [
      visual({
        id: 'x',
        name: 'Minha Camada',
        patternRole: 'TEXT_AREA',
      }),
    ];
    const r = validatePattern(layers);
    expect(r.errors[0].layerId).toBe('x');
    expect(r.errors[0].layerName).toBe('Minha Camada');
    expect(r.errors[0].severity).toBe('error');
    expect(r.errors[0].message).toContain('TEXT_AREA');
  });

  it('layer com name vazio → fallback "(sem nome)" no issue', () => {
    const layers: LayerMeta[] = [
      visual({
        id: 'x',
        name: '',
        patternRole: 'TEXT_AREA',
      }),
    ];
    const r = validatePattern(layers);
    expect(r.errors[0].layerName).toBe('(sem nome)');
  });
});
