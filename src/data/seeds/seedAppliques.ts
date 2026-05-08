import type Database from '@tauri-apps/plugin-sql';

// Fixed IDs — idempotency key. Changing these breaks re-seed detection.
// Dimensions extracted from SVG headers (all in mm — no conversion needed).
//
// filePath uses the "resource://" prefix convention (Onda 6a, ADR 010).
// svgPathResolver.ts resolves this to an absolute path via resolveResource().
// Files live in src-tauri/resources/fixtures/apliques/ and are bundled via
// tauri.conf.json bundle.resources ["resources/**/*"].
const APPLIQUES = [
  {
    id: 'aplique-1-formato-d',
    name: 'Aplique 1 — Formato D',
    filePath: 'resource://fixtures/apliques/aplique-1-formato-d.svg',
    widthMm: 100.2,
    heightMm: 90.2,
  },
  {
    id: 'aplique-2-quadrado',
    name: 'Aplique 2 — Quadrado',
    filePath: 'resource://fixtures/apliques/aplique-2-quadrado.svg',
    widthMm: 100.2,
    heightMm: 90.2,
  },
  {
    id: 'aplique-3-pill',
    name: 'Aplique 3 — Pill',
    filePath: 'resource://fixtures/apliques/aplique-3-pill.svg',
    widthMm: 95.2,
    heightMm: 15.2,
  },
] as const;

export async function seedAppliques(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const ap of APPLIQUES) {
    // INSERT OR REPLACE chosen to correct filePath from boots that ran with
    // the old absolute-path strategy (Onda 6a fix). REPLACE deletes-and-inserts,
    // so createdAt is reset on replace. When pattern_layers references appliques
    // via FK (Onda 6b+), revisit this strategy — ON DELETE CASCADE may fire
    // unexpectedly and createdAt of the original record is lost.
    const result = await db.execute(
      `INSERT OR REPLACE INTO appliques
         (id, name, file_path, width_mm, height_mm, tags, created_at)
       VALUES (?, ?, ?, ?, ?, '[]', unixepoch())`,
      [ap.id, ap.name, ap.filePath, ap.widthMm, ap.heightMm]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
