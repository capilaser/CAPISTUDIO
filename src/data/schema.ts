import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── 1. MACHINES ──────────────────────────────────────────────────────────────
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 2. OPERATIONS ─────────────────────────────────────────────────────────────
// Catalogue of production operations (contorno, corte-laser, gravacao, etc.).
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  defaultColor: text('default_color').notNull(), // hex used for canvas overlays
});

// ── 3. MACHINE_OPERATIONS ─────────────────────────────────────────────────────
// N:N — which operations each machine supports.
export const machineOperations = sqliteTable(
  'machine_operations',
  {
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id),
    operationId: text('operation_id')
      .notNull()
      .references(() => operations.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.machineId, t.operationId] }) })
);

// ── 4. SLOT_TYPES ─────────────────────────────────────────────────────────────
// Catalogue of canvas slot types (logo, name, profession, free-text, qrcode, image).
export const slotTypes = sqliteTable('slot_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  isText: integer('is_text', { mode: 'boolean' }).notNull(),
  defaultMaxWidthMm: real('default_max_width_mm'),
  defaultMaxHeightMm: real('default_max_height_mm'),
});

// ── 5. FONTS ──────────────────────────────────────────────────────────────────
export const fonts = sqliteTable('fonts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // "Display" | "Moderno" | "Script" | "Serifado" | "Sem Serifa"
  family: text('family').notNull(),
  source: text('source').notNull(), // "local" | "google"
  file: text('file'), // null for Google fonts; relative path for local
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 6. CATEGORIES ─────────────────────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(), // "pattern" | "product" | "logo" | "svg" | "svg-pattern"
  color: text('color'), // hex for colored chips in UI
});

// ── 7. PRODUCTS ───────────────────────────────────────────────────────────────
export type ProductConstraints = { sizeLocked: boolean; minGapMm: number };
export type ProductConfig = {
  usableArea?: { x: number; y: number; w: number; h: number };
  bleedMm?: number;
  compatibleMaterials?: string[];
  // Stored inert — deferred to production-modules wave. See ADR 003.
  productionModules?: Array<{ id: string; label: string; operation: string }>;
};

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // "broche" | "placa"
  label: text('label').notNull(),
  icon: text('icon'),
  status: text('status').notNull().default('published'), // "published" | "draft"
  canvasMm: text('canvas_mm').notNull(), // JSON: { width: number; height: number }
  viewBox: text('view_box').notNull(), // SVG viewBox string: "minX minY width height"
  allowedSlotTypes: text('allowed_slot_types').notNull(), // JSON: string[]
  constraints: text('constraints').notNull(), // JSON: ProductConstraints
  versionRev: integer('version_rev').notNull().default(1),
  baseSvg: text('base_svg'), // SVG inline — populated in later waves
  config: text('config'), // JSON: ProductConfig — nullable
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 8. PRODUCT_MACHINES ───────────────────────────────────────────────────────
export const productMachines = sqliteTable(
  'product_machines',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.productId, t.machineId] }) })
);

// ── 9. PRODUCT_LAYERS ─────────────────────────────────────────────────────────
// Base layers of a product (contour, engraving area, etc.).
// svg is nullable — see ADR 004 (01-DATABASE.md specified NOT NULL but v1 data is empty).
export const productLayers = sqliteTable('product_layers', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  zIndex: integer('z_index').notNull().default(0),
  svg: text('svg'), // nullable — ADR 004
  defaultOperation: text('default_operation').references(() => operations.id),
});

// ── 10. MATERIAL_FAMILIES ─────────────────────────────────────────────────────
export const materialFamilies = sqliteTable('material_families', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  brushed: integer('brushed', { mode: 'boolean' }).notNull().default(false),
});

// ── 11. MATERIALS ─────────────────────────────────────────────────────────────
// PNG-first strategy — replaces 'textures' from 01-DATABASE.md. See Wave 1 spec.
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  familyId: text('family_id')
    .notNull()
    .references(() => materialFamilies.id),
  label: text('label').notNull(),
  swatch: text('swatch').notNull(), // hex for color picker preview
  pngPath: text('png_path').notNull(), // relative to Tauri resources dir
  fallbackStops: text('fallback_stops'), // JSON: Array<{ offset: string; color: string }>
});

// ── 12. PATTERNS ──────────────────────────────────────────────────────────────
// Master reusable templates. Saving an order NEVER mutates canvasJson (CLAUDE.md rule).
export type FabricCanvasJson = {
  version: string;
  objects: FabricObject[];
  background?: string;
  capi?: { productId: string; units: 'mm'; layers: LayerMeta[] };
};
export type FabricObject = { type: string; id: string; capiSlot?: SlotMeta };
export type LayerMeta = {
  id: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  kind: 'visual' | 'production';
  operation: string | null;
  machines: string[];
  /** PNG material applied to this layer. Only honoured when kind === 'visual'.
   *  Production layers ignore this field entirely.
   *  Persisted in canvasJson.capi.layers[]. Use (layer.materialId ?? null) when reading
   *  legacy canvasJson that predates Onda 5. */
  materialId: string | null;
};
export type SlotMeta = {
  type: 'logo' | 'nome' | 'profissao' | 'custom';
  maxArea: { w: number; h: number };
  autoCenter: boolean;
  autoFit?: boolean;
};

