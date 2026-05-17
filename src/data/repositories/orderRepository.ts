/**
 * Onda 11.A → Onda 13 — orderRepository
 *
 * Onda 13 (multi-broche): `orders` perdeu pattern_id/product_id/material_id/
 * fields/canvas_json — esses 5 campos viraram propriedade de cada item da
 * prancha (tabela order_items). Pedido de 1 broche = prancha com 1 item.
 * Pedido vazio = zero items.
 *
 * INVARIANTE crítica (mantida da Onda 11): toda escrita em `order_items`
 * que represente "nova versão do pedido" acontece DENTRO da mesma transação
 * SQL que cria uma linha em `order_revisions`. Snapshot dos items vai pro
 * campo items_json. Usar `executeTransaction` (ver ADR 017) — nunca
 * `db.execute()` solto pra alterar items de um pedido versionado.
 *
 * Estratégia de saveRevision: delete-all + insert-all em order_items.
 * Simples, atômico e o histórico do "antes" fica preservado na revisão
 * anterior (items_json). Sem diff incremental.
 */
import { getDb } from '../client';
import { executeTransaction, type TxParam, type TxQuery } from '../transaction';
import type { OrderFields } from '../schema';

// 6 status Kanban (idem Onda 11.C).
export type OrderStatus =
  | 'novo'
  | 'aguardando_info'
  | 'arte_enviada'
  | 'aprovado'
  | 'em_producao'
  | 'enviado';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'novo',
  'aguardando_info',
  'arte_enviada',
  'aprovado',
  'em_producao',
  'enviado',
] as const;

export type Marketplace = 'shopee' | 'mercado_livre' | 'whatsapp';

