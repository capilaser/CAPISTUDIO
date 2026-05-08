import type Database from '@tauri-apps/plugin-sql';

// Fonts are managed by migration 0001_curated_fonts.sql — no seeding needed here.
export async function seedFonts(_db: Database): Promise<{ inserted: number; skipped: number }> {
  return { inserted: 0, skipped: 0 };
}
