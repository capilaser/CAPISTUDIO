/**
 * Onda 11.A → Onda 13 — Testes orderRepository + revisionRepository.
 *
 * Mocka getDb (reads diretas) e invoke (transactions). Não exercita SQLite
 * real — a atomicidade real do db_tx_execute já é coberta pelos unit tests
 * Rust (cargo test --lib db_tx).
 *
 * Onda 13 reescreveu o repository pra multi-broche:
 *   - Order ganhou items: OrderItem[]
 *   - Order perdeu patternId/productId/materialId/fields/canvasJson
 *   - createWithFirstRevision virou createWithItems
 *   - saveRevision agora recebe items[] (delete-all + insert-all)
 *   - revisionRepository.items é parsed de items_json
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

  it('materializa Order com items hidratados', async () => {
    // 1ª chamada: SELECT orders. 2ª: SELECT items.
    mockDb.select
      .mockResolvedValueOnce([makeOrderRow('o1', 'novo', 1700000001)])
      .mockResolvedValueOnce([
        makeItemRow('it1', 'o1', 0, 'prod1', 'pat1', 'mat1'),
        makeItemRow('it2', 'o1', 1, 'prod1', null, null),
      ]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o1');
    expect(order).not.toBeNull();
    expect(order!.items).toHaveLength(2);
    expect(order!.items[0].productId).toBe('prod1');
    expect(order!.items[0].patternId).toBe('pat1');
    expect(order!.items[1].position).toBe(1);
    expect(order!.items[1].patternId).toBeNull();
  });

  it('aceita pedido sem items (zero broches)', async () => {
    mockDb.select
      .mockResolvedValueOnce([makeOrderRow('o-empty', 'novo', 0)])
      .mockResolvedValueOnce([]);
    const { getById } = await import('@/data/repositories/orderRepository');

    const order = await getById('o-empty');
    expect(order!.items).toEqual([]);
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
      mockDb.select
        .mockResolvedValueOnce([makeOrderRow(`o-${status}`, status, 0)])
        .mockResolvedValueOnce([]);
      const { getById } = await import('@/data/repositories/orderRepository');
      const order = await getById(`o-${status}`);
      expect(order!.status).toBe(status);
    }
  });

  it('faz fallback para "novo" se status do banco for desconhecido', async () => {
    mockDb.select
      .mockResolvedValueOnce([makeOrderRow('o-legacy', 'pendente', 0)])
      .mockResolvedValueOnce([]);
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
  it('retorna pedidos ativos + items agrupados por orderId', async () => {
    mockDb.select
      .mockResolvedValueOnce([makeOrderRow('o2', 'novo', 200), makeOrderRow('o1', 'aprovado', 100)])
      .mockResolvedValueOnce([
        makeItemRow('it1', 'o2', 0, 'prod-A'),
        makeItemRow('it2', 'o1', 0, 'prod-B'),
        makeItemRow('it3', 'o1', 1, 'prod-B'),
      ]);
    const { listAll } = await import('@/data/repositories/orderRepository');

    const rows = await listAll();
    expect(rows.map((r) => r.id)).toEqual(['o2', 'o1']);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[1].items).toHaveLength(2);

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('archived = 0');
    expect(sql).toContain('ORDER BY updated_at DESC');
  });

  it('não bate em order_items quando lista é vazia', async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const { listAll } = await import('@/data/repositories/orderRepository');

    await listAll();
    expect(mockDb.select).toHaveBeenCalledTimes(1);
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

describe('orderRepository.create (modal Novo Pedido)', () => {
  it('cria pedido vazio + revisão 1 com items_json=[]', async () => {
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
    expect(payload.queries[0].sql).toContain("'novo'");
    expect(payload.queries[0].params).toContain('João Silva');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_revisions');
    expect(payload.queries[1].sql).toContain("'[]'");
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

  it('retorna o orderId gerado (uuid)', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { create } = await import('@/data/repositories/orderRepository');

    const id = await create('Cliente Teste');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('orderRepository.createWithItems', () => {
  it('cria orders + N items + revisão 1 numa única transação', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1, 1, 1] });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    await createWithItems({
      id: 'o1',
      label: 'João Silva',
      customerName: 'João Silva',
      items: [
        { position: 0, productId: 'prod1', patternId: 'pat1' },
        { position: 1, productId: 'prod1' },
      ],
    });

    expect(invoke).toHaveBeenCalledOnce();
    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    // 1 INSERT orders + 2 INSERT items + 1 INSERT revisions
    expect(payload.queries).toHaveLength(4);
    expect(payload.queries[0].sql).toContain('INSERT INTO orders');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_items');
    expect(payload.queries[2].sql).toContain('INSERT INTO order_items');
    expect(payload.queries[3].sql).toContain('INSERT INTO order_revisions');
  });

  it('snapshot da revisão 1 inclui os items recém-criados', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1, 1] });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    await createWithItems({
      id: 'o2',
      label: 'L',
      items: [{ position: 0, productId: 'prod1', fields: { nome: 'Ana' } }],
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    const revisionInsert = payload.queries[payload.queries.length - 1];
    // items_json é o 3º param (index 2): revisionId, orderId, items_json
    const itemsJson = revisionInsert.params[2] as string;
    const items = JSON.parse(itemsJson) as Array<Record<string, unknown>>;
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('prod1');
    expect(items[0].fields).toEqual({ nome: 'Ana' });
  });

  it('aceita pedido sem items (zero broches)', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    await createWithItems({
      id: 'o-empty',
      label: 'Vazio',
      items: [],
    });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    // 1 orders + 0 items + 1 revisions
    expect(payload.queries).toHaveLength(2);
    expect(payload.queries[0].sql).toContain('INSERT INTO orders');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_revisions');
  });

  it('propaga TransactionError se transação falha', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 0,
      message: 'UNIQUE constraint failed: orders.id',
    });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    await expect(createWithItems({ id: 'dup', label: 'L', items: [] })).rejects.toThrow(
      /query\[0\].*UNIQUE/
    );
  });

  // ── Onda 14b-schema (migration v12) — boardCanvasJson ─────────────────────
  it('persiste boardCanvasJson em orders.board_canvas_json e order_revisions.board_canvas_json', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1, 1] });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    const snapshot = '{"version":"6","objects":[{"id":"x"}]}';
    await createWithItems({
      id: 'o-snap',
      label: 'L',
      items: [{ position: 0, productId: 'prod1' }],
      boardCanvasJson: snapshot,
    });

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    const ordersInsert = payload.queries[0];
    expect(ordersInsert.sql).toContain('board_canvas_json');
    // Params: [id, label, customerName, boardCanvasJson]
    expect(ordersInsert.params[3]).toBe(snapshot);

    const revisionsInsert = payload.queries[payload.queries.length - 1];
    expect(revisionsInsert.sql).toContain('board_canvas_json');
    // Params: [revisionId, orderId, itemsJson, boardCanvasJson]
    expect(revisionsInsert.params[3]).toBe(snapshot);
  });

  it('default boardCanvasJson é "{}" quando não passado', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { createWithItems } = await import('@/data/repositories/orderRepository');

    await createWithItems({ id: 'o-default', label: 'L', items: [] });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    expect(payload.queries[0].params[3]).toBe('{}');
    expect(payload.queries[1].params[3]).toBe('{}'); // revisão também
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
  it('roda DELETE items + N INSERTs items + UPDATE orders + INSERT revisão atomicamente', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [2, 1, 1, 1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({
      orderId: 'o1',
      items: [
        { position: 0, productId: 'prod1', patternId: 'pat1', fields: { nome: 'João V2' } },
        { position: 1, productId: 'prod1' },
      ],
    });

    expect(invoke).toHaveBeenCalledOnce();
    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    // 1 DELETE + 2 INSERT items + 1 UPDATE orders + 1 INSERT revisions = 5
    expect(payload.queries).toHaveLength(5);
    expect(payload.queries[0].sql).toContain('DELETE FROM order_items');
    expect(payload.queries[1].sql).toContain('INSERT INTO order_items');
    expect(payload.queries[2].sql).toContain('INSERT INTO order_items');
    expect(payload.queries[3].sql).toContain('UPDATE orders');
    expect(payload.queries[4].sql).toContain('INSERT INTO order_revisions');
    expect(payload.queries[4].sql).toContain('COALESCE(MAX(number), 0) + 1');
  });

  it('preserva status do pedido (não altera) e marca is_approved=0', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [0, 1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({ orderId: 'o1', items: [] });

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ sql: string }> }];
    // UPDATE orders (sem items, queries[1]) não toca em status
    const updateOrders = payload.queries.find((q) => q.sql.includes('UPDATE orders'));
    expect(updateOrders?.sql).not.toContain('status =');
    // INSERT revisions com is_approved=0
    const insertRevision = payload.queries.find((q) =>
      q.sql.includes('INSERT INTO order_revisions')
    );
    expect(insertRevision?.sql).toContain('0, unixepoch()');
  });

  it('snapshot da revisão captura os items novos', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1, 1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({
      orderId: 'o1',
      items: [{ position: 0, productId: 'prod1', fields: { nome: 'Z' } }],
    });

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    const insertRevision = payload.queries.find((q) =>
      q.sql.includes('INSERT INTO order_revisions')
    );
    expect(insertRevision).toBeDefined();
    // items_json é o 3º param (index 2): revisionId, orderId, items_json, orderId
    const itemsJson = insertRevision!.params[2] as string;
    const items = JSON.parse(itemsJson) as Array<Record<string, unknown>>;
    expect(items[0].productId).toBe('prod1');
    expect(items[0].fields).toEqual({ nome: 'Z' });
  });

  it('propaga TransactionError com queryIndex apontando para a falha', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 1,
      message: 'UNIQUE constraint failed: order_revisions.order_id, order_revisions.number',
    });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await expect(saveRevision({ orderId: 'o1', items: [] })).rejects.toMatchObject({
      queryIndex: 1,
    });
  });

  // ── Onda 14b-schema (migration v12) — boardCanvasJson ─────────────────────
  it('atualiza orders.board_canvas_json e persiste em order_revisions.board_canvas_json', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    const snapshot = '{"version":"6","objects":[{"id":"y"}]}';
    await saveRevision({
      orderId: 'o1',
      items: [],
      boardCanvasJson: snapshot,
    });

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    const updateOrders = payload.queries.find((q) => q.sql.includes('UPDATE orders'));
    expect(updateOrders?.sql).toContain('board_canvas_json = ?');
    expect(updateOrders?.params[0]).toBe(snapshot);

    const insertRevision = payload.queries.find((q) =>
      q.sql.includes('INSERT INTO order_revisions')
    );
    expect(insertRevision?.sql).toContain('board_canvas_json');
    // params: [revisionId, orderId, itemsJson, boardCanvasJson, orderId]
    expect(insertRevision?.params[3]).toBe(snapshot);
  });

  it('default boardCanvasJson é "{}" quando não passado em saveRevision', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });
    const { saveRevision } = await import('@/data/repositories/orderRepository');

    await saveRevision({ orderId: 'o1', items: [] });

    const [, payload] = invoke.mock.calls[0] as [
      string,
      { queries: Array<{ sql: string; params: unknown[] }> },
    ];
    const updateOrders = payload.queries.find((q) => q.sql.includes('UPDATE orders'));
    expect(updateOrders?.params[0]).toBe('{}');
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

  it('parsea items_json e isApproved de cada revision', async () => {
    mockDb.select.mockResolvedValueOnce([
      makeRevisionRow('r1', 'o1', 1, [{ position: 0, productId: 'p1' }], false),
      makeRevisionRow('r2', 'o1', 2, [{ position: 0, productId: 'p2' }], true),
    ]);
    const { listByOrder } = await import('@/data/repositories/revisionRepository');

    const rows = await listByOrder('o1');
    expect(rows[0].items).toEqual([{ position: 0, productId: 'p1' }]);
    expect(rows[0].isApproved).toBe(false);
    expect(rows[1].isApproved).toBe(true);
  });

  it('items=[] quando items_json é vazio ou inválido', async () => {
    mockDb.select.mockResolvedValueOnce([
      { ...makeRevisionRow('r1', 'o1', 1), itemsJson: '[]' },
      { ...makeRevisionRow('r2', 'o1', 2), itemsJson: 'invalid-json' },
    ]);
    const { listByOrder } = await import('@/data/repositories/revisionRepository');

    const rows = await listByOrder('o1');
    expect(rows[0].items).toEqual([]);
    expect(rows[1].items).toEqual([]);
  });

  // ── Onda 14b-schema (migration v12) ───────────────────────────────────────
  it('lê boardCanvasJson da coluna board_canvas_json', async () => {
    const snapshot = '{"version":"6","objects":[{"id":"z"}]}';
    mockDb.select.mockResolvedValueOnce([
      { ...makeRevisionRow('r1', 'o1', 1), boardCanvasJson: snapshot },
    ]);
    const { listByOrder } = await import('@/data/repositories/revisionRepository');

    const rows = await listByOrder('o1');
    expect(rows[0].boardCanvasJson).toBe(snapshot);

    const [sql] = mockDb.select.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('board_canvas_json');
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
  label: string;
  status: string;
  exportedPngPath: string | null;
  exportedSvgPaths: string | null;
  customerName: string | null;
  olistOrderId: string | null;
  marketplace: string | null;
  folderPath: string | null;
  archived: number;
  /** Onda 14b-schema (v12). */
  boardCanvasJson: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

