import { getDb } from '../client';

export interface Applique {
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

interface AppliqueRow {
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

function toApplique(row: AppliqueRow): Applique {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
  };
}

/** List all active appliques (soft-deleted excluded). */
export async function list(): Promise<Applique[]> {
  const db = await getDb();
  const rows = await db.select<AppliqueRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, created_at as createdAt, deleted_at as deletedAt
     FROM appliques
     WHERE deleted_at IS NULL
     ORDER BY name`
  );
  return rows.map(toApplique);
}

/** Get a single applique by id, or null if not found / deleted. */
export async function getById(id: string): Promise<Applique | null> {
  const db = await getDb();
  const rows = await db.select<AppliqueRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, created_at as createdAt, deleted_at as deletedAt
     FROM appliques
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toApplique(rows[0]) : null;
}

export interface CreateAppliqueInput {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath?: string;
  widthMm?: number;
  heightMm?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** Insert a new applique. Throws on duplicate id. */
export async function create(input: CreateAppliqueInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO appliques
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

/** Soft-delete an applique by id. No-op if already deleted. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE appliques SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
