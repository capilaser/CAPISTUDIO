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

// ─── LayerMeta — discriminated union (ADR 010 §1, Fase C) ─────────────────────
//
// Hierarchy is FIXED at 2 levels:
//   PrincipalLayerMeta  (parentLayerId: null)       — physical piece
//     └── OperationLayerMeta (parentLayerId: string) — machine operation on that piece
//   VisualLayerMeta (parentLayerId: null | string)  — decorative canvas layer (retrocompat)
//
// Invariants enforced at runtime by validateLayerMeta() in core/canvas/layer-meta.ts.
// TypeScript enforces correct field usage at compile-time via the discriminant `kind`.

/**
 * Onda 26 Fase 5 — labels de cor para organização visual no painel de
 * camadas (estilo Photoshop). Apenas indicação visual; não afeta render
 * no canvas nem export. 7 cores fixas + 'none' (sem label).
 */
export type LayerColorLabel =
  | 'none'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'violet'
  | 'gray';

/**
 * Onda 26 Fase 5 — blend modes suportados. Subset enxuto pro domínio de
 * produção (4 essenciais): Normal, Multiply, Screen, Overlay. Strings
 * compatíveis com Canvas 2D globalCompositeOperation que Fabric usa.
 */
export type LayerBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

/** Camada principal — representa uma peça física (base, aplique). */
export type PrincipalLayerMeta = {
  id: string;
  /** Always null for principal layers (ADR 010 §1 invariant 1). */
  parentLayerId: null;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  /**
   * Onda 26 — opacidade 0..1. Opcional (ausente = 1). Propagada pro
   * fabric obj.opacity via engine.setLayerOpacity(). Mantida opcional pra
   * retrocompat com pedidos/padrões salvos antes deste campo existir.
   */
  opacity?: number;
  /**
   * Onda 26 Fase 5 — label de cor pra organização visual no painel.
   * Não afeta canvas nem export. Opcional (ausente = 'none').
   */
  colorLabel?: LayerColorLabel;
  /**
   * Onda 26 Fase 5 — blend mode aplicado via fabric obj.globalCompositeOperation.
   * Opcional (ausente = 'normal'). 4 modos: normal, multiply, screen, overlay.
   */
  blendMode?: LayerBlendMode;
  kind: 'principal';
  /** Material (texture) applied to this piece. Persisted in canvasJson. */
  materialId: string | null;
  /** FK → appliques.id. null when the principal layer is the product base (not an applique). */
  appliqueId: string | null;
  /**
   * Mini-Onda 8.6 — Bounds originais em mm, fonte autoritativa (ADR 005).
   *
   * Por que: fabric.util.groupSVGElements usa bounding box dos shapes
   * (geometria real dos paths) em vez do viewBox declarado do SVG. Quando
   * o Corel exporta com margem interna (espaço pro stroke), group.width
   * fica menor que viewBox.width. Sem este campo, getParentBoundsForObject
   * propagaria erro de ~0.1-0.4mm pra todo o sistema (snap, alignment,
   * medição, proximity, export).
   *
   * Setado em addAppliqueSvg a partir de CorelSvgMeta.widthMm/heightMm
   * (que vem direto do viewBox). Atualizado em object:modified após
   * drag/scale do usuário — após interação, a fonte de verdade vira o
   * estado Fabric (que tem erro de margem mas é o que está visível).
   *
   * Tipo redeclarado inline pra evitar dependência cruzada data/ → core/canvas/.
   * Eventual cleanup numa onda futura: ver docs/IDEAS/onda-13-cleanup-geometry-type.md.
   *
   * Migração lazy: padrões salvos antes da Mini-Onda 8.6 não têm este
   * campo. getParentBoundsForObject faz fallback pro cálculo antigo
   * nesse caso. Próxima vez que o usuário arrastar o aplique, o handler
   * object:modified popula originalBounds e a partir daí fica preciso.
   */
  originalBounds?: { left: number; top: number; width: number; height: number };
};

/** Sub-camada de operação — operação de máquina sobre a peça física pai. */
export type OperationLayerMeta = {
  id: string;
  /** FK → id of the parent PrincipalLayerMeta. Never null (ADR 010 §1 invariant 2). */
  parentLayerId: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  /** Onda 26 — opacidade 0..1. Ver PrincipalLayerMeta.opacity. */
  opacity?: number;
  /** Onda 26 Fase 5 — label de cor. Ver PrincipalLayerMeta.colorLabel. */
  colorLabel?: LayerColorLabel;
  /** Onda 26 Fase 5 — blend mode. Ver PrincipalLayerMeta.blendMode. */
  blendMode?: LayerBlendMode;
  kind: 'operation';
  /** One of the 7 defined operations (corte, gravação, marcação, aplique, etc.). Required. */
  operation: string;
  /** Machine IDs. Min 1, max 3 (ADR 010 §1 invariant 4). Required. */
  machines: string[];
};

