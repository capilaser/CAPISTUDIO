/**
 * engine-material.ts — funções puras de aplicação de material/textura (Onda 30.C).
 *
 * Extraído de canvas-engine.ts. Cobre:
 *  - applyMaterialToLayer (aplica Pattern fill + clipPath em camada)
 *  - applyMaterialToBase (aplica textura na base do produto via rect filho)
 *  - removeMaterialFromLayer
 *  - preloadMaterials (warm cache pós-deserialize)
 *  - buildProductClipPath (helper compartilhado pra montar o clipPath)
 *  - cachedImageLoader (helper de dedupe in-flight)
 *
 * Cache de Promise<HTMLImageElement> (dedupe in-flight) vive na engine como
 * `materialImageCache: Map<string, Promise<HTMLImageElement>>` — passada por
 * parâmetro pra cá. ADR Onda 15.fix: armazenamos a Promise, não a Image.
 */
import * as fabric from 'fabric';

import type { LayerMeta } from '@/data/schema';
import { buildMaterialPattern, loadImage } from './material-applier';
import { isOperationLayer } from './layer-meta';
import { mmToPx } from './units';

const DEFAULT_LAYER_FILL = 'rgba(122, 162, 247, 0.18)';

/**
 * Cached loader for HTMLImageElement keyed by materialId.
 * Dedupes parallel calls for the same materialId (3 layers applying same
 * material → 1 IPC call). Failure removes the entry so a retry can succeed.
 */
function makeCachedLoader(
  materialImageCache: Map<string, Promise<HTMLImageElement>>,
  materialId: string
): (url: string) => Promise<HTMLImageElement> {
  return (url: string): Promise<HTMLImageElement> => {
    const hit = materialImageCache.get(materialId);
    if (hit) return hit;
    const promise = loadImage(url).catch((err) => {
      materialImageCache.delete(materialId);
      throw err;
    });
    materialImageCache.set(materialId, promise);
    return promise;
  };
}

/**
 * Builds a `fabric.Path` representing the product's SVG contour for use as
 * an `absolutePositioned` clipPath (Checkpoint C, Cenário 1 — ADR 008).
 *
 * Returns null when no product SVG has been loaded yet.
 *
 * Coordinate mapping:
 *   Path data is in SVG user units (mm). `scaleX`/`scaleY` map those units
 *   to canvas pixels so the clip aligns with the product group, which is
 *   always placed at canvas (0, 0) with the same scale factors.
 *
 * Multiple shapes are concatenated into a single compound path string to
 * avoid `fabric.Group` — which has known `absolutePositioned` issues in
 * Fabric 6 (GitHub #7742).
 */
export function buildProductClipPath(
  canvas: fabric.Canvas,
  isBaseObject: (o: fabric.FabricObject) => boolean,
  productPaths: string[],
  productSvgViewBox: { width: number; height: number } | null,
  productWidthMm: number,
  productHeightMm: number
): fabric.Path | null {
  if (productPaths.length === 0 || !productSvgViewBox) return null;

  const sx = mmToPx(productWidthMm) / productSvgViewBox.width;
  const sy = mmToPx(productHeightMm) / productSvgViewBox.height;

  // Resolve the product group's canvas position so the clip aligns precisely.
  const productGroup = canvas.getObjects().find((o) => isBaseObject(o));
  const pgLeft = productGroup?.left ?? 0;
  const pgTop = productGroup?.top ?? 0;

  return new fabric.Path(productPaths.join(' '), {
    left: pgLeft,
    top: pgTop,
    originX: 'left',
    originY: 'top',
    scaleX: sx,
    scaleY: sy,
    absolutePositioned: true,
  });
}

/**
 * Applies a PNG material to a visual layer.
 *
 * - Sets a `fabric.Pattern` fill on the Fabric object (Checkpoint B).
 * - When a product SVG has been loaded, also applies an `absolutePositioned`
 *   `fabric.Path` clip matching the product's contour (Checkpoint C, Cenário 1).
 */
export async function applyMaterialToLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  materialImageCache: Map<string, Promise<HTMLImageElement>>,
  findById: (id: string) => fabric.FabricObject | undefined,
  buildClip: () => fabric.Path | null,
  layerId: string,
  materialId: string,
  assetUrl: string
): Promise<void> {
  const obj = findById(layerId);
  if (!obj) return;

  const w = obj.width ?? 0;
  const h = obj.height ?? 0;

  // DEBUG Onda 18 — bug material dourado→prata.
  // Log estruturado: entrada da função + estado do cache no momento.
  // Remove quando bug for resolvido (memory: debt_material_dourado_prata).
  const cacheHadKey = materialImageCache.has(materialId);
  if (import.meta.env.DEV) {
    console.log(
      `[DEBUG-mat] applyMaterialToLayer(layerId="${layerId}", materialId="${materialId}", ` +
        `urlTail="${assetUrl.split('/').slice(-2).join('/')}", cacheHit=${cacheHadKey}, ` +
        `cacheKeys=[${Array.from(materialImageCache.keys()).join(',')}])`
    );
  }

  const cachedLoader = makeCachedLoader(materialImageCache, materialId);
  const pattern = await buildMaterialPattern(assetUrl, w, h, cachedLoader);

  // Single set() call — avoids any intermediate render on the animation frame
  // between setting fill and clipPath (Fabric Q3 recommendation).
  const clipPath = buildClip();
  obj.set(clipPath !== null ? { fill: pattern, clipPath } : { fill: pattern });

  // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
  const meta = layerMeta.get(layerId);
  if (meta && !isOperationLayer(meta)) meta.materialId = materialId;

  canvas.requestRenderAll();
}

