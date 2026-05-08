import { getDb } from '../client';

export interface PatternLayer {
  id: string;
  patternId: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  svgFilePath: string | null;
  materialId: string | null;
  widthMm: number | null;
  heightMm: number | null;
  positionXmm: number;
  positionYmm: number;
  createdAt: number;
  deletedAt: number | null;
}

interface PatternLayerRow {
  id: string;
  patternId: string;
  name: string;
  zIndex: number;
  visible: number; // SQLite boolean stored as 0/1
  locked: number;
  svgFilePath: string | null;
  materialId: string | null;
  widthMm: number | null;
  heightMm: number | null;
  positionXmm: number;
  positionYmm: number;
  createdAt: number;
  deletedAt: number | null;
}

function toPatternLayer(row: PatternLayerRow): PatternLayer {
  return {
    ...row,
    visible: row.visible === 1,
    locked: row.locked === 1,
  };
}

/** List all active pattern layers for a given pattern, ordered by zIndex. */
export async function list(patternId?: string): Promise<PatternLayer[]> {
  const db = await getDb();
  if (patternId) {
    const rows = await db.select<PatternLayerRow[]>(
      `SELECT id, pattern_id as patternId, name, z_index as zIndex,
              visible, locked, svg_file_path as svgFilePath,
              material_id as materialId, width_mm as widthMm, height_mm as heightMm,
              position_x_mm as positionXmm, position_y_mm as positionYmm,
              created_at as createdAt, deleted_at as deletedAt
       FROM pattern_layers
       WHERE pattern_id = ? AND deleted_at IS NULL
       ORDER BY z_index`,
      [patternId]
    );
    return rows.map(toPatternLayer);
  }

  const rows = await db.select<PatternLayerRow[]>(
    `SELECT id, pattern_id as patternId, name, z_index as zIndex,
            visible, locked, svg_file_path as svgFilePath,
            material_id as materialId, width_mm as widthMm, height_mm as heightMm,
            position_x_mm as positionXmm, position_y_mm as positionYmm,
            created_at as createdAt, deleted_at as deletedAt
     FROM pattern_layers
     WHERE deleted_at IS NULL
     ORDER BY pattern_id, z_index`
  );
  return rows.map(toPatternLayer);
}

/** Get a single pattern layer by id, or null if not found / deleted. */
export async function getById(id: string): Promise<PatternLayer | null> {
  const db = await getDb();
  const rows = await db.select<PatternLayerRow[]>(
    `SELECT id, pattern_id as patternId, name, z_index as zIndex,
            visible, locked, svg_file_path as svgFilePath,
            material_id as materialId, width_mm as widthMm, height_mm as heightMm,
            position_x_mm as positionXmm, position_y_mm as positionYmm,
            created_at as createdAt, deleted_at as deletedAt
     FROM pattern_layers
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toPatternLayer(rows[0]) : null;
}

export interface CreatePatternLayerInput {
  id: string;
  patternId: string;
  name: string;
  zIndex?: number;
  visible?: boolean;
  locked?: boolean;
  svgFilePath?: string;
  materialId?: string;
  widthMm?: number;
  heightMm?: number;
  positionXmm?: number;
  positionYmm?: number;
}

/** Insert a new pattern layer. Throws on duplicate id. */
export async function create(input: CreatePatternLayerInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO pattern_layers
       (id, pattern_id, name, z_index, visible, locked,
        svg_file_path, material_id, width_mm, height_mm,
        position_x_mm, position_y_mm, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    [
      input.id,
      input.patternId,
      input.name,
      input.zIndex ?? 0,
      (input.visible ?? true) ? 1 : 0,
      (input.locked ?? false) ? 1 : 0,
      input.svgFilePath ?? null,
      input.materialId ?? null,
      input.widthMm ?? null,
      input.heightMm ?? null,
      input.positionXmm ?? 0,
      input.positionYmm ?? 0,
    ]
  );
}

/** Soft-delete a pattern layer by id. No-op if already deleted. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE pattern_layers SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
