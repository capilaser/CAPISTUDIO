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
    // Onda 13: envelope agora carrega items[] em vez de productId direto.
    // Pattern master sempre tem 1 item, offsets 0.
    items: [{ productId: PRODUCT_ID, offsetX: 0, offsetY: 0 }],
    units: 'mm' as const,
    schemaVersion: 3,
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

  // ── Onda 14c — CRUD completo (editar/deletar/duplicar + tags) ───────────
  describe('insertPattern com tags', () => {
    it('persiste tags como JSON quando passadas', async () => {
      const { insertPattern } = await import('@/data/repositories/patternRepository');
      await insertPattern(PATTERN_ID, PRODUCT_ID, 'Pattern Tag', canvasJsonStr, [
        'com-borda',
        'com-logo',
      ]);
      const [, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(params[5]).toBe(JSON.stringify(['com-borda', 'com-logo']));
    });

    it('default vira []  quando tags omitido (retrocompat)', async () => {
      const { insertPattern } = await import('@/data/repositories/patternRepository');
      await insertPattern(PATTERN_ID, PRODUCT_ID, 'Pattern', canvasJsonStr);
      const [, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(params[5]).toBe('[]');
    });
  });

  describe('updatePattern', () => {
    it('faz UPDATE apenas dos campos passados, sempre bumpa updated_at', async () => {
      const { updatePattern } = await import('@/data/repositories/patternRepository');
      await updatePattern(PATTERN_ID, { name: 'Novo Nome' });
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE patterns SET name = ?');
      expect(sql).toContain('updated_at = unixepoch()');
      expect(sql).toContain('WHERE id = ? AND deleted_at IS NULL');
      expect(params[0]).toBe('Novo Nome');
      expect(params[1]).toBe(PATTERN_ID);
    });

    it('atualiza name + tags + canvasJson juntos', async () => {
      const { updatePattern } = await import('@/data/repositories/patternRepository');
      await updatePattern(PATTERN_ID, {
        name: 'X',
        canvasJson: '{"objects":[]}',
        tags: ['t1', 't2'],
      });
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('name = ?');
      expect(sql).toContain('canvas_json = ?');
      expect(sql).toContain('tags = ?');
      expect(params).toEqual(['X', '{"objects":[]}', JSON.stringify(['t1', 't2']), PATTERN_ID]);
    });

    it('no-op silencioso quando fields vazio (não chama execute)', async () => {
      const { updatePattern } = await import('@/data/repositories/patternRepository');
      await updatePattern(PATTERN_ID, {});
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('softDeletePattern', () => {
    it('seta deleted_at via UPDATE, não DELETE físico', async () => {
      const { softDeletePattern } = await import('@/data/repositories/patternRepository');
      await softDeletePattern(PATTERN_ID);
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('UPDATE patterns');
      expect(sql).toContain('deleted_at = unixepoch()');
      expect(sql).not.toMatch(/^\s*DELETE/i);
      expect(params[0]).toBe(PATTERN_ID);
    });
  });

  describe('duplicatePattern', () => {
    it('clona com novo id/name e zera is_favorite/is_validated', async () => {
      // 1ª chamada = SELECT do getPatternById (source). 2ª = INSERT.
      mockDb.select.mockResolvedValueOnce([
        {
          ...makePatternRow(PATTERN_ID, 'Original'),
          tags: '["a","b"]',
          isFavorite: 1,
          isValidated: 1,
        },
      ]);
      const { duplicatePattern } = await import('@/data/repositories/patternRepository');
      const newId = await duplicatePattern(PATTERN_ID, 'pattern-new', 'Cópia');

      expect(newId).toBe('pattern-new');
      const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO patterns');
      expect(sql).toContain('is_favorite, is_validated)');
      expect(sql).toContain('0, 0)');
      expect(params[0]).toBe('pattern-new');
      expect(params[1]).toBe(PRODUCT_ID);
      expect(params[2]).toBe('Cópia');
      expect(params[5]).toBe(JSON.stringify(['a', 'b']));
    });

    it('throws quando source não existe', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const { duplicatePattern } = await import('@/data/repositories/patternRepository');
      await expect(duplicatePattern('inexistente', 'x', 'y')).rejects.toThrow(/não encontrado/);
    });
  });

  describe('getAllPatternSummaries (Onda 14c)', () => {
    it('inclui name e tags parseados', async () => {
      mockDb.select.mockResolvedValueOnce([
        {
          id: PATTERN_ID,
          productId: PRODUCT_ID,
          name: 'Placa Adv',
          tags: '["com-borda"]',
          canvasJsonLength: 1234,
          updatedAt: 1700000000,
        },
      ]);
      const { getAllPatternSummaries } = await import('@/data/repositories/patternRepository');
      const list = await getAllPatternSummaries();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Placa Adv');
      expect(list[0].tags).toEqual(['com-borda']);
    });

    it('tags inválido vira [] silenciosamente', async () => {
      mockDb.select.mockResolvedValueOnce([
        {
          id: PATTERN_ID,
          productId: PRODUCT_ID,
          name: 'X',
          tags: 'json-quebrado{',
          canvasJsonLength: 0,
          updatedAt: 0,
        },
      ]);
      const { getAllPatternSummaries } = await import('@/data/repositories/patternRepository');
      const list = await getAllPatternSummaries();
      expect(list[0].tags).toEqual([]);
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
