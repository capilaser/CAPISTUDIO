/**
 * engine-board.ts — funções puras de viewport e prancha multi-broche (Onda 30.D).
 *
 * Extraído de canvas-engine.ts. Cobre:
 *  - centerProductInViewport (recentra prancha, zoom=1)
 *  - zoomBy (multiplica zoom clampado, no centro do viewport)
 *  - fitBoardToViewport (encaixa toda a prancha com margem)
 *  - fitRegionToViewport (encaixa uma chapa/região específica)
 *  - resizeViewport (atualiza dimensões + reflua)
 *  - renderChapaLabels (labels de chapa em cima de cada grupo)
 *  - setActiveBoardHighlight (outline azul ao redor do broche ativo)
 *
 * Pan handlers / wheel zoom / selection handlers ficam na classe — eles
 * dependem de state mutable (isPanModeActive, isDragging) que vive na engine.
 */
import * as fabric from 'fabric';

import { mmToPx } from './units';

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;

export interface ViewportConfig {
  productWidthMm: number;
  productHeightMm: number;
  viewportWidthPx: number;
  viewportHeightPx: number;
}

/**
 * Translates the viewport so the product origin (0,0 mm) lands at the
 * top-left of the centered product area. Resets zoom to 1.
 */
export function centerProductInViewport(canvas: fabric.Canvas, config: ViewportConfig): void {
  const productPxW = mmToPx(config.productWidthMm);
  const productPxH = mmToPx(config.productHeightMm);
  const tx = (config.viewportWidthPx - productPxW) / 2;
  const ty = (config.viewportHeightPx - productPxH) / 2;
  canvas.setViewportTransform([1, 0, 0, 1, tx, ty]);
}

/** Multiplies current zoom by `factor`, clamped, centered on viewport center. */
export function zoomBy(canvas: fabric.Canvas, config: ViewportConfig, factor: number): void {
  const current = canvas.getZoom();
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * factor));
  if (next === current) return;
  const center = new fabric.Point(config.viewportWidthPx / 2, config.viewportHeightPx / 2);
  canvas.zoomToPoint(center, next);
  canvas.requestRenderAll();
}

/**
 * Onda 26d — encaixa a prancha inteira no viewport com margem percentual.
 * Calcula o zoom que faz `productWidthMm × productHeightMm` caber em
 * `viewportWidthPx × viewportHeightPx × (1 - 2*margin)` e centraliza.
 * Margin 0.15 = 15% de espaço em cada borda. Clampado em [ZOOM_MIN, ZOOM_MAX].
 *
 * "Prancha inteira" significa a área lógica do canvas-engine (productWidth/Height),
 * que pro Novo Pedido contém todos os broches empilhados.
 */
export function fitBoardToViewport(
  canvas: fabric.Canvas,
  config: ViewportConfig,
  margin = 0.15
): void {
  const productPxW = mmToPx(config.productWidthMm);
  const productPxH = mmToPx(config.productHeightMm);
  if (productPxW <= 0 || productPxH <= 0) return;

  const availableW = config.viewportWidthPx * (1 - 2 * margin);
  const availableH = config.viewportHeightPx * (1 - 2 * margin);
  const scale = Math.min(availableW / productPxW, availableH / productPxH);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));

  const scaledW = productPxW * zoom;
  const scaledH = productPxH * zoom;
  const tx = (config.viewportWidthPx - scaledW) / 2;
  const ty = (config.viewportHeightPx - scaledH) / 2;

  canvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
  canvas.requestRenderAll();
}

/**
 * Onda 27 (Fase C+) — enquadra uma região da prancha em mm (uma chapa
 * específica) no viewport. Usado pelas "abas" da sidebar: ao trocar de
 * broche ativo numa prancha multi-chapa, focamos só a chapa daquele
 * broche, sem mexer no conteúdo do canvas.
 */
export function fitRegionToViewport(
  canvas: fabric.Canvas,
  config: ViewportConfig,
  bboxMm: { leftMm: number; topMm: number; widthMm: number; heightMm: number },
  margin = 0.15
): void {
  const regionPxW = mmToPx(bboxMm.widthMm);
  const regionPxH = mmToPx(bboxMm.heightMm);
  if (regionPxW <= 0 || regionPxH <= 0) return;

  const availableW = config.viewportWidthPx * (1 - 2 * margin);
  const availableH = config.viewportHeightPx * (1 - 2 * margin);
  const scale = Math.min(availableW / regionPxW, availableH / regionPxH);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));

  const scaledW = regionPxW * zoom;
  const scaledH = regionPxH * zoom;
  // Desconta o offset da chapa em px do canvas — assim a origem da chapa
  // vai cair no canto superior-esquerdo do retângulo centralizado.
  const offsetPxX = mmToPx(bboxMm.leftMm) * zoom;
  const offsetPxY = mmToPx(bboxMm.topMm) * zoom;
  const tx = (config.viewportWidthPx - scaledW) / 2 - offsetPxX;
  const ty = (config.viewportHeightPx - scaledH) / 2 - offsetPxY;

  canvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty]);
  canvas.requestRenderAll();
}

