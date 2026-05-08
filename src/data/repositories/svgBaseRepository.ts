import { getDb } from '../client';

export interface SvgBase {
  id: string;
  name: string;
  productId: string | null;
  filePath: string;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  createdAt: number;
}

interface SvgBaseRow {
  id: string;
  name: string;
  productId: string | null;
  filePath: string;
  widthMm: number | null;
  heightMm: number | null;
  tags: string; // JSON string
  createdAt: number;
}

function toSvgBase(row: SvgBaseRow): SvgBase {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
  };
}

/** List all svg bases. */
export async function list(): Promise<SvgBase[]> {
  const db = await getDb();
  const rows = await db.select<SvgBaseRow[]>(
    `SELECT id, name, product_id as productId, file_path as filePath,
            width_mm as widthMm, height_mm as heightMm,
            tags, created_at as createdAt
     FROM svg_bases
     ORDER BY name`
  );
  return rows.map(toSvgBase);
}

/** Get a single svg base by id, or null if not found. */
export async function getById(id: string): Promise<SvgBase | null> {
  const db = await getDb();
  const rows = await db.select<SvgBaseRow[]>(
    `SELECT id, name, product_id as productId, file_path as filePath,
            width_mm as widthMm, height_mm as heightMm,
            tags, created_at as createdAt
     FROM svg_bases
     WHERE id = ?`,
    [id]
  );
  return rows[0] ? toSvgBase(rows[0]) : null;
}

export interface CreateSvgBaseInput {
  id: string;
  name: string;
  productId?: string;
  filePath: string;
  widthMm?: number;
  heightMm?: number;
  tags?: string[];
}

/** Insert a new svg base. Throws on duplicate id. */
export async function create(input: CreateSvgBaseInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO svg_bases
       (id, name, product_id, file_path, width_mm, height_mm, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    [
      input.id,
      input.name,
      input.productId ?? null,
      input.filePath,
      input.widthMm ?? null,
      input.heightMm ?? null,
      JSON.stringify(input.tags ?? []),
    ]
  );
}

/**
 * Hard-delete a svg base by id.
 *
 * NOTE: svg_bases has no deleted_at column (schema from migration 0000),
 * so this is a physical DELETE, not a soft-delete. Revisit if the schema
 * gains a deleted_at column in a future wave.
 */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM svg_bases WHERE id = ?`, [id]);
}
