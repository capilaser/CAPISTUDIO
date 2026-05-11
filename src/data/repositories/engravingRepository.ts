import { getDb } from '../client';

export interface Engraving {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  /** Onda 8.5: FK lógica → categories.id. Null = gravação sem categoria. */
  categoryId: string | null;
  createdAt: number;
  deletedAt: number | null;
}

interface EngravingRow {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string; // JSON string
  metadata: string | null; // JSON string
  categoryId: string | null;
  createdAt: number;
  deletedAt: number | null;
}

function toEngraving(row: EngravingRow): Engraving {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  };
}

/** List all active engravings (soft-deleted excluded). */
export async function list(): Promise<Engraving[]> {
  const db = await getDb();
  const rows = await db.select<EngravingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, category_id as categoryId,
            created_at as createdAt, deleted_at as deletedAt
     FROM engravings
     WHERE deleted_at IS NULL
     ORDER BY name`
  );
  return rows.map(toEngraving);
}

/** Get a single engraving by id, or null if not found / deleted. */
export async function getById(id: string): Promise<Engraving | null> {
  const db = await getDb();
  const rows = await db.select<EngravingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, category_id as categoryId,
            created_at as createdAt, deleted_at as deletedAt
     FROM engravings
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toEngraving(rows[0]) : null;
}

export interface CreateEngravingInput {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath?: string;
  widthMm?: number;
  heightMm?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  /** Onda 8.5: FK → categories.id. Omit ou null = sem categoria. */
  categoryId?: string | null;
}

/** Insert a new engraving. Throws on duplicate id. */
export async function create(input: CreateEngravingInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO engravings
       (id, name, file_path, thumbnail_path, width_mm, height_mm, tags, metadata, category_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    [
      input.id,
      input.name,
      input.filePath,
      input.thumbnailPath ?? null,
      input.widthMm ?? null,
      input.heightMm ?? null,
      JSON.stringify(input.tags ?? []),
      input.metadata ? JSON.stringify(input.metadata) : null,
      input.categoryId ?? null,
    ]
  );
}

/**
 * Lista gravações filtradas por categoria.
 *   - string id          → apenas gravações daquela categoria
 *   - null               → apenas gravações SEM categoria (legacy / pendentes)
 *   - undefined          → equivalente a `list()` (todas as ativas)
 *
 * Útil pro EngravingPanel (Onda 8.5) renderizar grupos por categoria.
 */
export async function listByCategory(categoryId: string | null | undefined): Promise<Engraving[]> {
  if (categoryId === undefined) return list();

  const db = await getDb();
  if (categoryId === null) {
    const rows = await db.select<EngravingRow[]>(
      `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
              width_mm as widthMm, height_mm as heightMm,
              tags, metadata, category_id as categoryId,
              created_at as createdAt, deleted_at as deletedAt
       FROM engravings
       WHERE deleted_at IS NULL AND category_id IS NULL
       ORDER BY name`
    );
    return rows.map(toEngraving);
  }
  const rows = await db.select<EngravingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, category_id as categoryId,
            created_at as createdAt, deleted_at as deletedAt
     FROM engravings
     WHERE deleted_at IS NULL AND category_id = ?
     ORDER BY name`,
    [categoryId]
  );
  return rows.map(toEngraving);
}

/** Soft-delete an engraving by id. No-op if already deleted. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE engravings SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
