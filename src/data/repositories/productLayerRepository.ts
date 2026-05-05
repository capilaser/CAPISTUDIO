import { getDb } from '../client';

export interface ProductLayer {
  id: string;
  productId: string;
  name: string;
  zIndex: number;
  svg: string | null;
  defaultOperation: string | null;
}

export async function getLayersByProductId(productId: string): Promise<ProductLayer[]> {
  const db = await getDb();
  return db.select<ProductLayer[]>(
    `SELECT id, product_id as productId, name, z_index as zIndex,
            svg, default_operation as defaultOperation
     FROM product_layers WHERE product_id = ? ORDER BY z_index`,
    [productId]
  );
}
