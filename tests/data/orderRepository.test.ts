/**
 * Onda 11.A → Onda 11.C — Testes orderRepository + revisionRepository.
 *
 * Mocka getDb (reads diretas) e invoke (transactions). Não exercita SQLite
 * real — a atomicidade real do db_tx_execute já é coberta pelos unit tests
 * Rust (cargo test --lib db_tx).
 *
 * Onda 11.C estendeu os testes:
 *  - Default de status passou de 'pendente' → 'novo'
 *  - Cobertura nova: listAll, listByStatus, updateStatus, archiveAll,
 *    setExportedPngPath, create (modal "Novo Pedido")
 *  - Garantia de que parseStatus aceita os 6 valores Kanban
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

  it('parsea fields JSON + materializa Order com campos Kanban', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'o1',
        patternId: 'pat1',
        productId: 'prod1',
        label: 'João Silva — Advogado',
        fields: JSON.stringify({ nome: 'João Silva', profissao: 'Advogado' }),
        materialId: 'mat1',
        status: 'novo',
        canvasJson: '{}',
        exportedPngPath: null,
        exportedSvgPaths: null,
        customerName: 'João Silva',
        olistOrderId: null,
        marketplace: 'shopee',
        folderPath: null,
        archived: 0,
        createdAt: 1700000000,
        updatedAt: 1700000001,
        deletedAt: null,
      },
    ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o1');
    expect(order).not.toBeNull();
    expect(order!.fields).toEqual({ nome: 'João Silva', profissao: 'Advogado' });
    expect(order!.status).toBe('novo');
    expect(order!.label).toBe('João Silva — Advogado');
    expect(order!.customerName).toBe('João Silva');
    expect(order!.marketplace).toBe('shopee');
    expect(order!.archived).toBe(false);
  });

  it('aceita patternId/productId null (pedido pré-editor)', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'o-empty',
        patternId: null,
        productId: null,
        label: 'Maria Santos',
        fields: '{}',
        materialId: null,
        status: 'novo',
        canvasJson: '{}',
        exportedPngPath: null,
        exportedSvgPaths: null,
        customerName: 'Maria Santos',
        olistOrderId: null,
        marketplace: null,
        folderPath: null,
        archived: 0,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
      },
    ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o-empty');
    expect(order!.patternId).toBeNull();
    expect(order!.productId).toBeNull();
  });

  it('parsea os 6 status Kanban corretamente', async () => {
    const statuses = [
      'novo',
      'aguardando_info',
      'arte_enviada',
      'aprovado',
      'em_producao',
      'enviado',
    ];
    for (const status of statuses) {
      mockDb.select.mockResolvedValueOnce([
        {
          id: `o-${status}`,
          patternId: null,
          productId: null,
          label: 'L',
          fields: '{}',
          materialId: null,
          status,
          canvasJson: '{}',
          exportedPngPath: null,
          exportedSvgPaths: null,
          customerName: null,
          olistOrderId: null,
          marketplace: null,
          folderPath: null,
          archived: 0,
          createdAt: 0,
          updatedAt: 0,
          deletedAt: null,
        },
      ]);
      const { getById } = await import('@/data/repositories/orderRepository');
      const order = await getById(`o-${status}`);
      expect(order!.status).toBe(status);
    }
  });

  it('faz fallback para "novo" se status do banco for desconhecido', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'o-legacy',
        patternId: null,
        productId: null,
        label: 'Legado',
        fields: '{}',
        materialId: null,
        status: 'pendente', // valor legado (Onda 11.A) — migration deveria ter convertido
        canvasJson: '{}',
        exportedPngPath: null,
        exportedSvgPaths: null,
        customerName: null,
        olistOrderId: null,
        marketplace: null,
        folderPath: null,
        archived: 0,
        createdAt: 0,
        updatedAt: 0,
        deletedAt: null,
      },
    ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o-legacy');
    expect(order!.status).toBe('novo');
  });
});

describe('orderRepository.listPage', () => {
  it('passa limit e offset ao SQL e filtra archived=0', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { listPage } = await import('@/data/repositories/orderRepository');

    await listPage({ limit: 50, offset: 100 });

    const [sql, params] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(sql).toContain('archived = 0');
    expect(params).toEqual([50, 100]);
  });

  it('parsea status de cada row no resultado', async () => {
    mockDb.select.mockResolvedValueOnce([
      { id: 'a', label: 'A', status: 'novo', updatedAt: 1 },
      { id: 'b', label: 'B', status: 'aprovado', updatedAt: 2 },
    ]);
    const { listPage } = await import('@/data/repositories/orderRepository');

    const rows = await listPage({ limit: 50, offset: 0 });
    expect(rows.map((r) => r.status)).toEqual(['novo', 'aprovado']);
  });
});

describe('orderRepository.listAll', () => {
  it('retorna pedidos ativos ordenados por updated_at desc', async () => {
    mockDb.select.mockResolvedValueOnce([
      makeOrderRow('o2', 'novo', 200),
      makeOrderRow('o1', 'aprovado', 100),
    ]);
    const { listAll } = await import('@/data/repositories/orderRepository');

    const rows = await listAll();
    expect(rows.map((r) => r.id)).toEqual(['o2', 'o1']);

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('archived = 0');
    expect(sql).toContain('ORDER BY updated_at DESC');
  });
});

describe('orderRepository.listByStatus', () => {
  it('filtra por status e exclui archived por default', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { listByStatus } = await import('@/data/repositories/orderRepository');

    await listByStatus('enviado');

    const [sql, params] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('status = ?');
    expect(sql).toContain('archived = 0');
    expect(params).toEqual(['enviado']);
  });

  it('inclui arquivados quando includeArchived=true', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { listByStatus } = await import('@/data/repositories/orderRepository');

    await listByStatus('enviado', { includeArchived: true });

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('archived = 0');
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

  it("grava status 'novo' em orders + is_approved=0 em order_revisions", async () => {
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
    expect(payload.queries[0].sql).toContain("'novo'");
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

describe('orderRepository.create (modal Novo Pedido — Fase C)', () => {
  it('cria pedido com pattern_id/product_id NULL e status novo', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { create } = await import('@/data/repositories/orderRepository');

    const id = await create('João Silva');

    expect(id).toBeTruthy();
    expect(invoke).toHaveBeenCalledOnce();

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    expect(payload.queries).toHaveLength(2);
    expect(payload.queries[0].sql).toContain('INSERT INTO orders');
    expect(payload.queries[0].sql).toContain('NULL, NULL'); // pattern_id, product_id
    expect(payload.queries[0].sql).toContain("'novo'");
    // customer_name preenchido (params[4] = trimmed customerName)
    expect(payload.queries[0].params).toContain('João Silva');
  });

  it('rejeita customerName com menos de 2 caracteres', async () => {
    const { create } = await import('@/data/repositories/orderRepository');

    await expect(create('A')).rejects.toThrow(/at least 2 characters/);
    await expect(create('  ')).rejects.toThrow(/at least 2 characters/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('faz trim do customerName antes de gravar', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { create } = await import('@/data/repositories/orderRepository');

    await create('  Maria Santos  ');

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    expect(payload.queries[0].params).toContain('Maria Santos');
  });

  it('retorna o orderId gerado (uuid) para a UI redirecionar', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { create } = await import('@/data/repositories/orderRepository');

    const id = await create('Cliente Teste');
    // uuid v4: 36 chars, formato 8-4-4-4-12
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('orderRepository.updateStatus', () => {
  it('roda UPDATE com status novo + updated_at', async () => {
    const { updateStatus } = await import('@/data/repositories/orderRepository');

    await updateStatus('o1', 'aprovado');

    const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE orders');
    expect(sql).toContain('status = ?');
    expect(sql).toContain('updated_at = unixepoch()');
    expect(params).toEqual(['aprovado', 'o1']);
  });
});

describe('orderRepository.archiveAll', () => {
  it('marca múltiplos pedidos como archived=1 num único UPDATE', async () => {
    const { archiveAll } = await import('@/data/repositories/orderRepository');

    await archiveAll(['o1', 'o2', 'o3']);

    const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('archived = 1');
    expect(sql).toContain('IN (?, ?, ?)');
    expect(params).toEqual(['o1', 'o2', 'o3']);
  });

  it('no-op se array vazio (não chama db.execute)', async () => {
    const { archiveAll } = await import('@/data/repositories/orderRepository');

    await archiveAll([]);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});

describe('orderRepository.setExportedPngPath', () => {
  it('atualiza apenas o exported_png_path do pedido', async () => {
    const { setExportedPngPath } = await import('@/data/repositories/orderRepository');

    await setExportedPngPath('o1', '/path/to/mockup.png');

    const [sql, params] = mockDb.execute.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('exported_png_path = ?');
    expect(params).toEqual(['/path/to/mockup.png', 'o1']);
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

interface OrderRowMock {
  id: string;
  patternId: string | null;
  productId: string | null;
  label: string;
  fields: string;
  materialId: string | null;
  status: string;
  canvasJson: string;
  exportedPngPath: string | null;
  exportedSvgPaths: string | null;
  customerName: string | null;
  olistOrderId: string | null;
  marketplace: string | null;
  folderPath: string | null;
  archived: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

function makeOrderRow(id: string, status: string, updatedAt: number): OrderRowMock {
  return {
    id,
    patternId: null,
    productId: null,
    label: `Order ${id}`,
    fields: '{}',
    materialId: null,
    status,
    canvasJson: '{}',
    exportedPngPath: null,
    exportedSvgPaths: null,
    customerName: null,
    olistOrderId: null,
    marketplace: null,
    folderPath: null,
    archived: 0,
    createdAt: 0,
    updatedAt,
    deletedAt: null,
  };
}

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
