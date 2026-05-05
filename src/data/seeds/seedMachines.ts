import type Database from '@tauri-apps/plugin-sql';

const MACHINES = [
  { id: 'master-biro', label: 'Master Biro' },
  { id: 'fiber-laser', label: 'Fiber Laser' },
  { id: 'due-laser', label: 'Due Laser' },
] as const;

// Source: v1-data/machines.json (.operations arrays)
const MACHINE_OPERATIONS: Record<string, string[]> = {
  'master-biro': ['contorno', 'corte-laser', 'corte', 'marcacao', 'gravacao', 'aplique'],
  'fiber-laser': ['aplique', 'gravacao-aplique', 'gravacao', 'marcacao'],
  'due-laser': ['contorno', 'corte-laser', 'corte', 'marcacao', 'gravacao'],
};

export async function seedMachines(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const machine of MACHINES) {
    const result = await db.execute(
      'INSERT OR IGNORE INTO machines (id, label, enabled) VALUES (?, ?, 1)',
      [machine.id, machine.label]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;

    // Seed machine_operations junction (silent — errors only)
    for (const opId of MACHINE_OPERATIONS[machine.id] ?? []) {
      await db.execute(
        'INSERT OR IGNORE INTO machine_operations (machine_id, operation_id) VALUES (?, ?)',
        [machine.id, opId]
      );
    }
  }

  return { inserted, skipped };
}
