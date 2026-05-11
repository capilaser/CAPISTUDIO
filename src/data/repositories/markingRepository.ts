import { getDb } from '../client';
import { assertValidMachines, assertValidOperation, type Operation } from './_export-validation';

export interface Marking {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  /** Onda 9: FK lógica → categories.id. Null = marcação sem categoria. */
  categoryId: string | null;
  /** Onda 9: operação de produção. Default 'marcacao'. */
  operation: Operation;
  /** Onda 9: machine ids (1-3). Validado em runtime. */
  machines: string[];
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
  categoryId: string | null;
  operation: string;
  machines: string; // JSON string
  createdAt: number;
  deletedAt: number | null;
}

function toMarking(row: MarkingRow): Marking {
  const machines = JSON.parse(row.machines) as unknown;
  const machinesArr: string[] = Array.isArray(machines) ? (machines as string[]) : [];
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : null,
    operation: row.operation as Operation,
    machines: machinesArr,
  };
}

/** List all active markings (soft-deleted excluded). */
export async function list(): Promise<Marking[]> {
  const db = await getDb();
  const rows = await db.select<MarkingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, category_id as categoryId,
            operation, machines,
            created_at as createdAt, deleted_at as deletedAt
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
            tags, metadata, category_id as categoryId,
            operation, machines,
            created_at as createdAt, deleted_at as deletedAt
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
  /** Onda 9: FK → categories.id. Omit ou null = sem categoria. */
  categoryId?: string | null;
  /** Onda 9: 'corte' | 'marcacao' | 'gravacao'. Default 'marcacao'. */
  operation?: Operation;
  /** Onda 9: machine ids (1-3). Obrigatório (validado em runtime). */
  machines: string[];
}

/** Insert a new marking. Throws on duplicate id ou em violação de operation/machines. */
export async function create(input: CreateMarkingInput): Promise<void> {
  const operation = input.operation ?? 'marcacao';
  assertValidOperation(operation, `markingRepository.create(${input.id})`);
  assertValidMachines(input.machines, `markingRepository.create(${input.id})`);

  const db = await getDb();
  await db.execute(
    `INSERT INTO markings
       (id, name, file_path, thumbnail_path, width_mm, height_mm, tags, metadata, category_id, operation, machines, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
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
      operation,
      JSON.stringify(input.machines),
    ]
  );
}

/**
 * Lista marcações filtradas por categoria. Espelha engravingRepository.listByCategory.
 *   - string id          → apenas marcações daquela categoria
 *   - null               → apenas marcações SEM categoria (legacy)
 *   - undefined          → equivalente a `list()` (todas as ativas)
 */
export async function listByCategory(categoryId: string | null | undefined): Promise<Marking[]> {
  if (categoryId === undefined) return list();

  const db = await getDb();
  if (categoryId === null) {
    const rows = await db.select<MarkingRow[]>(
      `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
              width_mm as widthMm, height_mm as heightMm,
              tags, metadata, category_id as categoryId,
              operation, machines,
              created_at as createdAt, deleted_at as deletedAt
       FROM markings
       WHERE deleted_at IS NULL AND category_id IS NULL
       ORDER BY name`
    );
    return rows.map(toMarking);
  }
  const rows = await db.select<MarkingRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, category_id as categoryId,
            operation, machines,
            created_at as createdAt, deleted_at as deletedAt
     FROM markings
     WHERE deleted_at IS NULL AND category_id = ?
     ORDER BY name`,
    [categoryId]
  );
  return rows.map(toMarking);
}

/** Soft-delete a marking by id. No-op if already deleted. */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE markings SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