function makeOrderRow(id: string, status: string, updatedAt: number): OrderRowMock {
  return {
    id,
    label: `Order ${id}`,
    status,
    exportedPngPath: null,
    exportedSvgPaths: null,
    customerName: null,
    olistOrderId: null,
    marketplace: null,
    folderPath: null,
    archived: 0,
    boardCanvasJson: '{}',
    createdAt: 0,
    updatedAt,
    deletedAt: null,
  };
}

interface ItemRowMock {
  id: string;
  orderId: string;
  position: number;
  productId: string | null;
  patternId: string | null;
  materialId: string | null;
  fields: string;
  canvasJson: string;
  createdAt: number;
  updatedAt: number;
}

function makeItemRow(
  id: string,
  orderId: string,
  position: number,
  productId: string | null = null,
  patternId: string | null = null,
  materialId: string | null = null
): ItemRowMock {
  return {
    id,
    orderId,
    position,
    productId,
    patternId,
    materialId,
    fields: '{}',
    canvasJson: '{}',
    createdAt: 0,
    updatedAt: 0,
  };
}

interface RevisionRowMock {
  id: string;
  orderId: string;
  number: number;
  itemsJson: string;
  /** Onda 14b-schema (v12). */
  boardCanvasJson: string;
  exportedPngPath: string | null;
  isApproved: number;
  createdAt: number;
}

function makeRevisionRow(
  id: string,
  orderId: string,
  number: number,
  items: Array<Record<string, unknown>> = [],
  isApproved = false
): RevisionRowMock {
  return {
    id,
    orderId,
    number,
    itemsJson: JSON.stringify(items),
    boardCanvasJson: '{}',
    exportedPngPath: null,
    isApproved: isApproved ? 1 : 0,
    createdAt: 1700000000 + number,
  };
}
