import { getDb } from '../client';
import { assertValidMachines, assertValidOperation, type Operation } from './_export-validation';

export interface Applique {
  id: string;
  name: string;
  filePath: string;
  thumbnailPath: string | null;
  widthMm: number | null;
  heightMm: number | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  /** Onda 9: 'corte' | 'marcacao' | 'gravacao'. */
  operation: Operation;
  /** Onda 9: machine ids (1-3). */
  machines: string[];
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
  operation: string;
  machines: string; // JSON string
  createdAt: number;
  deletedAt: number | null;
}

function toApplique(row: AppliqueRow): Applique {
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

/** List all active appliques (soft-deleted excluded). */
export async function list(): Promise<Applique[]> {
  const db = await getDb();
  const rows = await db.select<AppliqueRow[]>(
    `SELECT id, name, file_path as filePath, thumbnail_path as thumbnailPath,
            width_mm as widthMm, height_mm as heightMm,
            tags, metadata, operation, machines,
            created_at as createdAt, deleted_at as deletedAt
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
            tags, metadata, operation, machines,
            created_at as createdAt, deleted_at as deletedAt
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
  /** Onda 9: default 'corte'. */
  operation?: Operation;
  /** Onda 9: obrigatório, validado em runtime. */
  machines: string[];
}

/** Insert a new applique. Throws on duplicate id ou violação de operation/machines. */
export async function create(input: CreateAppliqueInput): Promise<void> {
  const operation = input.operation ?? 'corte';
  assertValidOperation(operation, `appliqueRepository.create(${input.id})`);
  assertValidMachines(input.machines, `appliqueRepository.create(${input.id})`);

  const db = await getDb();
  await db.execute(
    `INSERT INTO appliques
       (id, name, file_path, thumbnail_path, width_mm, height_mm, tags, metadata, operation, machines, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
    [
      input.id,
      input.name,
      input.filePath,
      input.thumbnailPath ?? null,
      input.widthMm ?? null,
      input.heightMm ?? null,
      JSON.stringify(input.tags ?? []),
      input.metadata ? JSON.stringify(input.metadata) : null,
      operation,
      JSON.stringify(input.machines),
    ]
  );
}

export interface UpdateAppliqueInput {
  name?: string;
  thumbnailPath?: string | null;
  widthMm?: number;
  heightMm?: number;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
}

/** Partial update — only the provided fields are written. No-op if id not found or deleted. */
export async function update(id: string, input: UpdateAppliqueInput): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    sets.push('name = ?');
    values.push(input.name);
  }
  if (input.thumbnailPath !== undefined) {
    sets.push('thumbnail_path = ?');
    values.push(input.thumbnailPath);
  }
  if (input.widthMm !== undefined) {
    sets.push('width_mm = ?');
    values.push(input.widthMm);
  }
  if (input.heightMm !== undefined) {
    sets.push('height_mm = ?');
    values.push(input.heightMm);
  }
  if (input.tags !== undefined) {
    sets.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.metadata !== undefined) {
    sets.push('metadata = ?');
    values.push(input.metadata !== null ? JSON.stringify(input.metadata) : null);
  }

  if (sets.length === 0) return;

  values.push(id);
  const db = await getDb();
  await db.execute(
    `UPDATE appliques SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    values
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
