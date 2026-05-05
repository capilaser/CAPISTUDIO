import type Database from '@tauri-apps/plugin-sql';
import type { ProductConstraints, ProductConfig } from '../schema';

interface ProductSeed {
  id: string;
  type: string;
  label: string;
  icon: string;
  status: string;
  canvasMm: { width: number; height: number };
  viewBox: { minX: number; minY: number; width: number; height: number };
  allowedSlotTypes: string[];
  machines: string[];
  constraints: ProductConstraints;
  versionRev: number;
  config?: ProductConfig;
}

// Source: v1-data/products.json
// productionModules stored inert in config — deferred to production-modules wave (ADR 003).
// defaultFonts omitted — font is chosen at slot creation time.
const PRODUCTS: ProductSeed[] = [
  {
    id: 'broche-60x25',
    type: 'broche',
    label: 'Broche 60 x 25',
    icon: '🏷️',
    status: 'published',
    canvasMm: { width: 60, height: 25 },
    viewBox: { minX: 0, minY: 0, width: 60, height: 25 },
    allowedSlotTypes: ['logo', 'name', 'profession'],
    machines: ['due-laser'],
    constraints: { sizeLocked: true, minGapMm: 2 },
    versionRev: 1,
  },
  {
    id: 'placa-300x90',
    type: 'placa',
    label: 'Placa 300 x 90',
    icon: '🪪',
    status: 'published',
    canvasMm: { width: 300, height: 90 },
    viewBox: { minX: 0, minY: 0, width: 300, height: 90 },
    allowedSlotTypes: ['logo', 'name', 'profession', 'free-text', 'qrcode', 'image'],
    machines: ['master-biro', 'fiber-laser', 'due-laser'],
    constraints: { sizeLocked: true, minGapMm: 2 },
    versionRev: 1,
    config: {
      productionModules: [
        { id: 'placa-base', label: 'Base da Placa', operation: 'preview' },
        { id: 'aplique-esquerdo', label: 'Aplique Esquerdo + Logo', operation: 'engrave' },
        { id: 'aplique-cargo', label: 'Aplique Cargo + Escrita', operation: 'engrave' },
        { id: 'nome-recorte', label: 'Nome para Corte', operation: 'cut' },
      ],
    },
  },
];

export async function seedProducts(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const viewBoxStr = `${p.viewBox.minX} ${p.viewBox.minY} ${p.viewBox.width} ${p.viewBox.height}`;

    const result = await db.execute(
      `INSERT OR IGNORE INTO products
         (id, type, label, icon, status, canvas_mm, view_box,
          allowed_slot_types, constraints, version_rev, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.type,
        p.label,
        p.icon,
        p.status,
        JSON.stringify(p.canvasMm),
        viewBoxStr,
        JSON.stringify(p.allowedSlotTypes),
        JSON.stringify(p.constraints),
        p.versionRev,
        p.config ? JSON.stringify(p.config) : null,
      ]
    );

    if (result.rowsAffected === 1) inserted++;
    else skipped++;

    // Seed product_machines junction
    for (const machineId of p.machines) {
      await db.execute(
        'INSERT OR IGNORE INTO product_machines (product_id, machine_id) VALUES (?, ?)',
        [p.id, machineId]
      );
    }
  }

  return { inserted, skipped };
}
