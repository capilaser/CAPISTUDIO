/**
 * material-applier.ts — Onda 5, Checkpoint B
 *
 * Pure module: builds fabric.Pattern objects for PNG material application.
 * No DOM side-effects beyond creating <img> elements; fully testable in
 * Node/Vitest by injecting a mock loader.
 *
 * Exports:
 *   loadImage            — loads an HTMLImageElement from a URL
 *   buildMaterialPattern — flat fill; covers the layer's bounding box
 *
 * Product-contour clipping (Checkpoint C) is handled by canvas-engine.ts via
 * fabric.Path + absolutePositioned: true (Cenário 1, ADR 008).
 *
 * ADR 008 — Decisão 6: lógica de aplicação isolada aqui; canvas-engine orquestra.
 */
import * as fabric from 'fabric';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Loads an HTMLImageElement from a URL.
 * Extracted as a named export so Vitest can vi.mock() it without touching the rest.
 *
 * Onda 9.G fix — crossOrigin='anonymous' é obrigatório:
 *   Tauri 2 envia `Access-Control-Allow-Origin: <window_origin>` no asset
 *   protocol automaticamente (ver crates/tauri/src/protocol/asset.rs no
 *   source). Sem `crossOrigin='anonymous'` no <img>, o browser carrega
 *   no-cors e ignora o header — a textura entra como tainted no canvas e
 *   `canvas.toDataURL()` (Fase 9E) lança SecurityError em runtime.
 *   Setar `crossOrigin` faz o browser HONRAR o header CORS e marcar a
 *   imagem como CORS-clean.
 *
 *   ATENÇÃO: `crossOrigin` PRECISA ser setado ANTES de `img.src = url`.
 *   Se setado depois, o request já saiu sem CORS e o atributo é ignorado.
 *
 *   Descoberto em validação visual real do Gabriell (Fase 9.F) — jsdom
 *   não reproduz comportamento de CORS, então testes verdes não capturaram.
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`[material-applier] Failed to load image: ${url}`));
    img.src = url;
  });
}

/**
 * Builds a fabric.Pattern that covers exactly the given local dimensions
 * of a Fabric object.
 *
 * `patternTransform` scales the source image to fill `localWidth × localHeight`
 * in object-local coordinate space (i.e. before the object's own scaleX/scaleY
 * are applied). This means the material stretches automatically when the user
 * scales the object — no extra event listeners needed.
 *
 * @param assetUrl    WebView-accessible URL (http://asset.localhost/…  from convertFileSrc)
 * @param localWidth  obj.width  — unscaled canvas units (pixels at MM_TO_PX)
 * @param localHeight obj.height — unscaled canvas units
 * @param loader      Optional image loader override — injected in tests to avoid real network.
 *                    Defaults to the module-level `loadImage`.
 */
export async function buildMaterialPattern(
  assetUrl: string,
  localWidth: number,
  localHeight: number,
  loader: (url: string) => Promise<HTMLImageElement> = loadImage
): Promise<fabric.Pattern> {
  const img = await loader(assetUrl);

  return new fabric.Pattern({
    source: img,
    repeat: 'no-repeat',
    patternTransform: [localWidth / img.naturalWidth, 0, 0, localHeight / img.naturalHeight, 0, 0],
  });
}
