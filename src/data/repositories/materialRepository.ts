import { getDb } from '../client';

export interface FallbackStop {
  offset: string;
  color: string;
}

export interface Material {
  id: string;
  familyId: string;
  label: string;
  swatch: string;
  pngPath: string;
  fallbackStops: FallbackStop[] | null;
}

interface MaterialRow {
  id: string;
  familyId: string;
  label: string;
  swatch: string;
  pngPath: string;
  fallbackStops: string | null; // JSON string
}

function toMaterial(row: MaterialRow): Material {
  return {
    ...row,
    fallbackStops: row.fallbackStops ? (JSON.parse(row.fallbackStops) as FallbackStop[]) : null,
  };
}

export async function getAllMaterials(): Promise<Material[]> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials ORDER BY family_id, label`
  );
  return rows.map(toMaterial);
}

export async function getMaterialsByFamily(familyId: string): Promise<Material[]> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials WHERE family_id = ? ORDER BY label`,
    [familyId]
  );
  return rows.map(toMaterial);
}

export async function getMaterialById(id: string): Promise<Material | null> {
  const db = await getDb();
  const rows = await db.select<MaterialRow[]>(
    `SELECT id, family_id as familyId, label, swatch, png_path as pngPath,
            fallback_stops as fallbackStops
     FROM materials WHERE id = ?`,
    [id]
  );
  return rows[0] ? toMaterial(rows[0]) : null;
}
