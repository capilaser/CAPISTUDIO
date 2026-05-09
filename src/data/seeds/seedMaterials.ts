import type Database from '@tauri-apps/plugin-sql';

const FAMILIES = [
  { id: 'abs-escovado', label: 'ABS Escovado', brushed: true },
  { id: 'acrilico-espelhado', label: 'Acrílico Espelhado', brushed: false },
  { id: 'acrilico-solido', label: 'Acrílico Sólido', brushed: false },
] as const;

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
  {
    id: 'acrilico-espelhado-dourado',
    familyId: 'acrilico-espelhado',
    label: 'Dourado',
    swatch: '#d4af37',
    pngPath: 'materials/acrilico-espelhado-dourado.png',
    fallbackStops: [
      { offset: '0%', color: '#f0d985' },
      { offset: '48%', color: '#d4af37' },
      { offset: '100%', color: '#9c8128' },
    ],
  },
  {
    id: 'acrilico-espelhado-prata',
    familyId: 'acrilico-espelhado',
    label: 'Prata',
    swatch: '#c0c0c0',
    pngPath: 'materials/acrilico-espelhado-prata.png',
    fallbackStops: [
      { offset: '0%', color: '#e8e8e8' },
      { offset: '48%', color: '#c0c0c0' },
      { offset: '100%', color: '#8a8a8a' },
    ],
  },
  {
    id: 'acrilico-espelhado-rose-gold',
    familyId: 'acrilico-espelhado',
    label: 'Rose Gold',
    swatch: '#b76e79',
    pngPath: 'materials/acrilico-espelhado-rose-gold.png',
    fallbackStops: [
      { offset: '0%', color: '#e8b4be' },
      { offset: '48%', color: '#b76e79' },
      { offset: '100%', color: '#864e58' },
    ],
  },
  {
    id: 'acrilico-solido-branco',
    familyId: 'acrilico-solido',
    label: 'Branco',
    swatch: '#f5f5f5',
    pngPath: 'materials/acrilico-solido-branco.png',
    fallbackStops: [
      { offset: '0%', color: '#fafafa' },
      { offset: '48%', color: '#f5f5f5' },
      { offset: '100%', color: '#e8e8e8' },
    ],
  },
  {
    id: 'acrilico-solido-preto',
    familyId: 'acrilico-solido',
    label: 'Preto',
    swatch: '#1a1a1a',
    pngPath: 'materials/acrilico-solido-preto.png',
    fallbackStops: [
      { offset: '0%', color: '#2a2a2a' },
      { offset: '48%', color: '#1a1a1a' },
      { offset: '100%', color: '#0d0d0d' },
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
