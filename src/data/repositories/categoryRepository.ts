import { getDb } from '../client';

export interface Category {
  id: string;
  name: string;
  scope: string;
  color: string | null;
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    'SELECT id, name, scope, color FROM categories ORDER BY scope, name'
  );
}

export async function getCategoriesByScope(scope: string): Promise<Category[]> {
  const db = await getDb();
  return db.select<Category[]>(
    'SELECT id, name, scope, color FROM categories WHERE scope = ? ORDER BY name',
    [scope]
  );
}
