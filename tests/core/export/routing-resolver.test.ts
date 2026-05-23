/**
 * Testes do routing-resolver (Onda 35). Função pura — sem Fabric, sem DOM.
 *
 * Cobre a cascata `patternRole (Onda 33) → asset legado → null`, a precedência
 * Onda33-vence-asset e a herança de routing por texto via parent.
 */
import { describe, expect, it } from 'vitest';

import type { AssetLookupFn } from '@/core/export/asset-routing-types';
import { resolveLayerRouting, resolveTextLayerRouting } from '@/core/export/routing-resolver';
import type { LayerMeta, PrincipalLayerMeta, VisualLayerMeta } from '@/data/schema';

// ── Fixtures ────────────────────────────────────────────────────────────────

function principal(overrides: Partial<PrincipalLayerMeta> = {}): PrincipalLayerMeta {
  return {
    kind: 'principal',
    id: 'p1',
    parentLayerId: null,
    name: 'principal-test',
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    appliqueId: null,
    ...overrides,
  };
}

function visual(overrides: Partial<VisualLayerMeta> = {}): VisualLayerMeta {
  return {
    kind: 'visual',
    id: 'v1',
    parentLayerId: null,
    name: 'visual-test',
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    ...overrides,
  };
}

function mkLookup(
  table: Record<string, { operation: 'corte' | 'gravacao' | 'marcacao'; machines: string[] }>
): AssetLookupFn {
  return async (id) => table[id] ?? null;
}

// ── resolveLayerRouting ─────────────────────────────────────────────────────

describe('resolveLayerRouting (Onda 35)', () => {
  it('patternRole completo (Onda 33) → routing direto, source="pattern-role"', async () => {
    const layer = visual({
      patternRole: 'APPLIQUE',
      processType: 'corte',
      machineTargets: ['M1'],
    });
    const res = await resolveLayerRouting(layer, mkLookup({}), 'test');
    expect(res.source).toBe('pattern-role');
    expect(res.routing).toEqual({ operation: 'corte', machines: ['master-biro'] });
  });

  it('Onda 33 traduz machineTargets M1/M2/M3 corretamente', async () => {
    const layer = visual({
      patternRole: 'CONTOUR',
      processType: 'gravacao',
      machineTargets: ['M1', 'M2', 'M3'],
    });
    const res = await resolveLayerRouting(layer, mkLookup({}), 'test');
    expect(res.routing?.machines).toEqual(['master-biro', 'fiber-laser', 'due-laser']);
  });

  it('sem patternRole, com engravingId → caminho legado (source="asset")', async () => {
    const layer = visual({ engravingId: 'eng-1' });
    const lookup = mkLookup({ 'eng-1': { operation: 'gravacao', machines: ['fiber-laser'] } });
    const res = await resolveLayerRouting(layer, lookup, 'test');
    expect(res.source).toBe('asset');
    expect(res.routing).toEqual({ operation: 'gravacao', machines: ['fiber-laser'] });
  });

  it('Onda 33 completa + asset → Onda 33 vence (precedência decisão D do plano)', async () => {
    const layer = principal({
      appliqueId: 'app-1',
      patternRole: 'APPLIQUE',
      processType: 'corte',
      machineTargets: ['M2'],
    });
    // O lookup retornaria gravacao/master-biro, mas Onda 33 vence.
    const lookup = mkLookup({ 'app-1': { operation: 'gravacao', machines: ['master-biro'] } });
    const res = await resolveLayerRouting(layer, lookup, 'test');
    expect(res.source).toBe('pattern-role');
    expect(res.routing).toEqual({ operation: 'corte', machines: ['fiber-laser'] });
  });

  it('patternRole presente mas SEM processType → cai no caminho asset (incompleto)', async () => {
    const layer = visual({
      patternRole: 'TEXT_AREA',
      machineTargets: ['M1'],
      engravingId: 'eng-1',
    });
    const lookup = mkLookup({ 'eng-1': { operation: 'gravacao', machines: ['fiber-laser'] } });
    const res = await resolveLayerRouting(layer, lookup, 'test');
    expect(res.source).toBe('asset');
  });

  it('patternRole presente mas machineTargets vazio → incompleto, cai no asset', async () => {
    const layer = visual({
      patternRole: 'LOGO_AREA',
      processType: 'gravacao',
      machineTargets: [],
      engravingId: 'eng-1',
    });
    const lookup = mkLookup({ 'eng-1': { operation: 'gravacao', machines: ['fiber-laser'] } });
    const res = await resolveLayerRouting(layer, lookup, 'test');
    expect(res.source).toBe('asset');
  });

  it('visual sem asset, sem patternRole completo → source="none" com reason', async () => {
    const layer = visual({});
    const res = await resolveLayerRouting(layer, mkLookup({}), 'test');
    expect(res.source).toBe('none');
    expect(res.routing).toBeNull();
    expect(res.reason).toContain('visual sem engravingId/markingId');
  });

  it('principal sem appliqueId, sem patternRole → source="none"', async () => {
    const layer = principal({ appliqueId: null });
    const res = await resolveLayerRouting(layer, mkLookup({}), 'test');
    expect(res.source).toBe('none');
    expect(res.reason).toContain('principal sem appliqueId');
  });

  it('asset id presente mas lookup retorna null → THROW (banco inconsistente)', async () => {
    // Contrato pré-Onda 35 preservado: FK quebrada é dado corrompido, não slot vazio.
    const layer = principal({ appliqueId: 'fantasma' });
    await expect(resolveLayerRouting(layer, mkLookup({}), 'test')).rejects.toThrow(
      /assetLookup retornou null/
    );
  });

  it('asset com operation inválida → throw via assertValidOperation', async () => {
    const layer = visual({ engravingId: 'eng-1' });
    const lookup = mkLookup({
      // @ts-expect-error — forçando dado sujo
      'eng-1': { operation: 'invalid-op', machines: ['fiber-laser'] },
    });
    await expect(resolveLayerRouting(layer, lookup, 'test')).rejects.toThrow(/operation deve ser/);
  });
});

