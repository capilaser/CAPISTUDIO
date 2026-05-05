import type Database from '@tauri-apps/plugin-sql';

// Source: v1-data/svg-categories.json
// All SVG filename assignments map to category "fundo" (scope: svg-pattern).
const CATEGORIES = [{ id: 'fundo', name: 'Fundo', scope: 'svg-pattern', color: null }] as const;

export async function seedCategories(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const cat of CATEGORIES) {
    const result = await db.execute(
      'INSERT OR IGNORE INTO categories (id, name, scope, color) VALUES (?, ?, ?, ?)',
      [cat.id, cat.name, cat.scope, cat.color]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