export interface OrderItem {
  id: string;
  orderId: string;
  /** 0-based. 0..4 = coluna 1 da prancha, 5..9 = coluna 2 etc. */
  position: number;
  productId: string | null;
  patternId: string | null;
  materialId: string | null;
  fields: OrderFields;
  /** JSON serializado de FabricCanvasJson do item. '{}' quando ainda vazio. */
  canvasJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface Order {
  id: string;
  label: string;
  status: OrderStatus;
  /** PNG da prancha inteira (output da última export). */
  exportedPngPath: string | null;
  /** SVGs por máquina da prancha inteira (output da última export). */
  exportedSvgPaths: string[] | null;
  customerName: string | null;
  olistOrderId: string | null;
  marketplace: Marketplace | null;
  folderPath: string | null;
  archived: boolean;
  /**
   * Onda 14b-schema (migration v12) — snapshot do canvas único da prancha
   * (com todos os broches juntos). Substitui a gambiarra da Onda 13.7 que
   * gravava em order_items[0].canvasJson. Vazio (`'{}'`) quando pedido nunca
   * foi salvo via NovoPedidoPage (criado direto pelo Kanban etc).
   */
  boardCanvasJson: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  /** Items da prancha, sempre ordenados por position asc. Vazio = pedido sem broches. */
  items: OrderItem[];
}

interface OrderRow {
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
  boardCanvasJson: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface ItemRow {
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

const SELECT_ORDER_COLS = `
  id, label, status,
  exported_png_path as exportedPngPath, exported_svg_paths as exportedSvgPaths,
  customer_name as customerName, olist_order_id as olistOrderId,
  marketplace, folder_path as folderPath, archived,
  board_canvas_json as boardCanvasJson,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
`;

const SELECT_ITEM_COLS = `
  id, order_id as orderId, position,
  product_id as productId, pattern_id as patternId, material_id as materialId,
  fields, canvas_json as canvasJson,
  created_at as createdAt, updated_at as updatedAt
`;

function parseStatus(raw: string): OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(raw) ? (raw as OrderStatus) : 'novo';
}

function parseMarketplace(raw: string | null): Marketplace | null {
  if (raw === 'shopee' || raw === 'mercado_livre' || raw === 'whatsapp') return raw;
  return null;
}

function parseExportedSvgPaths(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

function rowToItem(row: ItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.orderId,
    position: row.position,
    productId: row.productId,
    patternId: row.patternId,
    materialId: row.materialId,
    fields: JSON.parse(row.fields) as OrderFields,
    canvasJson: row.canvasJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    label: row.label,
    status: parseStatus(row.status),
    exportedPngPath: row.exportedPngPath,
    exportedSvgPaths: parseExportedSvgPaths(row.exportedSvgPaths),
    customerName: row.customerName,
    olistOrderId: row.olistOrderId,
    marketplace: parseMarketplace(row.marketplace),
    folderPath: row.folderPath,
    archived: row.archived === 1,
    boardCanvasJson: row.boardCanvasJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    items,
  };
}

// ── Items helpers ────────────────────────────────────────────────────────────

async function fetchItemsForOrders(orderIds: string[]): Promise<Map<string, OrderItem[]>> {
  const result = new Map<string, OrderItem[]>();
  if (orderIds.length === 0) return result;
  const db = await getDb();
  const placeholders = orderIds.map(() => '?').join(', ');
  const rows = await db.select<ItemRow[]>(
    `SELECT ${SELECT_ITEM_COLS}
       FROM order_items
      WHERE order_id IN (${placeholders})
   ORDER BY position ASC`,
    orderIds
  );
  for (const id of orderIds) result.set(id, []);
  for (const row of rows) {
    const item = rowToItem(row);
    const list = result.get(item.orderId);
    if (list) list.push(item);
  }
  return result;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getById(id: string): Promise<Order | null> {
  const db = await getDb();
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_ORDER_COLS} FROM orders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (!rows[0]) return null;
  const itemsByOrder = await fetchItemsForOrders([id]);
  return rowToOrder(rows[0], itemsByOrder.get(id) ?? []);
}

export interface OrderListItem {
  id: string;
  label: string;
  status: OrderStatus;
  updatedAt: number;
}

/**
 * Listagem paginada — não carrega items (uso só pra lista resumida).
 * Quem precisar dos items deve chamar getById ou listAll.
 */
export async function listPage(opts: { limit: number; offset: number }): Promise<OrderListItem[]> {
  const db = await getDb();
  const rows = await db.select<
    Array<{
      id: string;
      label: string;
      status: string;
      updatedAt: number;
    }>
  >(
    `SELECT id, label, status, updated_at as updatedAt
       FROM orders
      WHERE deleted_at IS NULL AND archived = 0
   ORDER BY updated_at DESC
      LIMIT ? OFFSET ?`,
    [opts.limit, opts.offset]
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    status: parseStatus(r.status),
    updatedAt: r.updatedAt,
  }));
}

export async function count(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(
    `SELECT COUNT(*) as n FROM orders WHERE deleted_at IS NULL AND archived = 0`
  );
  return rows[0]?.n ?? 0;
}

export async function countAll(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(`SELECT COUNT(*) as n FROM orders`);
  return rows[0]?.n ?? 0;
}

/**
 * Lista todos os pedidos ativos + carrega items de todos numa única query.
 * Usado pelo Kanban no boot. Mantém comportamento de "hidratar com items"
 * pra UI poder mostrar produto/quantidade direto.
 */
export async function listAll(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_ORDER_COLS} FROM orders
      WHERE deleted_at IS NULL AND archived = 0
   ORDER BY updated_at DESC`
  );
  const itemsByOrder = await fetchItemsForOrders(rows.map((r) => r.id));
  return rows.map((r) => rowToOrder(r, itemsByOrder.get(r.id) ?? []));
}

export async function listByStatus(
  status: OrderStatus,
  opts: { includeArchived?: boolean } = {}
): Promise<Order[]> {
  const db = await getDb();
  const includeArchived = opts.includeArchived ?? false;
  const archivedClause = includeArchived ? '' : 'AND archived = 0';
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_ORDER_COLS} FROM orders
      WHERE deleted_at IS NULL AND status = ? ${archivedClause}
   ORDER BY updated_at DESC`,
    [status]
  );
  const itemsByOrder = await fetchItemsForOrders(rows.map((r) => r.id));
  return rows.map((r) => rowToOrder(r, itemsByOrder.get(r.id) ?? []));
}

