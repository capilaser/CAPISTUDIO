import type Database from '@tauri-apps/plugin-sql';

// Family: ABS Escovado (PNG-first — replaces gradient-only materials from v1)
const FAMILIES = [{ id: 'abs-escovado', label: 'ABS Escovado', brushed: true }] as const;

interface FallbackStop {
  offset: string;
  color: string;
}

interface MaterialSeed {
  id: string;
  familyId: string;
  label: string;
  swatch: string;
  pngPath: string; // relative to Tauri resources dir
  fallbackStops: FallbackStop[];
}

// Fallback stops derived from v1-data/materials.json metal-escovado-* entries,
// adapted to match ABS Escovado swatches. Bronze generated manually.
const MATERIALS: MaterialSeed[] = [
  {
    id: 'abs-escovado-prata',
    familyId: 'abs-escovado',
    label: 'Prata',
    swatch: '#c9c9c3',
    pngPath: 'materials/abs-escovado-prata.png',
    fallbackStops: [
      { offset: '0%', color: '#f1f1ee' },
      { offset: '48%', color: '#c9c9c3' },
      { offset: '100%', color: '#989992' },
    ],
  },
  {
    id: 'abs-escovado-rose',
    familyId: 'abs-escovado',
    label: 'Rose Gold',
    swatch: '#d4848a',
    pngPath: 'materials/abs-escovado-rose.png',
    fallbackStops: [
      { offset: '0%', color: '#f9c9c9' },
      { offset: '48%', color: '#d4848a' },
      { offset: '100%', color: '#b06068' },
    ],
  },
  {
    id: 'abs-escovado-dourado',
    familyId: 'abs-escovado',
    label: 'Dourado',
    swatch: '#d5aa35',
    pngPath: 'materials/abs-escovado-dourado.png',
    fallbackStops: [
      { offset: '0%', color: '#ffdc70' },
      { offset: '48%', color: '#d5aa35' },
      { offset: '100%', color: '#a47d2c' },
    ],
  },
  {
    id: 'abs-escovado-bronze',
    familyId: 'abs-escovado',
    label: 'Bronze',
    swatch: '#a47d2c',
    pngPath: 'materials/abs-escovado-bronze.png',
    fallbackStops: [
      { offset: '0%', color: '#c4954a' },
      { offset: '48%', color: '#a47d2c' },
      { offset: '100%', color: '#6e521a' },
    ],
  },
];

export async function seedMaterials(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // Seed families first
  for (const family of FAMILIES) {
    await db.execute(
      'INSERT OR IGNORE INTO material_families (id, label, brushed) VALUES (?, ?, ?)',
      [family.id, family.label, family.brushed ? 1 : 0]
    );
  }

  // Seed materials
  for (const mat of MATERIALS) {
    const result = await db.execute(
      `INSERT OR IGNORE INTO materials
         (id, family_id, label, swatch, png_path, fallback_stops)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mat.id, mat.familyId, mat.label, mat.swatch, mat.pngPath, JSON.stringify(mat.fallbackStops)]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
