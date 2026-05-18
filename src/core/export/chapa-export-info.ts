/**
 * chapa-export-info.ts — Onda 27 (Fase C: export por chapa).
 *
 * Função pura que transforma o `ChapasLayout` (vindo do useBoardEngine) em
 * uma lista de descritores prontos pra alimentar os exporters (PNG, SVG, DXF).
 *
 * Cada descritor traz:
 *   - bbox da chapa em **px do canvas Fabric** (consumível direto pelo
 *     png-exporter via `clientBounds`)
 *   - bbox da chapa em **mm** (pro svg-exporter wrapAsBoardSvg / dxf)
 *   - label legível ("Broche 60x25") pra entrar no filename quando 2+ chapas
 *   - índices originais dos items da chapa (pra filtrar canvases/layers
 *     na orquestração por chapa)
 *
 * **Convenções (Onda 26e):**
 *   - As coordenadas em `ChapasLayout.chapas[i].bbox` incluem `CHAPA_LABEL_HEIGHT_MM`
 *     (8mm) no topo, reservado pro label visual. Pro export, descontamos isso
 *     do bbox de export — o label NÃO sai no PNG/SVG (excludeFromExport
 *     marcado no engine), e a margem em volta dos broches já é cuidada pelo
 *     png-exporter (`MOCKUP_MARGIN_MM`).
 *
 * Sem dependências de Fabric/DOM — testável puro.
 */
import type { Chapa, ChapasLayout } from '@/hooks/useBoardEngine';

/** Espaço reservado pra label em cima de cada chapa (mesmo valor do useBoardEngine). */
const CHAPA_LABEL_HEIGHT_MM = 8;
/** mm → px do canvas Fabric (mesma convenção: 4 px/mm). */
const MM_TO_PX = 4;

export interface ChapaExportInfo {
  /** ID interno da chapa = productId. */
  productId: string;
  /** Label legível pro filename ("Broche 60x25"). Sanitizado (sem espaço, sem acento). */
  filenameToken: string;
  /** Label legível pro UI ("Broche 60x25"). */
  displayLabel: string;
  /** Índices originais (no boardItems[]) dos items que pertencem a esta chapa. */
  itemIndexes: number[];
  /** Bbox da chapa em mm, JÁ descontado o label-height do topo. */
  bboxMm: { leftMm: number; topMm: number; widthMm: number; heightMm: number };
  /** Bbox da chapa em px do canvas Fabric, pronto pra `clientBounds` do PNG. */
  bboxPx: { leftPx: number; topPx: number; rightPx: number; bottomPx: number };
}

/**
 * Sanitiza um label pra entrar em filename: minúsculas, sem acentos, espaços
 * viram underscore, caracteres não-alfanuméricos viram nada. "Broche 60x25" →
 * "broche_60x25". Idempotente.
 */
export function sanitizeForFilename(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Constrói os descritores de export por chapa.
 *
 * @param chapasLayout  Layout vindo do useBoardEngine (já contém posições).
 * @param productLabels Map productId → label legível ("Broche 60x25"). Quando
 *                      o productId não está no map, cai pro próprio id como
 *                      fallback.
 */
export function buildChapaExportInfos(
  chapasLayout: ChapasLayout,
  productLabels: Map<string, string>
): ChapaExportInfo[] {
  return chapasLayout.chapas.map((chapa: Chapa) => {
    const displayLabel = productLabels.get(chapa.productId) || chapa.productId;
    const filenameToken = sanitizeForFilename(displayLabel);
    const itemIndexes = chapa.items.map((it) => it.originalIndex);

    // Bbox em mm sem o label do topo.
    const leftMm = chapa.bbox.leftMm;
    const topMm = chapa.bbox.topMm + CHAPA_LABEL_HEIGHT_MM;
    const widthMm = chapa.bbox.widthMm;
    const heightMm = Math.max(0, chapa.bbox.heightMm - CHAPA_LABEL_HEIGHT_MM);

    return {
      productId: chapa.productId,
      filenameToken,
      displayLabel,
      itemIndexes,
      bboxMm: { leftMm, topMm, widthMm, heightMm },
      bboxPx: {
        leftPx: leftMm * MM_TO_PX,
        topPx: topMm * MM_TO_PX,
        rightPx: (leftMm + widthMm) * MM_TO_PX,
        bottomPx: (topMm + heightMm) * MM_TO_PX,
      },
    };
  });
}
