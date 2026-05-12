/**
 * Onda 11.A — orderRepository
 *
 * Gerencia pedidos. Os 4 campos "snapshot" (fields, materialId, canvasJson,
 * exportedPngPath) são denormalizados: ficam em `orders` como "última revisão"
 * E são duplicados em `order_revisions` como histórico imutável.
 *
 * INVARIANTE crítica: toda escrita desses 4 campos em `orders` acontece DENTRO
 * da mesma transação SQL que cria a revisão correspondente. Usar a infra
 * `executeTransaction` (ver `data/transaction.ts` + ADR 017) — nunca chamar
 * `db.execute()` solto pra atualizar esses campos.
 *
 * Status: `pendente` (default, herdado do migration 0000) | `enviado_cliente`
 * (Fase E). `aprovado` virá em Onda 12 (junto com leitura/escrita do flag
 * is_approved em order_revisions).
 */
import { getDb } from '../client';
import { executeTransaction, type TxParam } from '../transaction';
import type { OrderFields } from '../schema';

export type OrderStatus = 'pendente' | 'enviado_cliente';

export interface Order {
  id: string;
  patternId: string;
  productId: string;
  label: string;
  fields: OrderFields;
  materialId: string | null;
  status: OrderStatus;
  /** Snapshot da última revisão. Espelha `order_revisions[last].canvas_json`. */
  canvasJson: string;
  /** Path do PNG da última revisão. Null = nunca exportado. */
  exportedPngPath: string | null;
  exportedSvgPaths: string[] | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface OrderRow {
  id: string;
  patternId: string;
  productId: string;
  label: string;
  fields: string;
  materialId: string | null;
  status: string;
  canvasJson: string;
  exportedPngPath: string | null;
  exportedSvgPaths: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const SELECT_COLS = `
  id, pattern_id as patternId, product_id as productId, label,
  fields, material_id as materialId, status,
  canvas_json as canvasJson, exported_png_path as exportedPngPath,
  exported_svg_paths as exportedSvgPaths,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
`;

function parseStatus(raw: string): OrderStatus {
  if (raw === 'enviado_cliente') return 'enviado_cliente';
  return 'pendente';
}

function toOrder(row: OrderRow): Order {
  let exportedSvgPaths: string[] | null = null;
  if (row.exportedSvgPaths) {
    try {
      const parsed = JSON.parse(row.exportedSvgPaths) as unknown;
      if (Array.isArray(parsed)) exportedSvgPaths = parsed as string[];
    } catch {
      exportedSvgPaths = null;
    }
  }
  return {
    id: row.id,
    patternId: row.patternId,
    productId: row.productId,
    label: row.label,
    fields: JSON.parse(row.fields) as OrderFields,
    materialId: row.materialId,
    status: parseStatus(row.status),
    canvasJson: row.canvasJson,
    exportedPngPath: row.exportedPngPath,
    exportedSvgPaths,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getById(id: string): Promise<Order | null> {
  const db = await getDb();
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_COLS} FROM orders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toOrder(rows[0]) : null;
}

export interface OrderListItem {
  id: string;
  label: string;
  status: OrderStatus;
  updatedAt: number;
}

/**
 * Listagem paginada — Fase D vai chamar com page size 50.
 * Ordena por updated_at desc (mais recente primeiro).
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
      WHERE deleted_at IS NULL
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
    `SELECT COUNT(*) as n FROM orders WHERE deleted_at IS NULL`
  );
  return rows[0]?.n ?? 0;
}

// ── Writes (atomic) ──────────────────────────────────────────────────────────

export interface CreateOrderInput {
  id: string;
  patternId: string;
  productId: string;
  label: string;
  fields: OrderFields;
  materialId?: string | null;
  canvasJson: string;
}

/**
 * Cria pedido + revisão 1 atomicamente. Status inicial = 'pendente'.
 *
 * Layout da transação:
 *   1. INSERT orders (status='pendente', revisão 1 denormalizada)
 *   2. INSERT order_revisions (number=1, is_approved=0)
 *
 * Falha em qualquer query → rollback completo (nem orders nem revisão
 * persistem). Garantia provida por `executeTransaction` (ver ADR 017).
 */
export async function createWithFirstRevision(input: CreateOrderInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const fieldsJson = JSON.stringify(input.fields);
  const materialId: TxParam = input.materialId ?? null;

  await executeTransaction([
    {
      sql: `INSERT INTO orders (
              id, pattern_id, product_id, label, fields, material_id, status,
              canvas_json, exported_png_path, exported_svg_paths,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?, NULL, NULL, unixepoch(), unixepoch())`,
      params: [
        input.id,
        input.patternId,
        input.productId,
        input.label,
        fieldsJson,
        materialId,
        input.canvasJson,
      ],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, fields, material_id, canvas_json,
              exported_png_path, is_approved, created_at
            ) VALUES (?, ?, 1, ?, ?, ?, NULL, 0, unixepoch())`,
      params: [revisionId, input.id, fieldsJson, materialId, input.canvasJson],
    },
  ]);
}

export interface SaveRevisionInput {
  orderId: string;
  fields: OrderFields;
  materialId?: string | null;
  canvasJson: string;
}

/**
 * Salva nova revisão. Cria order_revisions[next] e ATUALIZA orders pra refletir
 * o snapshot da nova revisão. Número da revisão é calculado atomicamente via
 * `(SELECT COALESCE(MAX(number), 0) + 1 FROM order_revisions WHERE order_id=?)`
 * — protegido contra race por UNIQUE INDEX (order_id, number).
 *
 * Nova revisão SEMPRE entra com is_approved=0. Status do pedido NÃO é alterado
 * aqui (continua o que estava). Fase E vai adicionar transição pra
 * 'enviado_cliente'. Onda 12 vai marcar is_approved=1 em comando dedicado.
 */
export async function saveRevision(input: SaveRevisionInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const fieldsJson = JSON.stringify(input.fields);
  const materialId: TxParam = input.materialId ?? null;

  await executeTransaction([
    {
      sql: `UPDATE orders
               SET fields = ?, material_id = ?, canvas_json = ?, updated_at = unixepoch()
             WHERE id = ? AND deleted_at IS NULL`,
      params: [fieldsJson, materialId, input.canvasJson, input.orderId],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, fields, material_id, canvas_json,
              exported_png_path, is_approved, created_at
            )
            SELECT ?, ?, COALESCE(MAX(number), 0) + 1, ?, ?, ?, NULL, 0,
                   unixepoch()
              FROM order_revisions
             WHERE order_id = ?`,
      params: [revisionId, input.orderId, fieldsJson, materialId, input.canvasJson, input.orderId],
    },
  ]);
}

/** Soft-delete. Não toca em revisions (histórico permanece). */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
