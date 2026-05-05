import type Database from '@tauri-apps/plugin-sql';

// Derived from products.allowedSlotTypes values in v1-data/products.json.
const SLOT_TYPES = [
  { id: 'logo', label: 'Logo', isText: false, defaultMaxWidthMm: 30, defaultMaxHeightMm: 15 },
  { id: 'name', label: 'Nome', isText: true, defaultMaxWidthMm: 50, defaultMaxHeightMm: 8 },
  {
    id: 'profession',
    label: 'Profissão',
    isText: true,
    defaultMaxWidthMm: 50,
    defaultMaxHeightMm: 6,
  },
  {
    id: 'free-text',
    label: 'Texto Livre',
    isText: true,
    defaultMaxWidthMm: null,
    defaultMaxHeightMm: null,
  },
  {
    id: 'qrcode',
    label: 'QR Code',
    isText: false,
    defaultMaxWidthMm: null,
    defaultMaxHeightMm: null,
  },
  {
    id: 'image',
    label: 'Imagem',
    isText: false,
    defaultMaxWidthMm: null,
    defaultMaxHeightMm: null,
  },
] as const;

export async function seedSlotTypes(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const st of SLOT_TYPES) {
    const result = await db.execute(
      `INSERT OR IGNORE INTO slot_types
         (id, label, is_text, default_max_width_mm, default_max_height_mm)
       VALUES (?, ?, ?, ?, ?)`,
      [st.id, st.label, st.isText ? 1 : 0, st.defaultMaxWidthMm, st.defaultMaxHeightMm]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
