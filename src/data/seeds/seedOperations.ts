import type Database from '@tauri-apps/plugin-sql';

const OPERATIONS = [
  { id: 'contorno', label: 'Contorno', defaultColor: '#000000' },
  { id: 'corte-laser', label: 'Corte Laser', defaultColor: '#2563eb' },
  { id: 'corte', label: 'Corte', defaultColor: '#000000' },
  { id: 'gravacao', label: 'Gravação', defaultColor: '#dc2626' },
  { id: 'marcacao', label: 'Marcação', defaultColor: '#2563eb' },
  { id: 'aplique', label: 'Aplique', defaultColor: '#7c3aed' },
  { id: 'gravacao-aplique', label: 'Gravação Aplique', defaultColor: '#d97706' },
] as const;

export async function seedOperations(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const op of OPERATIONS) {
    const result = await db.execute(
      'INSERT OR IGNORE INTO operations (id, label, default_color) VALUES (?, ?, ?)',
      [op.id, op.label, op.defaultColor]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
