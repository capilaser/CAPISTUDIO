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

import {
  exportDxfByMachineAndOperation,
  parseDxfBucketKey,
  type DxfBucketKey,
} from './dxf-exporter';
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
 * @deprecated Onda 37 — caminho antigo de items soltos (cada item exporta em
 * seu próprio canvas, depois merge por máquina com translate por item).
 * Não é mais chamado pelo runtime real — ExportSvgDialog usa
 * `exportSvgByMachine` direto (single-chapa) ou `exportBoardSvgByChapa`
 * (multi-chapa).
 *
 * Mantida temporariamente pra retrocompat de testes externos. Será
 * removida numa onda de limpeza futura.
 *
 * Exporta a prancha inteira como Map<machineId, svgString>. Cada SVG tem
 * viewBox da prancha inteira, com cada broche translatado pro seu offset.
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
 * @deprecated Onda 37 — svg-exporter agora emite paths flat (sem wrapper
 * `<g transform="scale(...)">`). Esta função busca por um formato que não
 * é mais gerado. Mantida temporariamente pra retrocompat de testes externos
 * em trânsito. Vai ser removida numa onda de limpeza futura.
 *
 * Extrai o conteúdo entre `<g transform="scale(...)">` e o `</g>` que fecha
 * esse wrapper. Retorna `null` se o input vier do novo formato flat.
 */
export function extractInnerScaledGroup(svg: string): string | null {
  // Match: `<g transform="scale(0.25)">\n…\n</g>\n</svg>` — captura desde a
  // tag <g transform="scale(...)"> até o </g> imediatamente antes de </svg>.
  // Dotall flag (`s`) pra `.` casar com newlines.
  const match = svg.match(/(<g\s+transform="scale\([^)]+\)">[\s\S]*?<\/g>)\s*<\/svg>/);
  return match ? match[1] : null;
}

/**
 * @deprecated Onda 37 — não é mais usada pelo pipeline de export. O novo
 * `exportBoardSvgByChapa` chama `svg-exporter.exportSvgByMachine` por chapa,
 * que já produz SVG completo. Mantida pra retrocompat de testes externos.
 *
 * Empacota o conteúdo (já com translate por item + scale interno) num SVG
 * completo da prancha. viewBox em mm — mesmo contrato do svg-exporter.
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

// ── Onda 27 (Fase C.3) — Export SVG por chapa ────────────────────────────────
//
// Diferente do exportBoardSvg (acima), que assume N canvases (1 por broche)
// e empilha tudo num único SVG por máquina, esta variante trabalha sobre o
// **canvas único** da prancha (NovoPedidoPage tem 1 engine só, com todos os
// broches já posicionados em coords da prancha inteira). Pra dividir em N
// SVGs (1 por chapa) sem mexer no svg-exporter, a tática é:
//
//   1. Chamar exportSvgByMachine() UMA vez no canvas inteiro, com viewBox
//      da prancha completa.
//   2. Pra cada chapa: extrair o inner-scaled-group, envolver num
//      <g transform="translate(-leftMm -topMm)"> pra deslocar o conteúdo da
//      chapa pra origem, e empacotar num SVG novo com viewBox da chapa.
//
// Conteúdo de outras chapas fica fora do viewBox da chapa atual. RDWorks/
// LaserCAD respeitam viewBox como recorte de renderização. Se algum software
// ler tudo, o pior caso é geometria invisível extra — não corta/grava nada
// fora do viewBox.

/** Descritor de chapa pro export por chapa (forma reduzida de ChapaExportInfo). */
export interface BoardChapaDescriptor {
  /** ID lógico (productId, normalmente). Vai no retorno pra caller mapear. */
  chapaId: string;
  /** Token de filename já sanitizado (ex: "broche_60x25"). */
  filenameToken: string;
  /** Bbox da chapa em mm — origem (left,top) e tamanho. */
  bboxMm: { leftMm: number; topMm: number; widthMm: number; heightMm: number };
}

export interface BoardSvgByChapaOptions {
  /** Canvas único da prancha (1 engine com todos os broches posicionados). */
  canvas: fabric.Canvas;
  /** Layers do canvas. */
  layers: LayerMeta[];
  /** Dimensões da PRANCHA inteira em mm — vira viewBox da chamada interna. */
  boardWidthMm: number;
  boardHeightMm: number;
  /** Chapas a extrair. 1 chapa = 1 SVG por máquina envolvida. */
  chapas: BoardChapaDescriptor[];
  assetLookup: AssetLookupFn;
  fontBufferLoader?: FontBufferLoader;
  textRouting?: SvgExportOptions['textRouting'];
  onTextConversionError?: SvgExportOptions['onTextConversionError'];
}

/** 1 arquivo a salvar — paralelo à granularidade chapa×máquina. */
export interface BoardChapaSvgResult {
  chapaId: string;
  /** Token da chapa (idêntico ao input). Caller usa pra montar filename. */
  filenameToken: string;
  /** ID da máquina (`fiber-laser`, `master-biro`, …). */
  machineId: string;
  /** Conteúdo SVG completo, viewBox da chapa em mm. */
  svg: string;
}

/**
 * Gera 1 SVG por (chapa × máquina) a partir do canvas único da prancha.
 *
 * Retorna lista achatada — caller itera plano pra salvar arquivos. Lista vazia
 * quando o canvas não tem nada exportável (sem apliques, gravações, marcações).
 */