// ── resolveTextLayerRouting ─────────────────────────────────────────────────

describe('resolveTextLayerRouting (Onda 35)', () => {
  it('override completo (operation+machines) vence tudo', async () => {
    const textLayer = visual({ id: 'txt-1' });
    const res = await resolveTextLayerRouting(
      textLayer,
      new Map(),
      mkLookup({}),
      { operation: 'corte', machines: ['master-biro'] },
      'test'
    );
    expect(res.routing).toEqual({ operation: 'corte', machines: ['master-biro'] });
  });

  it('Onda 33 completa NA LAYER do texto → usa direto', async () => {
    const textLayer = visual({
      id: 'txt-1',
      patternRole: 'TEXT_AREA',
      processType: 'gravacao',
      machineTargets: ['M2'],
    });
    const res = await resolveTextLayerRouting(
      textLayer,
      new Map(),
      mkLookup({}),
      undefined,
      'test'
    );
    expect(res.source).toBe('pattern-role');
    expect(res.routing).toEqual({ operation: 'gravacao', machines: ['fiber-laser'] });
  });

  it('Onda 33 completa NO PAI → herda machines, operation default = gravacao', async () => {
    const parent = principal({
      id: 'parent-1',
      patternRole: 'APPLIQUE',
      processType: 'corte', // pai é corte, mas texto sempre é gravacao por default
      machineTargets: ['M2', 'M3'],
    });
    const textLayer = visual({ id: 'txt-1', parentLayerId: 'parent-1' });
    const map = new Map<string, LayerMeta>([['parent-1', parent]]);
    const res = await resolveTextLayerRouting(textLayer, map, mkLookup({}), undefined, 'test');
    expect(res.source).toBe('pattern-role');
    expect(res.routing).toEqual({
      operation: 'gravacao',
      machines: ['fiber-laser', 'due-laser'],
    });
  });

  it('asset legado do pai → caminho asset', async () => {
    const parent = principal({ id: 'parent-1', appliqueId: 'app-1' });
    const textLayer = visual({ id: 'txt-1', parentLayerId: 'parent-1' });
    const map = new Map<string, LayerMeta>([['parent-1', parent]]);
    const lookup = mkLookup({ 'app-1': { operation: 'corte', machines: ['master-biro'] } });
    const res = await resolveTextLayerRouting(textLayer, map, lookup, undefined, 'test');
    expect(res.source).toBe('asset');
    // operation default = gravacao (texto), machines herdadas do pai
    expect(res.routing).toEqual({ operation: 'gravacao', machines: ['master-biro'] });
  });

  it('texto sem parent → source="none" com reason', async () => {
    const textLayer = visual({ id: 'txt-1', parentLayerId: null });
    const res = await resolveTextLayerRouting(
      textLayer,
      new Map(),
      mkLookup({}),
      undefined,
      'test'
    );
    expect(res.source).toBe('none');
    expect(res.reason).toContain('sem parentLayerId');
  });

  it('pai não-principal sem patternRole → source="none"', async () => {
    const parent = visual({ id: 'parent-1' });
    const textLayer = visual({ id: 'txt-1', parentLayerId: 'parent-1' });
    const map = new Map<string, LayerMeta>([['parent-1', parent]]);
    const res = await resolveTextLayerRouting(textLayer, map, mkLookup({}), undefined, 'test');
    expect(res.source).toBe('none');
  });

  it('override apenas com operation (sem machines) → mantém cascata de machines, troca op', async () => {
    const parent = principal({ id: 'parent-1', appliqueId: 'app-1' });
    const textLayer = visual({ id: 'txt-1', parentLayerId: 'parent-1' });
    const map = new Map<string, LayerMeta>([['parent-1', parent]]);
    const lookup = mkLookup({ 'app-1': { operation: 'corte', machines: ['master-biro'] } });
    const res = await resolveTextLayerRouting(
      textLayer,
      map,
      lookup,
      { operation: 'marcacao' },
      'test'
    );
    expect(res.routing).toEqual({ operation: 'marcacao', machines: ['master-biro'] });
  });
});
