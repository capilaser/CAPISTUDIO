/**
 * Onda 11.A — revisionRepository
 *
 * Read-only. Escritas em `order_revisions` ficam em `orderRepository`
 * (createWithFirstRevision, saveRevision) DENTRO da mesma transação que
 * atualiza `orders` — ver ADR 017.
 *
 * Campo isApproved é declarado no schema mas só consumido pela Onda 12
 * (aprovação de pedido). Aqui está exposto pra leitura ser uniforme.
 */
import { getDb } from '../client';
import type { OrderFields } from '../schema';

export interface OrderRevision {
  id: string;
  orderId: string;
  number: number;
  fields: OrderFields;
  materialId: string | null;
  canvasJson: string;
  exportedPngPath: string | null;
  /** Onda 12: marcado true na revisão que o cliente aprovou. */
  isApproved: boolean;
  createdAt: number;
}

interface RevisionRow {
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

const SELECT_COLS = `
  id, order_id as orderId, number, fields, material_id as materialId,
  canvas_json as canvasJson, exported_png_path as exportedPngPath,
  is_approved as isApproved, created_at as createdAt
`;

function toRevision(row: RevisionRow): OrderRevision {
  return {
    id: row.id,
    orderId: row.orderId,
    number: row.number,
    fields: JSON.parse(row.fields) as OrderFields,
    materialId: row.materialId,
    canvasJson: row.canvasJson,
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

export async function count(orderId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(
    `SELECT COUNT(*) as n FROM order_revisions WHERE order_id = ?`,
    [orderId]
  );
  return rows[0]?.n ?? 0;
}
