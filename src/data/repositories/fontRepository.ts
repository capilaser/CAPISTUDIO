import { getDb } from '../client';

export interface Font {
  id: string;
  name: string;
  category: string;
  family: string;
  source: string;
  file: string | null;
  createdAt: number;
}

export async function getAllFonts(): Promise<Font[]> {
  const db = await getDb();
  return db.select<Font[]>(
    `SELECT id, name, category, family, source, file,
            created_at as createdAt
     FROM fonts ORDER BY category, name`
  );
}

export async function getFontsByCategory(category: string): Promise<Font[]> {
  const db = await getDb();
  return db.select<Font[]>(
    `SELECT id, name, category, family, source, file,
            created_at as createdAt
     FROM fonts WHERE category = ? ORDER BY name`,
    [category]
  );
}

export async function getFirstFont(): Promise<Font | null> {
  const db = await getDb();
  const rows = await db.select<Font[]>(
    `SELECT id, name, category, family, source, file,
            created_at as createdAt
     FROM fonts ORDER BY category, name LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function getFontById(id: string): Promise<Font | null> {
  const db = await getDb();
  const rows = await db.select<Font[]>(
    `SELECT id, name, category, family, source, file,
            created_at as createdAt
     FROM fonts WHERE id = ?`,
    [id]
  );
  return rows[0] ?? null;
}
