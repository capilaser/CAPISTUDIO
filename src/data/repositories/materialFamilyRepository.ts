import { getDb } from '../client';

export interface MaterialFamily {
  id: string;
  label: string;
  brushed: boolean;
}

interface MaterialFamilyRow {
  id: string;
  label: string;
  brushed: number; // SQLite integer: 0 | 1
}

function toMaterialFamily(row: MaterialFamilyRow): MaterialFamily {
  return { ...row, brushed: row.brushed === 1 };
}

export async function listFamilies(): Promise<MaterialFamily[]> {
  const db = await getDb();
  const rows = await db.select<MaterialFamilyRow[]>(
    'SELECT id, label, brushed FROM material_families ORDER BY label'
  );
  return rows.map(toMaterialFamily);
}
