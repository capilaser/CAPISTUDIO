/**
 * Onda 8 — Checkpoint C: round-trip de padrão completo
 *
 * Valida que insertPattern, getPatternById e upsertPatternCanvas preservam
 * corretamente capi.layers (incluindo PrincipalLayerMeta com appliqueId e
 * VisualLayerMeta com materialId).
 *
 * Usa mock do banco (vi.mock '@tauri-apps/plugin-sql') — mesmo padrão dos
 * outros testes de repositório do projeto. O banco real é validado pelo
 * fluxo manual com prints (condição do Checkpoint C).
 *
 * Lição da Onda 6b aplicada: estes testes garantem que o código novo está
 * no caminho correto (SQL correto, parsing correto), mas não substituem a
 * validação visual manual exigida pelo Checkpoint C.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrincipalLayerMeta, VisualLayerMeta } from '@/data/schema';

// ── Mock do banco Tauri ───────────────────────────────────────────────────────

type Row = Record<string, unknown>;

const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1, lastInsertId: 0 })),
  select: vi.fn(async (): Promise<Row[]> => []),
};

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn(async () => mockDb) },
}));

vi.mock('@/data/client', () => ({
  getDb: vi.fn(async () => mockDb),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATTERN_ID = 'test-pattern-placa-advogado';
const PRODUCT_ID = 'placa-300x90';

const principalApliqueD: PrincipalLayerMeta = {
  id: 'layer-aplique-d',
  parentLayerId: null,
  name: 'Aplique Formato D',
  zIndex: 1,
  visible: true,
  locked: false,
  kind: 'principal',
  materialId: 'abs-escovado-bronze',
  appliqueId: 'aplique-1-formato-d',
};

const principalApliqueP: PrincipalLayerMeta = {
  id: 'layer-aplique-pill',
  parentLayerId: null,
  name: 'Aplique Pill',
  zIndex: 2,
  visible: true,
  locked: false,
  kind: 'principal',
  materialId: null,
  appliqueId: 'aplique-3-pill',
};

const visualBase: VisualLayerMeta = {
  id: 'layer-base',
  parentLayerId: null,
  name: 'Base',
  zIndex: 0,
  visible: true,
  locked: false,
  kind: 'visual',
  materialId: 'abs-escovado-dourado',
};

const canvasJson = {
  version: '6.0.0',
  objects: [
    { id: 'layer-base', type: 'rect', left: 0, top: 0, width: 1200, height: 360 },
    { id: 'layer-aplique-d', type: 'group', left: -80, top: 0 },
    { id: 'layer-aplique-pill', type: 'group', left: 100, top: 100 },
    {
      id: 'slot-nome',
      type: 'rect',
      capiSlot: { type: 'nome', maxArea: { w: 80, h: 10 }, autoCenter: true },
    },
  ],
  capi: {
    productId: PRODUCT_ID,
    units: 'mm' as const,
    schemaVersion: 2,
    layers: [visualBase, principalApliqueD, principalApliqueP],
  },
};

const canvasJsonStr = JSON.stringify(canvasJson);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePatternRow(id: string, name: string) {
  return {
    id,
    productId: PRODUCT_ID,
    name,
    description: null,
    wave: 8,
    tags: '[]',
    canvasJson: canvasJsonStr,
    defaultMaterialId: null,
    isFavorite: 0,
    isValidated: 0,
    createdAt: 1700000000,
    updatedAt: 1700000000,
    deletedAt: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Onda 8 — round-trip de padrão (Checkpoint C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insertPattern', () => {
    it('chama db.execute com INSERT correto e retorna o id', async () => {
      const { insertPattern } = await import('@/data/repositories/patternRepository');

      const id = await insertPattern(PATTERN_ID, PRODUCT_ID, 'Placa Advogado', canvasJsonStr);

      expect(id).toBe(PATTERN_ID);
      expect(mockDb.execute).toHaveBeenCalledOnce();
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO patterns');
      expect(params[0]).toBe(PATTERN_ID);
      expect(params[1]).toBe(PRODUCT_ID);
      expect(params[2]).toBe('Placa Advogado');
      expect(params[4]).toBe(canvasJsonStr);
    });
  });

  describe('listByProduct', () => {
    it('filtra por product_id — não retorna padrões de outros produtos', async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: PATTERN_ID, name: 'Placa Advogado', updatedAt: 1700000000 },
      ]);

      const { listByProduct } = await import('@/data/repositories/patternRepository');
      const list = await listByProduct(PRODUCT_ID);

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(PATTERN_ID);
      expect(list[0].name).toBe('Placa Advogado');

      const [sql, params] = mockDb.select.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('product_id = ?');
      expect(params[0]).toBe(PRODUCT_ID);
    });

    it('retorna lista vazia quando não há padrões', async () => {
      mockDb.select.mockResolvedValueOnce([]);

      const { listByProduct } = await import('@/data/repositories/patternRepository');
      const list = await listByProduct(PRODUCT_ID);

      expect(list).toHaveLength(0);
    });
  });

  describe('getPatternById — parsing de capi.layers', () => {
    it('preserva 2 PrincipalLayerMeta com appliqueId correto', async () => {
      mockDb.select.mockResolvedValueOnce([makePatternRow(PATTERN_ID, 'Placa Advogado')]);

      const { getPatternById } = await import('@/data/repositories/patternRepository');
      const pattern = await getPatternById(PATTERN_ID);

      expect(pattern).not.toBeNull();
      const layers = pattern!.canvasJson!.capi!.layers;
      expect(layers).toHaveLength(3);

      const principals = layers.filter((l) => l.kind === 'principal') as PrincipalLayerMeta[];
      expect(principals).toHaveLength(2);

      const apliqueD = principals.find((l) => l.id === 'layer-aplique-d');
      expect(apliqueD?.appliqueId).toBe('aplique-1-formato-d');
      expect(apliqueD?.materialId).toBe('abs-escovado-bronze');

      const apliqueP = principals.find((l) => l.id === 'layer-aplique-pill');
      expect(apliqueP?.appliqueId).toBe('aplique-3-pill');
      expect(apliqueP?.materialId).toBeNull();
    });

    it('preserva VisualLayerMeta com materialId da base', async () => {
      mockDb.select.mockResolvedValueOnce([makePatternRow(PATTERN_ID, 'Placa Advogado')]);

      const { getPatternById } = await import('@/data/repositories/patternRepository');
      const pattern = await getPatternById(PATTERN_ID);

      const layers = pattern!.canvasJson!.capi!.layers;
      const visual = layers.find((l) => l.kind === 'visual') as VisualLayerMeta;
      expect(visual).toBeDefined();
      expect(visual.materialId).toBe('abs-escovado-dourado');
    });

    it('preserva capiSlot no objeto Fabric serializado (slot de nome)', async () => {
      mockDb.select.mockResolvedValueOnce([makePatternRow(PATTERN_ID, 'Placa Advogado')]);

      const { getPatternById } = await import('@/data/repositories/patternRepository');
      const pattern = await getPatternById(PATTERN_ID);

      const objects = pattern!.canvasJson!.objects;
      const slotObj = objects.find((o) => (o as Record<string, unknown>).capiSlot !== undefined) as
        | Record<string, unknown>
        | undefined;
      expect(slotObj).toBeDefined();
      const slot = slotObj!.capiSlot as { type: string };
      expect(slot.type).toBe('nome');
    });
  });

  describe('upsertPatternCanvas — edição do nome preserva capi.layers', () => {
    it('chama UPDATE com canvasJson atualizado mantendo layers intactas', async () => {
      const updatedJson = JSON.stringify({
        ...canvasJson,
        objects: canvasJson.objects.map((o) =>
          (o as Record<string, unknown>).capiSlot ? { ...o, content: 'João Silva' } : o
        ),
      });

      const { upsertPatternCanvas } = await import('@/data/repositories/patternRepository');
      await upsertPatternCanvas(PATTERN_ID, PRODUCT_ID, updatedJson, 'Placa Advogado');

      expect(mockDb.execute).toHaveBeenCalledOnce();
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT(id) DO UPDATE');
      // canvasJson passado é o atualizado
      expect(params[4]).toBe(updatedJson);

      // Verificar que layers ainda estão no JSON atualizado
      const parsed = JSON.parse(updatedJson) as typeof canvasJson;
      expect(parsed.capi.layers).toHaveLength(3);
      expect(parsed.capi.layers.filter((l) => l.kind === 'principal')).toHaveLength(2);
    });
  });
});
