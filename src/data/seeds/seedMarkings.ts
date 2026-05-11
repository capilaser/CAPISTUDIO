import type Database from '@tauri-apps/plugin-sql';

// Banco de marcações (Onda 9). Espelha seedEngravings — fixed IDs idempotentes,
// filePath via "resource://" prefix, dimensões em mm.
//
// "Marcação banco" (asset reutilizável aqui) é DIFERENTE de "operação Marcação"
// (cor azul, máquina específica no export). O campo `operation` aqui declara
// qual operação ESTE asset dispara na produção, geralmente 'marcacao'.
//
// Onda 9 entrega o banco operacional sem seeds pré-existentes — o usuário
// vai cadastrar entries via UI na Onda 10. A estrutura idempotente já está
// pronta para o dia em que tivermos markings de fábrica para distribuir.
const MARKINGS: ReadonlyArray<{
  id: string;
  name: string;
  filePath: string;
  widthMm: number;
  heightMm: number;
  categoryId: string | null;
  tags: string[];
  operation: 'corte' | 'marcacao' | 'gravacao';
  machines: string[];
}> = [];

export async function seedMarkings(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const mk of MARKINGS) {
    const result = await db.execute(
      `INSERT OR IGNORE INTO markings
         (id, name, file_path, width_mm, height_mm, tags, category_id, operation, machines, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())`,
      [
        mk.id,
        mk.name,
        mk.filePath,
        mk.widthMm,
        mk.heightMm,
        JSON.stringify(mk.tags),
        mk.categoryId,
        mk.operation,
        JSON.stringify(mk.machines),
      ]
    );

    if (result.rowsAffected === 1) {
      inserted++;
      if (import.meta.env.DEV) console.info(`[seedMarkings] inserted: ${mk.id}`);
    } else {
      skipped++;
      if (import.meta.env.DEV) console.info(`[seedMarkings] skipped (already exists): ${mk.id}`);

      await db.execute(
        `UPDATE markings
           SET operation = ?, machines = ?
         WHERE id = ? AND machines = '[]'`,
        [mk.operation, JSON.stringify(mk.machines), mk.id]
      );
    }
  }

  return { inserted, skipped };
}
