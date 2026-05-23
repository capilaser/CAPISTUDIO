import type Database from '@tauri-apps/plugin-sql';

import { getDb } from '../client';
import { seedCategories } from './seedCategories';
import { seedFonts } from './seedFonts';
import { seedMachines } from './seedMachines';
import { seedMaterials } from './seedMaterials';
import { seedOperations } from './seedOperations';
import { seedProducts } from './seedProducts';
import { seedSettings } from './seedSettings';

export interface SeedResult {
  entity: string;
  inserted: number;
  skipped: number;
}

type SeedFn = (db: Database) => Promise<{ inserted: number; skipped: number }>;

const SEEDS: Array<[string, SeedFn]> = [
  ['operations', seedOperations],
  ['machines', seedMachines],
  ['fonts', seedFonts],
  ['categories', seedCategories],
  ['materials', seedMaterials],
  ['products', seedProducts],
  ['settings', seedSettings],
];

export async function seedDatabase(): Promise<SeedResult[]> {
  const db = await getDb();
  const results: SeedResult[] = [];

  for (const [entity, fn] of SEEDS) {
    const { inserted, skipped } = await fn(db);
    results.push({ entity, inserted, skipped });
  }

  if (import.meta.env.DEV) {
    const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);
    console.info(`[seed] done — ${totalInserted} inserted, ${totalSkipped} skipped`);
  }

  return results;
}
