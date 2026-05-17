import type Database from '@tauri-apps/plugin-sql';

import { getDb } from '../client';
import { seedAppliques } from './seedAppliques';
import { seedCategories } from './seedCategories';
import { seedEngravings } from './seedEngravings';
import { seedFonts } from './seedFonts';
import { seedMachines } from './seedMachines';
import { seedMarkings } from './seedMarkings';
import { seedMaterials } from './seedMaterials';
import { seedOperations } from './seedOperations';
import { seedPatterns } from './seedPatterns';
import { seedProducts } from './seedProducts';
import { seedSettings } from './seedSettings';
import { seedSlotTypes } from './seedSlotTypes';
import { seedSvgBases } from './seedSvgBases';

export interface SeedResult {
  entity: string;
  inserted: number;
  skipped: number;
}

type SeedFn = (db: Database) => Promise<{ inserted: number; skipped: number }>;

const SEEDS: Array<[string, SeedFn]> = [
  ['operations', seedOperations],
  ['machines', seedMachines],
  ['slot_types', seedSlotTypes],
  ['fonts', seedFonts],
  ['categories', seedCategories],
  ['materials', seedMaterials],
  ['products', seedProducts],
  ['settings', seedSettings],
  // Onda 6a — asset banks (run after Rust seed_asset_files copies SVGs to appData)
  ['svg_bases', seedSvgBases],
  ['appliques', seedAppliques],
  // Onda 8.5 — engravings bank. Depende de seedCategories ter rodado antes
  // (FK engravings.category_id → categories.id). A ordem do array já garante.
  ['engravings', seedEngravings],
  // Onda 9 — markings bank. Estrutura pronta (array vazio); entries virão da UI.
  ['markings', seedMarkings],
  // Onda 14 — patterns Wave 1 (estruturais/posicionais) pro fluxo Arte Rápida.
  // Depende de seedProducts (FK pattern.product_id → products.id).
  ['patterns', seedPatterns],
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
