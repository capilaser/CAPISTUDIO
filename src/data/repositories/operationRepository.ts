import { getDb } from '../client';

export interface Operation {
  id: string;
  label: string;
  defaultColor: string;
}

export async function getAllOperations(): Promise<Operation[]> {
  const db = await getDb();
  return db.select<Operation[]>(
    'SELECT id, label, default_color as defaultColor FROM operations ORDER BY label'
  );
}

export async function getOperationById(id: string): Promise<Operation | null> {
  const db = await getDb();
  const rows = await db.select<Operation[]>(
    'SELECT id, label, default_color as defaultColor FROM operations WHERE id = ?',
    [id]
  );
  return rows[0] ?? null;
}
