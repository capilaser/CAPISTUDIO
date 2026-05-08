import type Database from '@tauri-apps/plugin-sql';

// Fixed IDs — idempotency key. Changing these breaks re-seed detection.
// Dimensions extracted from SVG headers (all in mm — no conversion needed).
//
// filePath uses the "resource://" prefix convention (Onda 6a, ADR 010).
// svgPathResolver.ts resolves this to an absolute path via resolveResource().
// Files live in src-tauri/resources/fixtures/svg-bases/ and are bundled via
// tauri.conf.json bundle.resources ["resources/**/*"].
const SVG_BASES = [
  {
    id: 'svg-base-broche-simples',
    name: 'Broche Simples',
    filePath: 'resource://fixtures/svg-bases/broche-simples.svg',
    widthMm: 60.076,
    heightMm: 25.076,
  },
  {
    id: 'svg-base-broche-completo',
    name: 'Broche Completo',
    filePath: 'resource://fixtures/svg-bases/broche-completo.svg',
    widthMm: 59.9998,
    heightMm: 24.9998,
  },
  {
    id: 'svg-base-placa-base',
    name: 'Placa Base',
    filePath: 'resource://fixtures/svg-bases/placa-base.svg',
    widthMm: 300.2,
    heightMm: 90.2,
  },
  {
    id: 'svg-base-placa-completa',
    name: 'Placa Completa',
    filePath: 'resource://fixtures/svg-bases/placa-completa.svg',
    widthMm: 300.0,
    heightMm: 90.0,
  },
] as const;

export async function seedSvgBases(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const base of SVG_BASES) {
    // INSERT OR REPLACE chosen to correct filePath from boots that ran with
    // the old absolute-path strategy (Onda 6a fix). REPLACE deletes-and-inserts,
    // so createdAt is reset on replace. When pattern_layers references svg_bases
    // via FK (Onda 6b+), revisit this strategy — ON DELETE CASCADE may fire
    // unexpectedly and createdAt of the original record is lost.
    const result = await db.execute(
      `INSERT OR REPLACE INTO svg_bases
         (id, name, file_path, width_mm, height_mm, tags, created_at)
       VALUES (?, ?, ?, ?, ?, '[]', unixepoch())`,
      [base.id, base.name, base.filePath, base.widthMm, base.heightMm]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
