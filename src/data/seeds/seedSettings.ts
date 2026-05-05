import type Database from '@tauri-apps/plugin-sql';

// Source: v1-data/settings.json
// defaultMaterialId updated: "metal-gold" → "abs-escovado-prata" (v1 ID no longer exists).
const SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'appName', value: JSON.stringify('Capi Studio') },
  { key: 'activeProductId', value: JSON.stringify('broche-60x25') },
  { key: 'defaultMaterialId', value: JSON.stringify('abs-escovado-prata') },
  { key: 'storageMode', value: JSON.stringify('local') },
  {
    key: 'logoPolicy',
    value: JSON.stringify({ allowedFormats: ['svg'], localFolder: 'assets/logos/' }),
  },
  {
    key: 'export',
    value: JSON.stringify({
      pngClient: true,
      svg: true,
      svgProduction: true,
      productionFileNames: {
        engrave: '{orderName}_gravacao.svg',
        cut: '{orderName}_corte-laser.svg',
      },
    }),
  },
  { key: 'theme', value: JSON.stringify('dark') },
];

export async function seedSettings(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const setting of SETTINGS) {
    const result = await db.execute('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [
      setting.key,
      setting.value,
    ]);
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
