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
  baseSvg?: string;
  config?: ProductConfig;
}

// Source: v1-data/products.json
// productionModules stored inert in config — deferred to production-modules wave (ADR 003).
// defaultFonts omitted — font is chosen at slot creation time.
//
// baseSvg: SVG content embedded from tests/fixtures/camadas-base/ (ADR 013).
// Strategy: INSERT OR IGNORE + UPDATE WHERE base_svg IS NULL (idempotent).
// WARNING: if the fixture SVG changes after the DB is created, the seed will NOT
// re-apply. Manual DB deletion + re-seed required. See ADR 013 for details.
const PLACA_300X90_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- Creator: CorelDRAW (Versão OEM) -->
<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" width="300.2mm" height="90.2mm" version="1.1" style="shape-rendering:geometricPrecision; text-rendering:geometricPrecision; image-rendering:optimizeQuality; fill-rule:evenodd; clip-rule:evenodd"
viewBox="0 0 24333.28 7311.33"
 xmlns:xlink="http://www.w3.org/1999/xlink"
 xmlns:xodm="http://www.corel.com/coreldraw/odm/2003">
 <defs>
  <style type="text/css">
   <![CDATA[
    .str0 {stroke:#373435;stroke-width:16.21;stroke-miterlimit:22.9256}
    .fil0 {fill:none}
   ]]>
  </style>
 </defs>
 <g id="Camada_x0020_1">
  <metadata id="CorelCorpID_0Corel-Layer"/>
  <path class="fil0 str0" d="M8.11 8.11l20669.51 0c2006.16,0 3647.56,1641.4 3647.56,3647.57l0 3647.55 -20669.51 0c-2006.16,0 -3647.56,-1641.41 -3647.56,-3647.55l0 -3647.57z"/>
 </g>
</svg>`;

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
    baseSvg: PLACA_300X90_SVG,
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
          allowed_slot_types, constraints, version_rev, base_svg, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        p.baseSvg ?? null,
        p.config ? JSON.stringify(p.config) : null,
      ]
    );

    if (result.rowsAffected === 1) {
      inserted++;
    } else {
      skipped++;
      // ADR 013: UPDATE fallback — fills base_svg when record exists but field is NULL.
      // Does NOT overwrite an existing base_svg (idempotent after first run).
      if (p.baseSvg) {
        await db.execute(`UPDATE products SET base_svg = ? WHERE id = ? AND base_svg IS NULL`, [
          p.baseSvg,
          p.id,
        ]);
      }
    }

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
