import type Database from '@tauri-apps/plugin-sql';

// Fixed IDs — idempotency key. Changing these breaks re-seed detection.
//
// Dimensions extracted from SVG headers (mm declared no header do Corel).
// filePath usa o "resource://" prefix convention (Onda 6a, ADR 010),
// resolvido por svgPathResolver.ts para caminho absoluto via Tauri resource.
// Arquivos vivem em src-tauri/resources/fixtures/engravings/ e são bundled
// via tauri.conf.json bundle.resources ["resources/**/*"].
//
// categoryId === id de uma row em `categories` (criada por seedCategories).
// Onda 8.5 seeda apenas "profissoes"; futuras categorias seguem o padrão.
//
// Onda 9 — operation/machines pro motor de exportação SVG. Ver seedAppliques
// para contrato (preto=corte, azul=marcação, vermelho=gravação; 1 SVG/máquina).
const ENGRAVINGS = [
  {
    id: 'balanca-advogado',
    name: 'Balança Advogado',
    filePath: 'resource://fixtures/engravings/balanca-advogado.svg',
    widthMm: 69.9985,
    heightMm: 64.0889,
    categoryId: 'profissoes',
    tags: ['profissao', 'advogado', 'direito'],
    operation: 'gravacao',
    machines: ['fiber-laser'],
  },
] as const;

export async function seedEngravings(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const eng of ENGRAVINGS) {
    // INSERT OR IGNORE: rowsAffected=1 on insert, 0 on duplicate id (idempotent).
    // Mesma decisão do seedAppliques (evita REPLACE pra não cascatear FKs).
    const result = await db.execute(
      `INSERT OR IGNORE INTO engravings
         (id, name, file_path, width_mm, height_mm, tags, category_id, operation, machines, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      [
        eng.id,
        eng.name,
        eng.filePath,
        eng.widthMm,
        eng.heightMm,
        JSON.stringify(eng.tags),
        eng.categoryId,
        eng.operation,
        JSON.stringify(eng.machines),
      ]
    );

    if (result.rowsAffected === 1) {
      inserted++;
      if (import.meta.env.DEV) console.info(`[seedEngravings] inserted: ${eng.id}`);
    } else {
      skipped++;
      if (import.meta.env.DEV) console.info(`[seedEngravings] skipped (already exists): ${eng.id}`);

      // Onda 9 backfill — rows pré-existentes têm machines='[]' após migration 0006.
      // Atualiza só quando vazio pra preservar edições futuras.
      await db.execute(
        `UPDATE engravings
           SET operation = ?, machines = ?
         WHERE id = ? AND machines = '[]'`,
        [eng.operation, JSON.stringify(eng.machines), eng.id]
      );
    }
  }

  return { inserted, skipped };
}
