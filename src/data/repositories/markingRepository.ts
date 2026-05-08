import { getDb } from '../client';

export interface Marking {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  createdAt: number;
  deletedAt: number | null;
}

interface MarkingRow {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string; // JSON string
  metadata: string | null; // JSON string
  createdAt: number;
  deletedAt: number | null;
}

function toMarking(row: MarkingRow): Marking {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  };
}

/** List all active markings (soft-deleted excluded). */
export async function list(): Promise<Marking[]> {
  const db = await getDb();
  const rows = await db.select<MarkingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, created_at as createdAt, deleted_at as deletedAt
     FROM markings
     WHERE deleted_at IS NULL
     ORDER BY name`
  );
  return rows.map(toMarking);
}

/** Get a single marking by id, or null if not found / deleted. */
export async function getById(id: string): Promise<Marking | null> {
  const db = await getDb();
  const rows = await db.select<MarkingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, created_at as createdAt, deleted_at as deletedAt
     FROM markings
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toMarking(rows[0]) : null;
}

export interface CreateMarkingInput {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath?: string;
  widthMm?: number;
  heightMm?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Insert a new marking. Throws on duplicate id. */
export async function create(input: CreateMarkingInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO markings
       (id, name, file_path, thumbnail_path, width_mm, height_mm, tags, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    [
      input.id,
      input.name,
      input.filePath,
      input.thumbnailPath ?? null,
      input.widthMm ?? null,
      input.heightMm ?? null,
      JSON.stringify(input.tags ?? []),
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );
}

/** Soft-delete a marking by id. No-op if already deleted. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE markings SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
