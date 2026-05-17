/**
 * board-exporter.ts — Orquestrador de export multi-broche (Onda 13, Fase D).
 *
 * Cada pedido na Onda 13 é uma PRANCHA com N broches. A máquina laser recebe
 * 1 SVG por máquina envolvida — contendo TODOS os broches juntos, cada um
 * no offset correto.
 *
 * Este módulo NÃO toca em `exportSvgByMachine()` (svg-exporter.ts da Onda 9).
 * Ele é um wrapper externo que:
 *
 *   1. Chama `exportSvgByMachine()` para cada item da prancha (resultado:
 *      Map<machineId, svgString> por item, em coords locais do broche).
 *   2. Une os resultados num único Map<machineId, svgString> da PRANCHA:
 *      cada item entra como `<g transform="translate(offsetX, offsetY)">…</g>`
 *      dentro de um SVG novo com viewBox = bounding box da prancha inteira.
 *
 * O input vem do canvas vivo de cada broche (item.fabricCanvas) + descritor
 * com produto/offsets. O caller (UI da Fase D-bis, ou um futuro botão "SVG"
 * no editor) é quem decide quando exportar — quem chama é responsável por
 * passar canvases já materializados.
 *
 * Por que canvases vivos e não canvasJson serializado?
 *   - exportSvgByMachine() trabalha em cima de fabric.Canvas (lê
 *     canvas.getObjects() + obj.toSVG()). Pra exportar a partir de
 *     canvasJson teria que enlivenar fora-de-tela e isso é trabalho.
 *   - C2 entregou multi-broche em memória — o caller já tem N engines/canvases
 *     (ou os terá quando a UI conectar). Manter o board-exporter assumindo
 *     canvas vivo simplifica.
 *
 * Estados de erro (lança via item index pra rastreabilidade):
 *   - Mesmo conjunto de erros que exportSvgByMachine() — propagados com
 *     prefixo `[board-exporter] item ${index}:` pra facilitar diagnóstico.
 */
import type * as fabric from 'fabric';

import type { LayerMeta } from '@/data/schema';

import { exportSvgByMachine, type AssetLookupFn, type SvgExportOptions } from './svg-exporter';
import type { FontBufferLoader } from './svg-text-converter';

/** Conversão entre mm e px usada pelo svg-exporter (mantida em sync com PX_PER_MM=4). */
const PX_PER_MM = 4;

/** Descritor de cada broche na prancha pro export. */
export interface BoardItemExport {
  /** Canvas Fabric vivo desse broche. */
  canvas: fabric.Canvas;
  /** Layers do canvas (`engine.getAllLayerMetas()` ou `serialize().capi.layers`). */
  layers: LayerMeta[];
  /** Dimensões do PRODUTO desse broche (não da prancha). Em mm. */
  productWidthMm: number;
  productHeightMm: number;
  /** Posição da origem do broche dentro da prancha. Em mm. */
  offsetXmm: number;
  offsetYmm: number;
}

export interface BoardExportOptions {
  items: BoardItemExport[];
  /** Resolve asset id → operation+machines. Compartilhado entre todos os items. */
  assetLookup: AssetLookupFn;
  /** Opcional — convert text via opentype. Compartilhado entre items. */
  fontBufferLoader?: FontBufferLoader;
  /** Opcional — overrides de roteamento de texto (mesma chave que svg-exporter). */
  textRouting?: SvgExportOptions['textRouting'];
  /** Opcional — callback de erro de conversão de texto. */
  onTextConversionError?: SvgExportOptions['onTextConversionError'];
}

/**
 * Exporta a prancha inteira como Map<machineId, svgString>. Cada SVG tem
 * viewBox da prancha inteira, com cada broche translatado pro seu offset.
 *
 * Map vazio quando nenhum item tem conteúdo exportável.
 */