export const patterns = sqliteTable('patterns', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  description: text('description'),
  wave: integer('wave').notNull().default(1),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  canvasJson: text('canvas_json').notNull(), // JSON: FabricCanvasJson
  defaultMaterialId: text('default_material_id').references(() => materials.id),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  isValidated: integer('is_validated', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 13. PATTERN_LAYERS ────────────────────────────────────────────────────────
// Principal layer — represents one physical piece (base, applique) in a pattern.
// Sub-layers of operation live in the canvas (LayerMeta) referencing this id.
// ADR 010: hierarchy is fixed at 2 levels (principal → operation). No deeper nesting.
export const patternLayers = sqliteTable('pattern_layers', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id')
    .notNull()
    .references(() => patterns.id),
  name: text('name').notNull(),
  zIndex: integer('z_index').notNull().default(0),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  svgFilePath: text('svg_file_path'), // nullable — path relative to appData/assets/svg-bases/
  materialId: text('material_id').references(() => materials.id), // nullable
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  positionXmm: real('position_x_mm').notNull().default(0),
  positionYmm: real('position_y_mm').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 14. PATTERN_SLOTS ─────────────────────────────────────────────────────────
// Static slot index for fast lookup — source of truth is canvasJson.
// parentLayerId: nullable — NULL means slot is not yet bound to a principal layer.
export const patternSlots = sqliteTable('pattern_slots', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id')
    .notNull()
    .references(() => patterns.id),
  slotType: text('slot_type').notNull(), // logical FK → slot_types.id
  positionX: real('position_x').notNull(), // mm
  positionY: real('position_y').notNull(), // mm
  maxWidth: real('max_width').notNull(), // mm
  maxHeight: real('max_height').notNull(), // mm
  defaultFontId: text('default_font_id').references(() => fonts.id),
  parentLayerId: text('parent_layer_id').references(() => patternLayers.id), // nullable — ADR 010
  meta: text('meta'), // JSON: alignment, autofit, etc.
});

// ── 14. ORDERS ────────────────────────────────────────────────────────────────
// Per-client filled artwork. Saving NEVER touches patterns.canvasJson (CLAUDE.md).
export type OrderFields = {
  logo?: { source: 'asset' | 'inline'; assetId?: string; inlineSvg?: string };
  nome?: string;
  profissao?: string;
  [key: string]: unknown;
};

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id')
    .notNull()
    .references(() => patterns.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  label: text('label').notNull(),
  fields: text('fields').notNull(), // JSON: OrderFields
  materialId: text('material_id').references(() => materials.id),
  status: text('status').notNull().default('pendente'), // "pendente" | "aprovado"
  canvasJson: text('canvas_json').notNull(), // JSON: FabricCanvasJson (snapshot at save)
  exportedPngPath: text('exported_png_path'),
  exportedSvgPaths: text('exported_svg_paths'), // JSON: string[]
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 15. ORDER_OVERRIDES ───────────────────────────────────────────────────────
// Fine-tuning adjustments over a pattern — reversible independently of fields.
export const orderOverrides = sqliteTable('order_overrides', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  targetId: text('target_id').notNull(), // canvas object or slot id
  kind: text('kind').notNull(), // "position" | "scale" | "font" | "machine" | "operation" | "rotation"
  before: text('before'), // JSON: value from pattern (nullable if no prior value)
  after: text('after').notNull(), // JSON: override value
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 16. LOGOS ─────────────────────────────────────────────────────────────────
// Auto-growing bank — every logo used in an order is saved here for reuse.
export const logos = sqliteTable('logos', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(),
  format: text('format').notNull(), // "SVG" | "DXF" | "PNG" | "JPG"
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 17. SVG_BASES ─────────────────────────────────────────────────────────────
// Raw SVG/DXF files from Corel — raw material for creating patterns.
export const svgBases = sqliteTable('svg_bases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  productId: text('product_id').references(() => products.id),
  filePath: text('file_path').notNull(),
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 18. SETTINGS ──────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON or plain string
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 19. APPLIQUES ─────────────────────────────────────────────────────────────
// Bank of reusable applique SVGs (physical pieces applied on top of a base).
// ADR 010: imported SVGs are stripped of colour — only contours are used.
export const appliques = sqliteTable('appliques', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(), // relative to appData/assets/appliques/
  thumbnailPath: text('thumbnail_path'),
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  metadata: text('metadata'), // JSON: arbitrary extra data
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 20. ENGRAVINGS ────────────────────────────────────────────────────────────
// Bank of reusable engraving SVGs (logos, icons, ornaments to engrave).
export const engravings = sqliteTable('engravings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(), // relative to appData/assets/engravings/
  thumbnailPath: text('thumbnail_path'),
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  metadata: text('metadata'), // JSON: arbitrary extra data
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 21. MARKINGS ──────────────────────────────────────────────────────────────
// Bank of reusable marking SVGs (pre-registered mark paths, letter sets for cutting).
export const markings = sqliteTable('markings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(), // relative to appData/assets/markings/
  thumbnailPath: text('thumbnail_path'),
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  metadata: text('metadata'), // JSON: arbitrary extra data
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 22. EXPORT_HISTORY ────────────────────────────────────────────────────────
export const exportHistory = sqliteTable('export_history', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id),
  kind: text('kind').notNull(), // "preview-png" | "production-svg"
  machineId: text('machine_id').references(() => machines.id),
  filePath: text('file_path').notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});