/** Camada visual decorativa — retrocompat com Ondas 3-5 e para uso futuro. */
export type VisualLayerMeta = {
  id: string;
  /** null = top-level visual. string = child of a principal (never child of operation). */
  parentLayerId: string | null;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  /** Onda 26 — opacidade 0..1. Ver PrincipalLayerMeta.opacity. */
  opacity?: number;
  /** Onda 26 Fase 5 — label de cor. Ver PrincipalLayerMeta.colorLabel. */
  colorLabel?: LayerColorLabel;
  /** Onda 26 Fase 5 — blend mode. Ver PrincipalLayerMeta.blendMode. */
  blendMode?: LayerBlendMode;
  kind: 'visual';
  /** Material (texture) applied to this layer. Null when no texture is applied. */
  materialId: string | null;
  /**
   * FK → engravings.id quando a camada veio do Banco de Gravações (Onda 8.5).
   * Null/undefined = camada visual genérica (rect, slot, etc).
   * A Onda 9 (export) vai ler esse campo pra rotear gravação pra máquina
   * correta via engraving.metadata — ver IDEAS/onda-9-export-respeita-layer-visible.md.
   */
  engravingId?: string;
  /**
   * FK → markings.id quando a camada veio do Banco de Marcações (Onda 9).
   * Null/undefined = camada visual genérica. Espelha engravingId — mesma
   * função no export (rotear pra máquina via marking.operation/machines).
   */
  markingId?: string;
};

/** Union of all LayerMeta variants. Narrow with `kind` discriminant or type guards. */
export type LayerMeta = PrincipalLayerMeta | OperationLayerMeta | VisualLayerMeta;

/**
 * Minimal representation of a serialized Fabric.js object stored in canvasJson.
 * `id` is the stable Capi UUID; `capiSlot` is present for slot-typed objects (Onda 4+).
 * Extended fields come from Fabric's own toObject — typed loosely as Record<string, unknown>.
 */
export type FabricObject = {
  type: string;
  id: string;
  capiSlot?: SlotMeta;
  [key: string]: unknown;
};

/**
 * Onda 13 — descritor de cada item (broche) na prancha.
 * - productId: produto desse broche (cada item da prancha pode ter produto diferente).
 * - offsetX/offsetY: posição (mm) da origem do broche dentro do canvas único da prancha.
 *
 * Pedido com 1 broche = items.length===1, offsets=0. Padrão (master) idem.
 * Coluna 2 (6º+ broche) tem offsetX > 0.
 */
export type CanvasItem = {
  productId: string;
  offsetX: number;
  offsetY: number;
};

