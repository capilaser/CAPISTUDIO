/**
 * Onda 11.A — Testes orderRepository + revisionRepository.
 *
 * Mocka getDb (reads diretas) e invoke (transactions). Não exercita SQLite
 * real — a atomicidade real do db_tx_execute já é coberta pelos unit tests
 * Rust (cargo test --lib db_tx).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  execute: vi.fn(async () => ({ rowsAffected: 1, lastInsertId: 0 })),
  select: vi.fn(async () => [] as unknown[]),
};

vi.mock('@/data/client', () => ({
  getDb: vi.fn(async () => mockDb),
}));

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

beforeEach(() => {
  mockDb.execute.mockClear();
  mockDb.select.mockReset();
  mockDb.select.mockImplementation(async () => []);
  invoke.mockReset();
});

// ── orderRepository — reads ──────────────────────────────────────────────────

describe('orderRepository.getById', () => {
  it('retorna null quando não encontrado', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const result = await getById('missing');
    expect(result).toBeNull();
  });

  it('parsea fields JSON + materializa Order', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'o1',
        patternId: 'pat1',
        productId: 'prod1',
        label: 'João Silva — Advogado',
        fields: JSON.stringify({ nome: 'João Silva', profissao: 'Advogado' }),
        materialId: 'mat1',
        status: 'pendente',
        canvasJson: '{}',
        exportedPngPath: null,
        exportedSvgPaths: null,
        createdAt: 1700000000,
        updatedAt: 1700000001,
        deletedAt: null,
      },
    ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o1');
    expect(order).not.toBeNull();
    expect(order!.fields).toEqual({ nome: 'João Silva', profissao: 'Advogado' });
    expect(order!.status).toBe('pendente');
    expect(order!.label).toBe('João Silva — Advogado');
  });

  it('parsea status enviado_cliente corretamente', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'o-sent',
        patternId: 'p',
        productId: 'pr',
        label: 'L',
        fields: '{}',
        materialId: null,
        status: 'enviado_cliente',
        canvasJson: '{}',
        exportedPngPath: '/some/path.png',
        exportedSvgPaths: null,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
      },
    ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o-sent');
    expect(order!.status).toBe('enviado_cliente');
  });
});

describe('orderRepository.listPage', () => {
  it('passa limit e offset ao SQL', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { listPage } = await import('@/data/repositories/orderRepository');

    await listPage({ limit: 50, offset: 100 });

    const [sql, params] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(params).toEqual([50, 100]);
  });

  it('parsea status de cada row no resultado', async () => {
    mockDb.select.mockResolvedValueOnce([
      { id: 'a', label: 'A', status: 'pendente', updatedAt: 1 },
      { id: 'b', label: 'B', status: 'enviado_cliente', updatedAt: 2 },
    ]);
    const { listPage } = await import('@/data/repositories/orderRepository');

    const rows = await listPage({ limit: 50, offset: 0 });
    expect(rows.map((r) => r.status)).toEqual(['pendente', 'enviado_cliente']);
  });
});

// ── orderRepository — writes atomicas ────────────────────────────────────────

describe('orderRepository.createWithFirstRevision', () => {
  it('executa exatamente 2 queries em transação atômica', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithFirstRevision } = await import('@/data/repositories/orderRepository');

    await createWithFirstRevision({
      id: 'o1',
      patternId: 'pat1',
      productId: 'prod1',
      label: 'João Silva — Advogado',
      fields: { nome: 'João Silva', profissao: 'Advogado' },
      materialId: 'mat1',
      canvasJson: '{"version":"6.0.0","objects":[]}',
    });

    expect(invoke).toHaveBeenCalledOnce();
    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    expect(payload.queries).toHaveLength(2);
    expect(payload.queries[0].sql).toContain('INSERT INTO orders');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_revisions');
  });

  it('grava status pendente em orders + is_approved=0 em order_revisions', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithFirstRevision } = await import('@/data/repositories/orderRepository');

    await createWithFirstRevision({
      id: 'o2',
      patternId: 'pat',
      productId: 'prod',
      label: 'L',
      fields: {},
      canvasJson: '{}',
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    expect(payload.queries[0].sql).toContain("'pendente'");
    // is_approved=0 (false) — Onda 12 vai marcar 1 em comando dedicado
    expect(payload.queries[1].sql).toContain('is_approved');
    expect(payload.queries[1].sql).toMatch(/,\s*0,\s*unixepoch\(\)/);
  });

  it('aceita materialId opcional como null', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithFirstRevision } = await import('@/data/repositories/orderRepository');

    await createWithFirstRevision({
      id: 'o3',
      patternId: 'p',
      productId: 'pr',
      label: 'L',
      fields: {},
      canvasJson: '{}',
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    // orders insert: materialId is 6º param (index 5)
    expect(payload.queries[0].params[5]).toBeNull();
    // revisions insert: materialId is 4º param (index 3)
    expect(payload.queries[1].params[3]).toBeNull();
  });

  it('propaga TransactionError se transação falha', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 0,
      message: 'UNIQUE constraint failed: orders.id',
    });
    const { createWithFirstRevision } = await import('@/data/repositories/orderRepository');

    await expect(
      createWithFirstRevision({
        id: 'dup',
        patternId: 'p',
        productId: 'pr',
        label: 'L',
        fields: {},
        canvasJson: '{}',
      })
    ).rejects.toThrow(/query\[0\].*UNIQUE/);
  });

  it('serializa fields como JSON nas duas queries (mesmo snapshot)', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithFirstRevision } = await import('@/data/repositories/orderRepository');

    const fields = { nome: 'Ana', profissao: 'Dentista', custom: { x: 1 } };
    await createWithFirstRevision({
      id: 'o4',
      patternId: 'p',
      productId: 'pr',
      label: 'L',
      fields,
      canvasJson: '{}',
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    const ordersFields = payload.queries[0].params[4] as string;
    const revisionsFields = payload.queries[1].params[2] as string;
    expect(JSON.parse(ordersFields)).toEqual(fields);
    expect(revisionsFields).toBe(ordersFields);
  });
});

describe('orderRepository.saveRevision', () => {
  it('roda UPDATE orders + INSERT order_revisions atomicamente', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({
      orderId: 'o1',
      fields: { nome: 'João V2' },
      canvasJson: '{"v":2}',
    });

    expect(invoke).toHaveBeenCalledOnce();
    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    expect(payload.queries).toHaveLength(2);
    expect(payload.queries[0].sql).toContain('UPDATE orders');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_revisions');
    expect(payload.queries[1].sql).toContain('COALESCE(MAX(number), 0) + 1');
  });

  it('preserva status do pedido (não altera) e marca is_approved=0', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({
      orderId: 'o1',
      fields: {},
      canvasJson: '{}',
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    // UPDATE não toca em status
    expect(payload.queries[0].sql).not.toContain('status =');
    // Nova revisão entra com is_approved=0 (não é "aprovada" automaticamente)
    expect(payload.queries[1].sql).toContain('is_approved');
    expect(payload.queries[1].sql).toMatch(/NULL,\s*0,/);
  });

  it('propaga TransactionError com queryIndex apontando para a falha', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 1,
      message: 'UNIQUE constraint failed: order_revisions.order_id, order_revisions.number',
    });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await expect(
      saveRevision({
        orderId: 'o1',
        fields: {},
        canvasJson: '{}',
      })
    ).rejects.toMatchObject({ queryIndex: 1 });
  });
});

// ── revisionRepository ───────────────────────────────────────────────────────

describe('revisionRepository.listByOrder', () => {
  it('retorna revisões da mais nova para mais antiga', async () => {
    mockDb.select.mockResolvedValueOnce([
      makeRevisionRow('r3', 'o1', 3),
      makeRevisionRow('r2', 'o1', 2),
      makeRevisionRow('r1', 'o1', 1),
    ]);
    const { listByOrder } = await import('@/data/repositories/revisionRepository');

    const rows = await listByOrder('o1');
    expect(rows.map((r) => r.number)).toEqual([3, 2, 1]);

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('ORDER BY number DESC');
  });

  it('parsea fields e isApproved de cada revision', async () => {
    mockDb.select.mockResolvedValueOnce([
      makeRevisionRow('r1', 'o1', 1, { nome: 'João' }, false),
      makeRevisionRow('r2', 'o1', 2, { nome: 'João V2' }, true),
    ]);
    const { listByOrder } = await import('@/data/repositories/revisionRepository');

    const rows = await listByOrder('o1');
    expect(rows[0].fields).toEqual({ nome: 'João' });
    expect(rows[0].isApproved).toBe(false);
    expect(rows[1].isApproved).toBe(true);
  });
});

describe('revisionRepository.getLatest', () => {
  it('retorna a revisão com maior number', async () => {
    mockDb.select.mockResolvedValueOnce([makeRevisionRow('r5', 'o1', 5)]);
    const { getLatest } = await import('@/data/repositories/revisionRepository');

    const r = await getLatest('o1');
    expect(r?.number).toBe(5);

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIMIT 1');
  });

  it('retorna null se sem revisões', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { getLatest } = await import('@/data/repositories/revisionRepository');

    const r = await getLatest('o-empty');
    expect(r).toBeNull();
  });
});

// ── Helpers de fixture ───────────────────────────────────────────────────────

interface RevisionRowMock {
  id: string;
  orderId: string;
  number: number;
  fields: string;
  materialId: string | null;
  canvasJson: string;
  exportedPngPath: string | null;
  isApproved: number;
  createdAt: number;
}

function makeRevisionRow(
  id: string,
  orderId: string,
  number: number,
  fields: Record<string, unknown> = {},
  isApproved = false
): RevisionRowMock {
  return {
    id,
    orderId,
    number,
    fields: JSON.stringify(fields),
    materialId: null,
    canvasJson: '{}',
    exportedPngPath: null,
    isApproved: isApproved ? 1 : 0,
    createdAt: 1700000000 + number,
  };
}
