import { getDb } from '../client';

export interface Machine {
  id: string;
  label: string;
  enabled: boolean;
  createdAt: number;
}

export interface MachineWithOperations extends Machine {
  operations: string[];
}

interface MachineRow {
  id: string;
  label: string;
  enabled: number; // SQLite integer: 0 | 1
  createdAt: number;
}

function toMachine(row: MachineRow): Machine {
  return { ...row, enabled: row.enabled === 1 };
}

export async function getAllMachines(): Promise<Machine[]> {
  const db = await getDb();
  const rows = await db.select<MachineRow[]>(
    'SELECT id, label, enabled, created_at as createdAt FROM machines ORDER BY label'
  );
  return rows.map(toMachine);
}

export async function getMachineById(id: string): Promise<Machine | null> {
  const db = await getDb();
  const rows = await db.select<MachineRow[]>(
    'SELECT id, label, enabled, created_at as createdAt FROM machines WHERE id = ?',
    [id]
  );
  return rows[0] ? toMachine(rows[0]) : null;
}

export async function getMachineOperations(machineId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<Array<{ operationId: string }>>(
    'SELECT operation_id as operationId FROM machine_operations WHERE machine_id = ?',
    [machineId]
  );
  return rows.map((r) => r.operationId);
}