export type FabricCanvasJson = {
  version: string;
  objects: FabricObject[];
  background?: string;
  capi?: {
    /**
     * Items da prancha. Onda 13 (schemaVersion≥3): sempre presente, mínimo 1.
     * Padrões master sempre têm items.length===1 + offsets zerados.
     */
    items: CanvasItem[];
    units: 'mm';
    /**
     * Schema version for the LayerMeta format within capi.layers.
     *   1 = flat type (Ondas 3-5, pre-Fase C)
     *   2 = discriminated union (Fase C+, ADR 010 §1) — envelope tinha capi.productId
     *   3 = Onda 13 multi-broche — envelope troca productId por items[]
     * Absent = treat as version 1.
     */
    schemaVersion: number;
    layers: LayerMeta[];
  };
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

// Onda 13 — Multi-broche. orders agora guarda apenas metadados do pedido
// (cliente, status, marketplace, pasta, archived) + outputs da prancha inteira
// (exported_png_path, exported_svg_paths). Os 5 campos que antes ficavam aqui
// (pattern_id, product_id, material_id, fields, canvas_json) viraram propriedade
// de cada `order_items` (cada broche na prancha) — migration v10.
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  status: text('status').notNull().default('novo'),
  // 6 valores Kanban: 'novo' | 'aguardando_info' | 'arte_enviada' | 'aprovado'
  // | 'em_producao' | 'enviado'. Migração v9 traduziu 'pendente'/'enviado_cliente' → 'novo'.
  exportedPngPath: text('exported_png_path'),
  exportedSvgPaths: text('exported_svg_paths'), // JSON: string[]
  customerName: text('customer_name'), // preenchido no modal "Novo Pedido"
  olistOrderId: text('olist_order_id'), // integração marketplace (Fase 2)
  marketplace: text('marketplace'), // 'shopee' | 'mercado_livre' | 'whatsapp' | NULL
  folderPath: text('folder_path'), // pasta do pedido (editor Fase D)
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  // Onda 14b-schema (migration v12) — snapshot do canvas único da prancha
  // (com todos os broches juntos), serializado via CanvasEngine.serialize.
  // Substitui a gambiarra da Onda 13.7 que gravava em order_items[0].canvas_json.
  boardCanvasJson: text('board_canvas_json').notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 14.1. ORDER_ITEMS ────────────────────────────────────────────────────────
// Onda 13 — cada linha = 1 broche na prancha de um pedido.
// position é a ordem na prancha (0-based). Máx 5 por coluna; item 6+ vai pra
// coluna 2 — a regra de offset X/Y é aplicada pelo canvas (não pelo banco).
// product_id/pattern_id/material_id nullable: item nasce vazio, operador
// escolhe depois. fields/canvas_json default '{}' por isso mesmo.
export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  productId: text('product_id').references(() => products.id),
  patternId: text('pattern_id').references(() => patterns.id),
  materialId: text('material_id').references(() => materials.id),
  fields: text('fields').notNull().default('{}'), // JSON: OrderFields
  canvasJson: text('canvas_json').notNull().default('{}'), // JSON: FabricCanvasJson per item
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── 14.5. ORDER_REVISIONS ─────────────────────────────────────────────────────
// Onda 11: histórico imutável de revisões de cada pedido.
//
// Onda 13 (multi-broche): o snapshot mudou de shape. Antes era
// fields+materialId+canvasJson (uma arte por pedido). Agora é items_json:
// JSON com o array completo de order_items daquela revisão (cada item com
// seu próprio product/pattern/material/fields/canvasJson). exportedPngPath
// e isApproved continuam por revisão (output da prancha inteira + aprovação
// do cliente).
//
// Invariante mantida: toda mudança em order_items que justifique versionar
// (operador clicou "Salvar revisão") cria uma linha aqui DENTRO da mesma
// transação SQL — ver ADR 017 e orderRepository.saveRevision.
//
// UNIQUE INDEX em (orderId, number) protege contra race condition: INSERT
// concorrente com mesmo `number` aborta limpo.
export const orderRevisions = sqliteTable('order_revisions', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(), // 1, 2, 3... humano-visível
  // JSON: Array<{ id, position, productId, patternId, materialId, fields, canvasJson }>
  // — snapshot completo dos items dessa revisão. Repository serializa/desserializa.
  itemsJson: text('items_json').notNull(),
  // Onda 14b-schema (migration v12) — snapshot do canvas da prancha pra esta
  // revisão. Mesma analogia de orders.boardCanvasJson — fonte de verdade pra
  // reabrir uma revisão antiga.
  boardCanvasJson: text('board_canvas_json').notNull().default('{}'),
  exportedPngPath: text('exported_png_path'), // path do PNG da prancha dessa revisão
  isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false), // Onda 12
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
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
  // Onda 9: operação e máquinas — usadas pelo motor de exportação SVG pra
  // rotear cada asset pra arquivo de máquina correto + aplicar cor semântica.
  // operation: 'corte' | 'marcacao' | 'gravacao'. machines: JSON array de
  // ids (1-3 entries). Validação runtime no repository.
  operation: text('operation').notNull().default('corte'),
  machines: text('machines').notNull().default('[]'), // JSON: string[] de machine ids
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── 20. ENGRAVINGS ────────────────────────────────────────────────────────────
// Bank of reusable engraving SVGs (logos, icons, ornaments to engrave).
// categoryId: nullable FK to categories — Onda 8.5 added. Engravings sem
// categoria (legados ou auto-importados pela Onda 10) ficam com NULL.
export const engravings = sqliteTable('engravings', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  filePath: text('file_path').notNull(), // relative to appData/assets/engravings/
  thumbnailPath: text('thumbnail_path'),
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags').notNull().default('[]'), // JSON: string[]
  metadata: text('metadata'), // JSON: arbitrary extra data
  categoryId: text('category_id').references(() => categories.id),
  // Onda 9: rota pra exportação SVG. Ver appliques acima pra contrato.
  operation: text('operation').notNull().default('gravacao'),
  machines: text('machines').notNull().default('[]'),
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
  // Onda 9: categoryId (nullable FK) — espelha engravings. Marcações sem
  // categoria têm NULL.
  categoryId: text('category_id').references(() => categories.id),
  // Onda 9: rota pra exportação SVG. Ver appliques pra contrato. Note que
  // "Marcação banco" (asset reutilizável) é DIFERENTE de "operação Marcação"
  // (cor azul, máquina específica) — operation aqui é a operação de produção
  // que ESTE asset dispara, geralmente 'marcacao' mas pode ser outra.
  operation: text('operation').notNull().default('marcacao'),
  machines: text('machines').notNull().default('[]'),
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