export async function exportBoardSvg(options: BoardExportOptions): Promise<Map<string, string>> {
  const { items, assetLookup, fontBufferLoader, textRouting, onTextConversionError } = options;

  if (items.length === 0) return new Map();

  // ── 1. Chama exportSvgByMachine pra cada item ──────────────────────────────
  /** index do item → Map<machineId, svgString> */
  const perItemResults: Array<Map<string, string>> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const result = await exportSvgByMachine(item.canvas, {
        productWidthMm: item.productWidthMm,
        productHeightMm: item.productHeightMm,
        layers: item.layers,
        assetLookup,
        fontBufferLoader,
        textRouting,
        onTextConversionError,
      });
      perItemResults.push(result);
    } catch (err) {
      throw new Error(`[board-exporter] item ${i}: ${String(err)}`);
    }
  }

  // ── 2. Coleta machineIds únicos ────────────────────────────────────────────
  const allMachines = new Set<string>();
  for (const r of perItemResults) {
    for (const m of r.keys()) allMachines.add(m);
  }
  if (allMachines.size === 0) return new Map();

  // ── 3. Calcula bounding box da prancha (em mm) ─────────────────────────────
  const board = computeBoardBounds(items);

  // ── 4. Pra cada machineId, monta SVG da prancha inteira ───────────────────
  const output = new Map<string, string>();
  for (const machineId of allMachines) {
    const itemGroups: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const itemSvg = perItemResults[i].get(machineId);
      if (!itemSvg) continue; // esse item não tem nada pra essa máquina

      const inner = extractInnerScaledGroup(itemSvg);
      if (!inner) continue;

      const item = items[i];
      // Wrapper de translate em mm — o inner já vem com transform="scale(0.25)"
      // pra px→mm, então a translate fica em mm puro. Ordem: translate primeiro,
      // depois scale (efetivamente: as coords px do canvas passam por scale e
      // depois são deslocadas pelo offset em mm).
      itemGroups.push(
        `<g transform="translate(${item.offsetXmm} ${item.offsetYmm})">\n${inner}\n</g>`
      );
    }

    if (itemGroups.length === 0) continue;

    output.set(machineId, wrapAsBoardSvg(itemGroups.join('\n'), board));
  }

  return output;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Calcula bounds da prancha em mm — bounding box de todos os items
 * considerando offset + tamanho de cada produto.
 *
 * Items podem ter produtos de tamanhos diferentes na mesma prancha (cada
 * broche é independente). Bounds resultantes refletem o retângulo
 * envolvente real.
 */
export function computeBoardBounds(items: BoardItemExport[]): {
  widthMm: number;
  heightMm: number;
} {
  if (items.length === 0) return { widthMm: 0, heightMm: 0 };
  let maxX = 0;
  let maxY = 0;
  for (const item of items) {
    const right = item.offsetXmm + item.productWidthMm;
    const bottom = item.offsetYmm + item.productHeightMm;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }
  // viewBox da prancha começa em (0,0). Items com offset negativo não são
  // suportados nesta versão (uso real começa em 0,0 — coluna 1 topo).
  return { widthMm: maxX, heightMm: maxY };
}

/**
 * Extrai o conteúdo entre `<g transform="scale(...)">` e o `</g>` que fecha
 * esse wrapper, gerado por `svg-exporter.wrapAsProductSvg`. O resultado
 * inclui o wrapper de scale — é justamente esse wrapper que converte coords
 * px (Fabric) em mm.
 *
 * Por que regex e não DOMParser? Em runtime Tauri/Vitest temos jsdom, mas
 * manter este módulo livre de DOM evita inflar bundle e simplifica testes
 * unitários puros. O formato de saída do svg-exporter é fixo (controlado
 * pelo módulo vizinho) — regex é seguro aqui.
 *
 * Exportado pra teste unitário.
 */
export function extractInnerScaledGroup(svg: string): string | null {
  // Match: `<g transform="scale(0.25)">\n…\n</g>\n</svg>` — captura desde a
  // tag <g transform="scale(...)"> até o </g> imediatamente antes de </svg>.
  // Dotall flag (`s`) pra `.` casar com newlines.
  const match = svg.match(/(<g\s+transform="scale\([^)]+\)">[\s\S]*?<\/g>)\s*<\/svg>/);
  return match ? match[1] : null;
}

/**
 * Empacota o conteúdo (já com translate por item + scale interno) num SVG
 * completo da prancha. viewBox em mm — mesmo contrato do svg-exporter.
 *
 * Exportado pra teste unitário.
 */
export function wrapAsBoardSvg(
  innerSvg: string,
  bounds: { widthMm: number; heightMm: number }
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ` +
    `width="${bounds.widthMm}mm" height="${bounds.heightMm}mm" ` +
    `viewBox="0 0 ${bounds.widthMm} ${bounds.heightMm}">\n` +
    `${innerSvg}\n` +
    `</svg>\n`
  );
}

// Re-export utilitário pro caller que quiser raciocinar em px.
export { PX_PER_MM };
