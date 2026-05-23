/**
 * Drizzle schema — catálogo global do Capi Studio.
 *
 * Pós-Onda 2B: persistência de projetos é filesystem-first (ver
 * PROJECT_VISION.md §10). Este schema mantém APENAS catálogos
 * reutilizáveis entre projetos: máquinas, operações, fontes,
 * categorias, materiais, produtos, settings.
 *
 * Tabelas dropadas via migration 0013_drop_dead_tables.sql:
 *   orders, order_items, order_revisions, order_overrides,
 *   patterns, pattern_layers, pattern_slots, logos, svg_bases,
 *   slot_types, appliques, engravings, markings, export_history.
 */
import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── MACHINES ────────────────────────────────────────────────────────────────
// MB, FB, DL (ver PROJECT_VISION §0.1).
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── OPERATIONS ──────────────────────────────────────────────────────────────
// corte, gravação, marcação (ver PROJECT_VISION §0.1).
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  defaultColor: text('default_color').notNull(),
});

// ── MACHINE_OPERATIONS (N:N) ────────────────────────────────────────────────
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

// ── FONTS ────────────────────────────────────────────────────────────────────
export const fonts = sqliteTable('fonts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  family: text('family').notNull(),
  source: text('source').notNull(),
  file: text('file'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── CATEGORIES ───────────────────────────────────────────────────────────────
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
  color: text('color'),
});

// ── PRODUCTS ─────────────────────────────────────────────────────────────────
// Onda 2B: o MVP só tem broche 60×25mm. Outros virão por seed/upload futuro.
export type ProductConstraints = { sizeLocked: boolean; minGapMm: number };
export type ProductConfig = {
  usableArea?: { x: number; y: number; w: number; h: number };
  bleedMm?: number;
  compatibleMaterials?: string[];
};

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  icon: text('icon'),
  status: text('status').notNull().default('published'),
  canvasMm: text('canvas_mm').notNull(),
  viewBox: text('view_box').notNull(),
  allowedSlotTypes: text('allowed_slot_types').notNull().default('[]'),
  constraints: text('constraints').notNull(),
  versionRev: integer('version_rev').notNull().default(1),
  baseSvg: text('base_svg'),
  config: text('config'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// ── PRODUCT_MACHINES (N:N) ──────────────────────────────────────────────────
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

// ── PRODUCT_LAYERS ──────────────────────────────────────────────────────────
// Camadas base de um produto (contorno, área de gravação, etc.).
export const productLayers = sqliteTable('product_layers', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  zIndex: integer('z_index').notNull().default(0),
  svg: text('svg'),
  defaultOperation: text('default_operation').references(() => operations.id),
});

// ── MATERIAL_FAMILIES ────────────────────────────────────────────────────────
export const materialFamilies = sqliteTable('material_families', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  brushed: integer('brushed', { mode: 'boolean' }).notNull().default(false),
});

// ── MATERIALS ────────────────────────────────────────────────────────────────
export const materials = sqliteTable('materials', {
  id: text('id').primaryKey(),
  familyId: text('family_id')
    .notNull()
    .references(() => materialFamilies.id),
  label: text('label').notNull(),
  swatch: text('swatch').notNull(),
  pngPath: text('png_path').notNull(),
  fallbackStops: text('fallback_stops'),
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ─────────────────────────────────────────────────────────────────────────────
// Tipos canônicos do domínio (usados em código não-Drizzle).
// ─────────────────────────────────────────────────────────────────────────────

/** Códigos de máquina (spec). Tradução para IDs do banco em src/lib/machine-codes.ts. */
export type MachineCode = 'M1' | 'M2' | 'M3';

/** Operações de produção laser. */
export type ProcessType = 'corte' | 'gravacao' | 'marcacao';