// ── Writes (atomic) ──────────────────────────────────────────────────────────

/** Input pra cada item ao criar/atualizar pedido. Sem id/orderId/timestamps. */
export interface OrderItemInput {
  position: number;
  productId?: string | null;
  patternId?: string | null;
  materialId?: string | null;
  fields?: OrderFields;
  canvasJson?: string;
}

/**
 * Atalho usado pelo modal "Novo Pedido" do Kanban.
 *
 * Cria pedido vazio: só customer_name preenchido. Zero items. A revisão 1
 * fica com items_json='[]'. Operador adiciona items no editor (Fase C).
 *
 * Retorna o `id` do pedido criado pra UI redirecionar.
 */
export async function create(customerName: string): Promise<string> {
  const trimmed = customerName.trim();
  if (trimmed.length < 2) {
    throw new Error('customerName must have at least 2 characters');
  }
  const orderId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();

  await executeTransaction([
    {
      sql: `INSERT INTO orders (
              id, label, status,
              exported_png_path, exported_svg_paths,
              customer_name, olist_order_id, marketplace, folder_path, archived,
              created_at, updated_at
            ) VALUES (?, ?, 'novo', NULL, NULL, ?, NULL, NULL, NULL, 0,
                      unixepoch(), unixepoch())`,
      params: [orderId, trimmed, trimmed],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, items_json, exported_png_path, is_approved, created_at
            ) VALUES (?, ?, 1, '[]', NULL, 0, unixepoch())`,
      params: [revisionId, orderId],
    },
  ]);

  return orderId;
}

export interface CreateOrderWithItemsInput {
  id: string;
  label: string;
  customerName?: string | null;
  items: OrderItemInput[];
  /**
   * Onda 14b-schema — snapshot do canvas da prancha. Default '{}' quando
   * não informado (operador pode salvar pedido sem canvas pré-construído,
   * ex: fluxo Kanban-first).
   */
  boardCanvasJson?: string;
}

/**
 * Cria pedido + N items + revisão 1, tudo numa única transação.
 * Snapshot da revisão 1 = items recém-inseridos (com seus ids gerados aqui).
 */
export async function createWithItems(input: CreateOrderWithItemsInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const itemsWithIds: OrderItem[] = input.items.map((it) => ({
    id: crypto.randomUUID(),
    orderId: input.id,
    position: it.position,
    productId: it.productId ?? null,
    patternId: it.patternId ?? null,
    materialId: it.materialId ?? null,
    fields: it.fields ?? {},
    canvasJson: it.canvasJson ?? '{}',
    createdAt: 0, // será sobrescrito pelo SQL default
    updatedAt: 0,
  }));

  const boardCanvasJson = input.boardCanvasJson ?? '{}';

  const queries: TxQuery[] = [
    {
      sql: `INSERT INTO orders (
              id, label, status,
              exported_png_path, exported_svg_paths,
              customer_name, olist_order_id, marketplace, folder_path, archived,
              board_canvas_json,
              created_at, updated_at
            ) VALUES (?, ?, 'novo', NULL, NULL, ?, NULL, NULL, NULL, 0, ?,
                      unixepoch(), unixepoch())`,
      params: [input.id, input.label, input.customerName ?? null, boardCanvasJson],
    },
  ];

  for (const item of itemsWithIds) {
    queries.push({
      sql: `INSERT INTO order_items (
              id, order_id, position, product_id, pattern_id, material_id,
              fields, canvas_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      params: [
        item.id,
        item.orderId,
        item.position,
        item.productId,
        item.patternId,
        item.materialId,
        JSON.stringify(item.fields),
        item.canvasJson,
      ] as TxParam[],
    });
  }

  queries.push({
    sql: `INSERT INTO order_revisions (
            id, order_id, number, items_json, board_canvas_json,
            exported_png_path, is_approved, created_at
          ) VALUES (?, ?, 1, ?, ?, NULL, 0, unixepoch())`,
    params: [revisionId, input.id, JSON.stringify(itemsWithIds), boardCanvasJson],
  });

  await executeTransaction(queries);
}