/**
 * Onda 26d — atualiza dimensões internas do viewport e re-encaixa a prancha.
 * Chamado pelo ResizeObserver do container quando a janela muda.
 *
 * Muta `config` in-place (ele é shared com a engine que carrega o mesmo objeto).
 */
export function resizeViewport(
  canvas: fabric.Canvas,
  config: ViewportConfig,
  widthPx: number,
  heightPx: number
): void {
  if (widthPx <= 0 || heightPx <= 0) return;
  config.viewportWidthPx = widthPx;
  config.viewportHeightPx = heightPx;
  canvas.setDimensions({ width: widthPx, height: heightPx });
  fitBoardToViewport(canvas, config);
}

/**
 * Onda 26e — renderiza labels de chapas em cima de cada grupo. Idempotente:
 * remove labels anteriores antes de criar os novos. Labels têm
 * `excludeFromExport: true` e não interferem em snap/alinhamento.
 *
 * `entries` em mm; converte pra px internamente. `text` já é o label final
 * formatado pela UI.
 *
 * Recebe o array de labels da engine por referência e o substitui in-place
 * (slice + push) pra manter a referência shared.
 */
export function renderChapaLabels(
  canvas: fabric.Canvas,
  chapaLabels: fabric.Text[],
  entries: Array<{ leftMm: number; topMm: number; text: string }>
): void {
  // Remove labels antigos
  for (const old of chapaLabels) {
    canvas.remove(old);
  }
  chapaLabels.length = 0;

  if (entries.length === 0) {
    canvas.requestRenderAll();
    return;
  }

  for (const entry of entries) {
    const label = new fabric.Text(entry.text, {
      left: mmToPx(entry.leftMm),
      top: mmToPx(entry.topMm),
      originX: 'left',
      originY: 'top',
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: mmToPx(3.5), // ~3.5mm de altura — leitura confortável no auto-fit
      fill: 'rgba(255, 255, 255, 0.4)',
      selectable: false,
      evented: false,
      excludeFromExport: true,
      hoverCursor: 'default',
    });
    (label as unknown as Record<string, unknown>).__capiOverlay = true;
    canvas.add(label);
    chapaLabels.push(label);
  }
  canvas.requestRenderAll();
}

/**
 * Onda 16 — desenha (ou move) um outline ao redor do broche ativo na prancha.
 * Não-selecionável, não-exportável. Passar null remove o highlight.
 *
 * Retorna o novo highlight (ou null se removido) — a engine guarda essa
 * referência pra reutilizar nos próximos chamados.
 */
export function setActiveBoardHighlight(
  canvas: fabric.Canvas,
  current: fabric.Rect | null,
  region: { leftMm: number; topMm: number; widthMm: number; heightMm: number } | null
): fabric.Rect | null {
  if (region === null) {
    if (current) {
      canvas.remove(current);
      canvas.requestRenderAll();
    }
    return null;
  }

  const padPx = mmToPx(0.8); // pequeno offset pra não tampar a borda do broche
  const left = mmToPx(region.leftMm) - padPx;
  const top = mmToPx(region.topMm) - padPx;
  const width = mmToPx(region.widthMm) + padPx * 2;
  const height = mmToPx(region.heightMm) + padPx * 2;

  if (current) {
    current.set({ left, top, width, height });
    current.setCoords();
    canvas.bringObjectToFront(current);
    canvas.requestRenderAll();
    return current;
  }

  const rect = new fabric.Rect({
    left,
    top,
    width,
    height,
    originX: 'left',
    originY: 'top',
    fill: 'transparent',
    stroke: '#7aa2f7', // laser-muted (mesmo tom do focus ring do design system)
    strokeWidth: 1.5,
    strokeUniform: true,
    strokeDashArray: [4, 3],
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    excludeFromExport: true,
  });
  (rect as unknown as Record<string, unknown>).__capiOverlay = true;
  canvas.add(rect);
  canvas.bringObjectToFront(rect);
  canvas.requestRenderAll();
  return rect;
}
