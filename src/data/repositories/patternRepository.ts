import { getDb } from '../client';
import type { FabricCanvasJson } from '../schema';

export interface Pattern {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  wave: number;
  tags: string[];
  canvasJson: FabricCanvasJson | null;
  defaultMaterialId: string | null;
  isFavorite: boolean;
  isValidated: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface PatternRow {
  id: string;
  productId: string;
  name: string;
  description: string | null;
  wave: number;
  tags: string;
  canvasJson: string;
  defaultMaterialId: string | null;
  isFavorite: number;
  isValidated: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const SELECT_COLS = `
  id, product_id as productId, name, description, wave, tags,
  canvas_json as canvasJson, default_material_id as defaultMaterialId,
  is_favorite as isFavorite, is_validated as isValidated,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
`;

function toPattern(row: PatternRow): Pattern {
  let canvasJson: FabricCanvasJson | null = null;
  try {
    const parsed = JSON.parse(row.canvasJson) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'objects' in parsed &&
      Array.isArray((parsed as { objects: unknown }).objects)
    ) {
      canvasJson = parsed as FabricCanvasJson;
    }
  } catch {
    canvasJson = null;
  }

  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    description: row.description,
    wave: row.wave,
    tags: JSON.parse(row.tags) as string[],
    canvasJson,
    defaultMaterialId: row.defaultMaterialId,
    isFavorite: row.isFavorite === 1,
    isValidated: row.isValidated === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export interface PatternSummary {
  id: string;
  productId: string;
  canvasJsonLength: number;
  updatedAt: number;
}

/**
 * Lightweight listing for diagnostics — does not parse canvas_json
 * (which can be large). Used by /dev/db-check.
 */
export async function getAllPatternSummaries(): Promise<PatternSummary[]> {
  const db = await getDb();
  return db.select<PatternSummary[]>(
    `SELECT id, product_id as productId,
            length(canvas_json) as canvasJsonLength,
            updated_at as updatedAt
       FROM patterns
      WHERE deleted_at IS NULL
   ORDER BY updated_at DESC`
  );
}

export async function getPatternById(id: string): Promise<Pattern | null> {
  const db = await getDb();
  const rows = await db.select<PatternRow[]>(
    `SELECT ${SELECT_COLS} FROM patterns WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toPattern(rows[0]) : null;
}

/**
 * Insert-or-update: writes canvas_json against `id`. On insert, fills
 * required fields with safe defaults (name is derived from the id).
 * Always bumps updated_at to current epoch.
 */
export async function upsertPatternCanvas(
  id: string,
  productId: string,
  canvasJson: string,
  fallbackName = id
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO patterns (id, product_id, name, wave, tags, canvas_json)
     VALUES (?, ?, ?, ?, '[]', ?)
     ON CONFLICT(id) DO UPDATE SET
       canvas_json = excluded.canvas_json,
       product_id = excluded.product_id,
       updated_at = unixepoch()`,
    [id, productId, fallbackName, 3, canvasJson]
  );
}
