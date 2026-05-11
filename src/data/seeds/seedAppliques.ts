import type Database from '@tauri-apps/plugin-sql';

// Fixed IDs — idempotency key. Changing these breaks re-seed detection.
// Dimensions extracted from SVG headers (all in mm — no conversion needed).
//
// filePath uses the "resource://" prefix convention (Onda 6a, ADR 010).
// svgPathResolver.ts resolves this to an absolute path via resolveResource().
// Files live in src-tauri/resources/fixtures/appliques/ (English spelling) and are
// bundled via tauri.conf.json bundle.resources ["resources/**/*"].
//
// Onda 9 — operation/machines pro motor de exportação SVG. Definem onde
// cada aplique entra na pasta de produção (1 SVG por máquina envolvida)
// e qual cor semântica recebe (preto=corte, azul=marcação, vermelho=gravação).
// IDs de máquina: 'fiber-laser', 'master-biro', 'due-laser' (ver seedMachines).
const APPLIQUES = [
  {
    id: 'aplique-1-formato-d',
    name: 'Aplique 1 — Formato D',
    filePath: 'resource://fixtures/appliques/aplique-1-formato-d.svg',
    widthMm: 100.2,
    heightMm: 90.2,
    operation: 'corte',
    machines: ['fiber-laser'],
  },
  {
    id: 'aplique-2-quadrado',
    name: 'Aplique 2 — Quadrado',
    filePath: 'resource://fixtures/appliques/aplique-2-quadrado.svg',
    widthMm: 100.2,
    heightMm: 90.2,
    operation: 'corte',
    machines: ['fiber-laser'],
  },
  {
    id: 'aplique-3-pill',
    name: 'Aplique 3 — Pill',
    filePath: 'resource://fixtures/appliques/aplique-3-pill.svg',
    widthMm: 95.2,
    heightMm: 15.2,
    operation: 'marcacao',
    machines: ['master-biro', 'fiber-laser'],
  },
] as const;

export async function seedAppliques(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const ap of APPLIQUES) {
    // INSERT OR IGNORE: rowsAffected=1 on insert, 0 on duplicate id (idempotent).
    // Prefer over INSERT OR REPLACE — REPLACE deletes-then-inserts, which would
    // fire ON DELETE CASCADE on pattern_layers FKs added in Onda 6b+.
    const result = await db.execute(
      `INSERT OR IGNORE INTO appliques
         (id, name, file_path, width_mm, height_mm, tags, operation, machines, created_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, ?, unixepoch())`,
      [
        ap.id,
        ap.name,
        ap.filePath,
        ap.widthMm,
        ap.heightMm,
        ap.operation,
        JSON.stringify(ap.machines),
      ]
    );

    if (result.rowsAffected === 1) {
      inserted++;
      if (import.meta.env.DEV) console.info(`[seedAppliques] inserted: ${ap.id}`);
    } else {
      skipped++;
      if (import.meta.env.DEV) console.info(`[seedAppliques] skipped (already exists): ${ap.id}`);

      // Onda 9 backfill — rows pré-existentes (Ondas 6a-8.x) têm machines='[]'
      // após a migration 0006. Atualiza só quando ainda vazio pra não sobrescrever
      // edições futuras do usuário.
      await db.execute(
        `UPDATE appliques
           SET operation = ?, machines = ?
         WHERE id = ? AND machines = '[]'`,
        [ap.operation, JSON.stringify(ap.machines), ap.id]
      );
    }
  }

  return { inserted, skipped };
}
