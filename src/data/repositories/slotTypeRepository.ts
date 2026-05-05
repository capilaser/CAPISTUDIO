import { getDb } from '../client';

export interface SlotType {
  id: string;
  label: string;
  isText: boolean;
  defaultMaxWidthMm: number | null;
  defaultMaxHeightMm: number | null;
}

interface SlotTypeRow {
  id: string;
  label: string;
  isText: number; // SQLite integer: 0 | 1
  defaultMaxWidthMm: number | null;
  defaultMaxHeightMm: number | null;
}

function toSlotType(row: SlotTypeRow): SlotType {
  return { ...row, isText: row.isText === 1 };
}

export async function getAllSlotTypes(): Promise<SlotType[]> {
  const db = await getDb();
  const rows = await db.select<SlotTypeRow[]>(
    `SELECT id, label, is_text as isText,
            default_max_width_mm as defaultMaxWidthMm,
            default_max_height_mm as defaultMaxHeightMm
     FROM slot_types ORDER BY id`
  );
  return rows.map(toSlotType);
}