export async function exportBoardSvgByChapa(
  options: BoardSvgByChapaOptions
): Promise<BoardChapaSvgResult[]> {
  const {
    canvas,
    layers,
    boardWidthMm,
    boardHeightMm,
    chapas,
    assetLookup,
    fontBufferLoader,
    textRouting,
    onTextConversionError,
  } = options;

  if (chapas.length === 0) return [];
  void boardWidthMm;
  void boardHeightMm;

  // Onda 37 — pipeline novo: 1 chamada exportSvgByMachine POR CHAPA.
  //
  // Pré-Onda 37: 1 chamada com viewBox da prancha + translate negativo
  // por chapa via extractInnerScaledGroup + wrapAsBoardSvg. Esse caminho
  // dependia do formato `<g transform="scale(...)">` do svg-exporter
  // legado. Agora o exporter emite paths flat em mm finais — não há mais
  // wrapper `<g scale>` pra extrair.
  //
  // Solução: chamar exportSvgByMachine N vezes (uma por chapa), passando
  // `contentOffsetMm = { xMm: chapa.bboxMm.leftMm, yMm: chapa.bboxMm.topMm }`.
  // O exporter já aplica o offset no path level (frame matrix). Cada SVG
  // sai com viewBox próprio da chapa, paths em coords [0..widthMm, 0..heightMm].
  const results: BoardChapaSvgResult[] = [];
  for (const chapa of chapas) {
    const byMachine = await exportSvgByMachine(canvas, {
      productWidthMm: chapa.bboxMm.widthMm,
      productHeightMm: chapa.bboxMm.heightMm,
      layers,
      assetLookup,
      fontBufferLoader,
      textRouting,
      onTextConversionError,
      contentOffsetMm: { xMm: chapa.bboxMm.leftMm, yMm: chapa.bboxMm.topMm },
    });
    for (const [machineId, svg] of byMachine) {
      results.push({
        chapaId: chapa.chapaId,
        filenameToken: chapa.filenameToken,
        machineId,
        svg,
      });
    }
  }

  return results;
}

// ── Onda 27 (Fase C.4) — Export DXF por chapa ────────────────────────────────
//
// Diferente do SVG (que faz transform externo via translate+viewBox), o DXF
// não tem viewBox — coords são absolutas no arquivo. Então delegamos pro
// motor `exportDxfByMachineAndOperation` 1x POR CHAPA, com `clipBoundsMm`
// setado pra cada uma. O motor:
//   1. Filtra objetos fora do bbox da chapa.
//   2. Aplica offset → origem da chapa fica em (0,0) no DXF.
//   3. Usa altura da chapa pro flipY.
//
// Cada chamada do motor retorna Map<bucketKey, dxfString> daquela chapa.
// Achatamos como `Array<{chapaId, filenameToken, machineId, operation, dxf}>`.

export interface BoardDxfByChapaOptions {
  canvas: fabric.Canvas;
  layers: LayerMeta[];
  /** Dimensões da PRANCHA inteira em mm — passadas ao motor pra coords absolutas. */
  boardWidthMm: number;
  boardHeightMm: number;
  chapas: BoardChapaDescriptor[];
  assetLookup: AssetLookupFn;
  fontBufferLoader?: FontBufferLoader;
  textRouting?: SvgExportOptions['textRouting'];
}

export interface BoardChapaDxfResult {
  chapaId: string;
  filenameToken: string;
  machineId: string;
  /** 'corte' | 'gravacao' | 'marcacao'. */
  operation: string;
  /** Conteúdo DXF completo (R12), origem em (0,0) da chapa. */
  dxf: string;
}

/**
 * Gera 1 DXF por (chapa × máquina × operação) usando recorte do motor.
 *
 * Lista vazia quando nenhuma chapa tem conteúdo exportável. Quando UMA chapa
 * fica sem buckets (operador colocou apenas decoração de outra chapa naquele
 * espaço), ela simplesmente não contribui — sem erro.
 */
export async function exportBoardDxfByChapa(
  options: BoardDxfByChapaOptions
): Promise<BoardChapaDxfResult[]> {
  const {
    canvas,
    layers,
    boardWidthMm,
    boardHeightMm,
    chapas,
    assetLookup,
    fontBufferLoader,
    textRouting,
  } = options;

  if (chapas.length === 0) return [];

  const results: BoardChapaDxfResult[] = [];

  for (const chapa of chapas) {
    let byBucket: Map<DxfBucketKey, string>;
    try {
      byBucket = await exportDxfByMachineAndOperation(canvas, {
        productWidthMm: boardWidthMm,
        productHeightMm: boardHeightMm,
        layers,
        assetLookup,
        fontBufferLoader,
        textRouting,
        clipBoundsMm: chapa.bboxMm,
      });
    } catch (err) {
      throw new Error(`[board-exporter] DXF chapa "${chapa.chapaId}": ${String(err)}`);
    }

    for (const [bucketKey, dxfString] of byBucket) {
      const { machineId, operation } = parseDxfBucketKey(bucketKey);
      results.push({
        chapaId: chapa.chapaId,
        filenameToken: chapa.filenameToken,
        machineId,
        operation,
        dxf: dxfString,
      });
    }
  }

  return results;
}
