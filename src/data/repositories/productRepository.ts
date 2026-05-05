import { getDb } from '../client';
import type { ProductConstraints, ProductConfig } from '../schema';

export interface Product {
  id: string;
  type: string;
  label: string;
  icon: string | null;
  status: string;
  canvasMm: { width: number; height: number };
  viewBox: string;
  allowedSlotTypes: string[];
  constraints: ProductConstraints;
  versionRev: number;
  baseSvg: string | null;
  config: ProductConfig | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface ProductRow {
  id: string;
  type: string;
  label: string;
  icon: string | null;
  status: string;
  canvasMm: string; // JSON
  viewBox: string;
  allowedSlotTypes: string; // JSON
  constraints: string; // JSON
  versionRev: number;
  baseSvg: string | null;
  config: string | null; // JSON
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

function toProduct(row: ProductRow): Product {
  return {
    ...row,
    canvasMm: JSON.parse(row.canvasMm) as { width: number; height: number },
    allowedSlotTypes: JSON.parse(row.allowedSlotTypes) as string[],
    constraints: JSON.parse(row.constraints) as ProductConstraints,
    config: row.config ? (JSON.parse(row.config) as ProductConfig) : null,
  };
}

const SELECT_COLS = `
  id, type, label, icon, status,
  canvas_mm as canvasMm, view_box as viewBox,
  allowed_slot_types as allowedSlotTypes, constraints,
  version_rev as versionRev, base_svg as baseSvg, config,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
`;

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.select<ProductRow[]>(
    `SELECT ${SELECT_COLS} FROM products WHERE deleted_at IS NULL ORDER BY label`
  );
  return rows.map(toProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await getDb();
  const rows = await db.select<ProductRow[]>(
    `SELECT ${SELECT_COLS} FROM products WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toProduct(rows[0]) : null;
}

export async function getProductMachineIds(productId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<Array<{ machineId: string }>>(
    'SELECT machine_id as machineId FROM product_machines WHERE product_id = ?',
    [productId]
  );
  return rows.map((r) => r.machineId);
}
