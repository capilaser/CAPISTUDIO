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
  name: string;
  tags: string[];
  canvasJsonLength: number;
  updatedAt: number;
}

interface PatternSummaryRow {
  id: string;
  productId: string;
  name: string;
  tags: string;
  canvasJsonLength: number;
  updatedAt: number;
}

/**
 * Lightweight listing for /padroes (lista) e /dev/db-check.
 * Inclui name e tags (necessários pra UI da listagem) mas não parsea
 * canvas_json (pesado).
 */
export async function getAllPatternSummaries(): Promise<PatternSummary[]> {
  const db = await getDb();
  const rows = await db.select<PatternSummaryRow[]>(
    `SELECT id, product_id as productId, name, tags,
            length(canvas_json) as canvasJsonLength,
            updated_at as updatedAt
       FROM patterns
      WHERE deleted_at IS NULL
   ORDER BY updated_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    name: row.name,
    tags: safeParseTags(row.tags),
    canvasJsonLength: row.canvasJsonLength,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Onda 14c — listagem completa pra UI de /padroes: inclui canvas_json parseado
 * pra permitir renderizar thumbnail. Mais pesada que getAllPatternSummaries —
 * uso reservado pra UI da listagem (poucos patterns), não pra diagnóstico.
 */
export interface PatternListEntry {
  id: string;
  productId: string;
  name: string;
  tags: string[];
  canvasJson: FabricCanvasJson | null;
  updatedAt: number;
}

interface PatternListEntryRow {
  id: string;
  productId: string;
  name: string;
  tags: string;
  canvasJson: string;
  updatedAt: number;
}

export async function getAllPatternsForListing(): Promise<PatternListEntry[]> {
  const db = await getDb();
  const rows = await db.select<PatternListEntryRow[]>(
    `SELECT id, product_id as productId, name, tags,
            canvas_json as canvasJson, updated_at as updatedAt
       FROM patterns
      WHERE deleted_at IS NULL
   ORDER BY updated_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    name: row.name,
    tags: safeParseTags(row.tags),
    canvasJson: safeParseCanvasJson(row.canvasJson),
    updatedAt: row.updatedAt,
  }));
}

function safeParseCanvasJson(raw: string): FabricCanvasJson | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'objects' in parsed &&
      Array.isArray((parsed as { objects: unknown }).objects)
    ) {
      return parsed as FabricCanvasJson;
    }
    return null;
  } catch {
    return null;
  }
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export async function getPatternById(id: string): Promise<Pattern | null> {
  const db = await getDb();
  const rows = await db.select<PatternRow[]>(
    `SELECT ${SELECT_COLS} FROM patterns WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toPattern(rows[0]) : null;
}

/** Summary used by LoadPatternDialog — name + updatedAt, no canvas_json parse. */
export interface PatternListItem {
  id: string;
  name: string;
  updatedAt: number;
}

/**
 * Lists all active patterns for a given product, ordered by most-recently updated.
 * Filters by product_id — does NOT return patterns from other products (e.g. broche).
 */
export async function listByProduct(productId: string): Promise<PatternListItem[]> {
  const db = await getDb();
  return db.select<PatternListItem[]>(
    `SELECT id, name, updated_at as updatedAt
       FROM patterns
      WHERE product_id = ? AND deleted_at IS NULL
      ORDER BY updated_at DESC`,
    [productId]
  );
}

/**
 * Inserts a new pattern record with a caller-supplied UUID.
 * Does NOT upsert — throws on duplicate id (use crypto.randomUUID() to avoid).
 * Returns the id passed in (for chaining / test assertions).
 *
 * tags é opcional; omitido = '[]'. Mantém ordem posicional dos callers antigos
 * (id, productId, name, canvasJson) — params[4] continua sendo canvasJson e
 * params[5] passa a ser o tags JSON.
 */
export async function insertPattern(
  id: string,
  productId: string,
  name: string,
  canvasJson: string,
  tags: string[] = []
): Promise<string> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO patterns (id, product_id, name, wave, canvas_json, tags)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, productId, name, 8, canvasJson, JSON.stringify(tags)]
  );
  return id;
}

/**
 * Atualiza campos editáveis de um pattern existente. Só toca os campos passados.
 * Sempre bumpa updated_at. Não muda productId (pattern é fixo no produto).
 */
export async function updatePattern(
  id: string,
  fields: { name?: string; canvasJson?: string; tags?: string[] }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.name !== undefined) {
    sets.push('name = ?');
    params.push(fields.name);
  }
  if (fields.canvasJson !== undefined) {
    sets.push('canvas_json = ?');
    params.push(fields.canvasJson);
  }
  if (fields.tags !== undefined) {
    sets.push('tags = ?');
    params.push(JSON.stringify(fields.tags));
  }
  if (sets.length === 0) return;
  sets.push('updated_at = unixepoch()');
  params.push(id);
  const db = await getDb();
  await db.execute(
    `UPDATE patterns SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params
  );
}

/**
 * Soft-delete: marca deleted_at. Todos os SELECTs filtram por deleted_at IS NULL
 * então o pattern some da listagem mas a linha permanece (auditoria).
 */
export async function softDeletePattern(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE patterns SET deleted_at = unixepoch(), updated_at = unixepoch()
       WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}

/**
 * Duplica um pattern existente com novo id/name. Copia canvas_json, tags,
 * description, wave, defaultMaterialId. NÃO copia isFavorite/isValidated
 * (cópia começa "fria"). updated_at = now.
 *
 * Throws se sourceId não existir ou estiver soft-deleted.
 */
export async function duplicatePattern(
  sourceId: string,
  newId: string,
  newName: string
): Promise<string> {
  const source = await getPatternById(sourceId);
  if (!source) throw new Error(`Pattern '${sourceId}' não encontrado.`);
  const db = await getDb();
  await db.execute(
    `INSERT INTO patterns (id, product_id, name, description, wave, tags,
                           canvas_json, default_material_id,
                           is_favorite, is_validated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [
      newId,
      source.productId,
      newName,
      source.description,
      source.wave,
      JSON.stringify(source.tags),
      JSON.stringify(source.canvasJson),
      source.defaultMaterialId,
    ]
  );
  return newId;
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