/**
 * Applies a PNG material to the product base (Onda 12 F4.3).
 *
 * Diferença pra applyMaterialToLayer:
 *  - Atua no grupo marcado com BASE_OBJECT_FLAG.
 *  - NÃO precisa de clipPath: a base já é o silhouette do produto.
 *  - Cria um `__capiMaterialRect` entre fundo do canvas e a base.
 */
export async function applyMaterialToBase(
  canvas: fabric.Canvas,
  materialImageCache: Map<string, Promise<HTMLImageElement>>,
  isBaseObject: (o: fabric.FabricObject) => boolean,
  buildClip: () => fabric.Path | null,
  productWidthMm: number,
  productHeightMm: number,
  materialId: string,
  assetUrl: string
): Promise<void> {
  const baseObj = canvas.getObjects().find((o) => isBaseObject(o));
  if (!baseObj) {
    if (import.meta.env.DEV) {
      console.warn('[canvas-engine] applyMaterialToBase: no base object loaded.');
    }
    return;
  }

  const w = mmToPx(productWidthMm);
  const h = mmToPx(productHeightMm);

  const cachedLoader = makeCachedLoader(materialImageCache, materialId);
  const pattern = await buildMaterialPattern(assetUrl, w, h, cachedLoader);
  const clipPath = buildClip();

  // Remove rect de material anterior se existir.
  const existing = canvas
    .getObjects()
    .find((o) => (o as unknown as Record<string, unknown>).__capiMaterialRect === true);
  if (existing) canvas.remove(existing);

  // Rect que recebe o material — mesmo tamanho do produto, clipado pelo contorno.
  // Fica entre a base (contorno) e o fundo do canvas, excluído do export production.
  const rect = new fabric.Rect({
    left: baseObj.left ?? 0,
    top: baseObj.top ?? 0,
    width: w,
    height: h,
    fill: pattern,
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    excludeFromExport: true,
    ...(clipPath ? { clipPath } : {}),
  });
  (rect as unknown as Record<string, unknown>).__capiMaterialRect = true;

  canvas.add(rect);
  // Rect fica logo acima do fundo (sendObjectToBack move pra index 0),
  // mas abaixo da base (contorno) e de tudo mais.
  canvas.sendObjectToBack(rect);
  // A base (contorno) deve ficar na frente do rect — move pra segundo plano.
  canvas.sendObjectToBack(baseObj);

  canvas.requestRenderAll();
}

/**
 * Pre-loads HTMLImageElement instances into the cache so that subsequent
 * applyMaterialToLayer calls for the same materialId are instant.
 *
 * Call this from the UI layer after deserialize() — pass the materialIds
 * found in capi.layers together with their resolved Tauri asset URLs.
 */
export async function preloadMaterials(
  materialImageCache: Map<string, Promise<HTMLImageElement>>,
  entries: Array<{ id: string; url: string }>
): Promise<void> {
  // Onda 15.fix — cache armazena Promise pra in-flight dedupe; preload registra
  // a promise direto e await coletivo no final.
  const promises: Array<Promise<HTMLImageElement | null>> = entries.map(({ id, url }) => {
    if (materialImageCache.has(id)) {
      return materialImageCache.get(id)!.catch(() => null);
    }
    const p = loadImage(url).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn(`[canvas-engine] preloadMaterials: failed to load "${id}":`, err);
      }
      materialImageCache.delete(id);
      throw err;
    });
    materialImageCache.set(id, p);
    return p.catch(() => null);
  });
  await Promise.all(promises);
}

/**
 * Removes the material from a layer, restoring the default layer fill
 * and clearing the product-contour clipPath if one was applied.
 */
export function removeMaterialFromLayer(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  findById: (id: string) => fabric.FabricObject | undefined,
  layerId: string
): void {
  const obj = findById(layerId);
  if (!obj) return;

  obj.set({ fill: DEFAULT_LAYER_FILL, clipPath: undefined });

  // Operation layers have no materialId (ADR 010 §1). Narrow before mutating.
  const meta = layerMeta.get(layerId);
  if (meta && !isOperationLayer(meta)) meta.materialId = null;

  canvas.requestRenderAll();
}