export interface SaveRevisionInput {
  orderId: string;
  items: OrderItemInput[];
  /** Onda 14b-schema — snapshot do canvas da prancha. Default '{}'. */
  boardCanvasJson?: string;
}

/**
 * Salva nova revisão da prancha. Estratégia: delete-all + insert-all em
 * order_items + INSERT em order_revisions com items_json = snapshot dos
 * items novos. Tudo numa única transação.
 *
 * Número da revisão calculado atomicamente via COALESCE(MAX(number),0)+1.
 * UNIQUE INDEX (order_id, number) protege contra race.
 *
 * Status do pedido NÃO é alterado aqui. Fase D pode promover novo→arte_enviada
 * via updateStatus em chamada separada.
 */
export async function saveRevision(input: SaveRevisionInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const itemsWithIds: OrderItem[] = input.items.map((it) => ({
    id: crypto.randomUUID(),
    orderId: input.orderId,
    position: it.position,
    productId: it.productId ?? null,
    patternId: it.patternId ?? null,
    materialId: it.materialId ?? null,
    fields: it.fields ?? {},
    canvasJson: it.canvasJson ?? '{}',
    createdAt: 0,
    updatedAt: 0,
  }));

  const queries: TxQuery[] = [
    {
      sql: `DELETE FROM order_items WHERE order_id = ?`,
      params: [input.orderId],
    },
  ];

  for (const item of itemsWithIds) {
    queries.push({
      sql: `INSERT INTO order_items (
              id, order_id, position, product_id, pattern_id, material_id,
              fields, canvas_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
      params: [
        item.id,
        item.orderId,
        item.position,
        item.productId,
        item.patternId,
        item.materialId,
        JSON.stringify(item.fields),
        item.canvasJson,
      ] as TxParam[],
    });
  }

  const boardCanvasJson = input.boardCanvasJson ?? '{}';

  queries.push({
    sql: `UPDATE orders SET board_canvas_json = ?, updated_at = unixepoch()
           WHERE id = ? AND deleted_at IS NULL`,
    params: [boardCanvasJson, input.orderId],
  });

  queries.push({
    sql: `INSERT INTO order_revisions (
            id, order_id, number, items_json, board_canvas_json,
            exported_png_path, is_approved, created_at
          )
          SELECT ?, ?, COALESCE(MAX(number), 0) + 1, ?, ?, NULL, 0, unixepoch()
            FROM order_revisions
           WHERE order_id = ?`,
    params: [
      revisionId,
      input.orderId,
      JSON.stringify(itemsWithIds),
      boardCanvasJson,
      input.orderId,
    ],
  });

  await executeTransaction(queries);
}

/**
 * Atualiza apenas o status do pedido. Não cria revisão (status é metadata
 * operacional, não snapshot). Usado pelos botões do Kanban.
 */
export async function updateStatus(orderId: string, status: OrderStatus): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET status = ?, updated_at = unixepoch()
      WHERE id = ? AND deleted_at IS NULL`,
    [status, orderId]
  );
}

export async function archiveAll(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  await db.execute(
    `UPDATE orders SET archived = 1, updated_at = unixepoch()
      WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Atualiza o PNG da prancha inteira. Output da última export.
 */
export async function setExportedPngPath(orderId: string, pngPath: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET exported_png_path = ?, updated_at = unixepoch()
      WHERE id = ? AND deleted_at IS NULL`,
    [pngPath, orderId]
  );
}

/** Soft-delete. Não toca em items ou revisions (histórico permanece). */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
