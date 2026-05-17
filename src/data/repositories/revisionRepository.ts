/**
 * Onda 11.A → Onda 13 — revisionRepository
 *
 * Read-only. Escritas em `order_revisions` ficam em `orderRepository`
 * (createWithItems, saveRevision) DENTRO da mesma transação que altera
 * `order_items` — ver ADR 017.
 *
 * Onda 13: snapshot mudou de shape. Antes era fields+materialId+canvasJson
 * (uma arte por pedido). Agora é items_json: JSON com o array completo
 * de items naquela revisão. Cada item carrega seu próprio product/pattern/
 * material/fields/canvasJson.
 */
import { getDb } from '../client';
import type { OrderItem } from './orderRepository';

export interface OrderRevision {
  id: string;
  orderId: string;
  number: number;
  /** Snapshot dos items dessa revisão. Parsed de items_json. */
  items: OrderItem[];
  /**
   * Onda 14b-schema (migration v12) — snapshot do canvas da prancha pra
   * esta revisão. Vazio (`'{}'`) em revisões antigas que precederam v12 sem
   * backfill (json_extract retornou null).
   */
  boardCanvasJson: string;
  exportedPngPath: string | null;
  /** Onda 12: marcado true na revisão que o cliente aprovou. */
  isApproved: boolean;
  createdAt: number;
}

interface RevisionRow {
  id: string;
  orderId: string;
  number: number;
  itemsJson: string;
  boardCanvasJson: string;
  exportedPngPath: string | null;
  isApproved: number;
  createdAt: number;
}

const SELECT_COLS = `
  id, order_id as orderId, number, items_json as itemsJson,
  board_canvas_json as boardCanvasJson,
  exported_png_path as exportedPngPath,
  is_approved as isApproved, created_at as createdAt
`;

function parseItems(raw: string): OrderItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OrderItem[]) : [];
  } catch {
    return [];
  }
}

function toRevision(row: RevisionRow): OrderRevision {
  return {
    id: row.id,
    orderId: row.orderId,
    number: row.number,
    items: parseItems(row.itemsJson),
    boardCanvasJson: row.boardCanvasJson,
    exportedPngPath: row.exportedPngPath,
    isApproved: row.isApproved === 1,
    createdAt: row.createdAt,
  };
}

/**
 * Lista todas as revisões de um pedido, da mais nova pra mais antiga.
 * Fase D vai usar pra renderizar o painel "Revisões".
 */
export async function listByOrder(orderId: string): Promise<OrderRevision[]> {
  const db = await getDb();
  const rows = await db.select<RevisionRow[]>(
    `SELECT ${SELECT_COLS}
       FROM order_revisions
      WHERE order_id = ?
   ORDER BY number DESC`,
    [orderId]
  );
  return rows.map(toRevision);
}

export async function getById(id: string): Promise<OrderRevision | null> {
  const db = await getDb();
  const rows = await db.select<RevisionRow[]>(
    `SELECT ${SELECT_COLS} FROM order_revisions WHERE id = ?`,
    [id]
  );
  return rows[0] ? toRevision(rows[0]) : null;
}

/** Última revisão de um pedido (a com maior number). */
export async function getLatest(orderId: string): Promise<OrderRevision | null> {
  const db = await getDb();
  const rows = await db.select<RevisionRow[]>(
    `SELECT ${SELECT_COLS}
       FROM order_revisions
      WHERE order_id = ?
   ORDER BY number DESC
      LIMIT 1`,
    [orderId]
  );
  return rows[0] ? toRevision(rows[0]) : null;
}

/**
 * Onda 13.8 — marca a última revisão (maior number) de um pedido como
 * aprovada (is_approved=1). Idempotente: se a última revisão já está
 * aprovada, segue sem erro.
 *
 * Lança erro se o pedido não tem revisão (não deveria acontecer — pedido
 * sempre nasce com revisão 1 via createWithItems/create).
 *
 * NÃO toca em `orders` (status do Kanban é coisa separada — operador
 * decide se "aprovar" muda status pra 'aprovado' depois).
 */
export async function approveLatestRevision(orderId: string): Promise<void> {
  const db = await getDb();
  // UPDATE the revision with the max number for this order.
  // SQLite subquery handles it atomicamente.
  const result = await db.execute(
    `UPDATE order_revisions
        SET is_approved = 1
      WHERE order_id = ?
        AND number = (SELECT MAX(number) FROM order_revisions WHERE order_id = ?)`,
    [orderId, orderId]
  );
  if (result.rowsAffected === 0) {
    throw new Error(`Pedido ${orderId} sem revisões — nada pra aprovar.`);
  }
}

export async function count(orderId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(
    `SELECT COUNT(*) as n FROM order_revisions WHERE order_id = ?`,
    [orderId]
  );
  return rows[0]?.n ?? 0;
}
