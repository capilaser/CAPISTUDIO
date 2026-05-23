/**
 * svg-exporter.ts — Motor de exportação SVG por máquina (Onda 9, Fase 9D).
 *
 * Gera UM SVG por máquina envolvida no pedido. Cada arquivo contém apenas
 * os contornos (stroke-only, sem fill) dos elementos cuja operação foi
 * roteada pra aquela máquina, com cor semântica da operação:
 *
 *   corte    → preto    (#000000)
 *   marcacao → azul     (#0000FF)
 *   gravacao → vermelho (#FF0000)
 *
 * O software laser lê stroke como caminho a executar; fill é ignorado.
 *
 * Contrato (Decisões Gabriell):
 *   - Coordenadas em **mm puros** (decisão #5 — ADR 005).
 *     viewBox="0 0 {productWidthMm} {productHeightMm}" + width/height em mm.
 *   - **Z-order preservado** (decisão #6) — ordem das objetos no canvas
 *     vira ordem dos elementos no SVG (último renderizado = visualmente
 *     no topo).
 *   - **LayerMeta.visible === false → camada ignorada** (contrato Onda 7).
 *   - **1 SVG por máquina envolvida** — apliques/gravações/marcações com
 *     2+ máquinas duplicam o elemento em cada SVG dessas máquinas.
 *
 * Texto (fabric.Text/IText):
 *   - Esta fase NÃO converte texto em path. Emite comentário XML como
 *     placeholder e log warning. Conversão real fica para Fase 9D-bis
 *     (opentype.js).
 *
 * Lookup de asset:
 *   - Injetado via `assetLookup` — mantém o exporter como core puro,
 *     sem dependência direta dos repositories de banco. Em runtime,
 *     UI compõe com os 3 repos; em testes, mocks plain.
 *
 * Estados de erro:
 *   LANÇA:
 *     - LayerMeta ausente para id resolvido (estado quebrado real).
 *     - assetLookup retorna null para id existente (banco inconsistente).
 *     - Asset com operation inválida ou machines vazio.
 *   WARN+SKIP (Onda 18 + Onda 35 — não trava export):
 *     - Objeto user sem id capi.
 *     - LayerMeta.visible === false.
 *     - Layer sem patternRole completo E sem asset id (slot vazio).
 *     - Texto sem rota (sem parent, sem patternRole, sem override).
 *
 * Onda 35 (routing-resolver):
 *   A decisão de operation+machines por layer foi centralizada em
 *   `routing-resolver.ts`. Cascata: patternRole completo (Onda 33) vence
 *   sobre asset legado quando ambos presentes. Sem patternRole → asset.
 */
import * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerMeta } from '@/data/schema';
import { VALID_OPERATIONS, type Operation } from '@/data/repositories/_export-validation';
import { resolveLayerRouting, resolveTextLayerRouting } from './routing-resolver';
import {
  multiplyMatrix,
  scaleMatrix,
  translateMatrix,
  type AffineMatrix,
} from './svg-path-transform';
import { shapeToFlatPathD } from './svg-shape-to-path';
import {
  type FontBufferLoader,
  TextConversionError,
  tryConvertTextToSvgPath,
} from './svg-text-converter';

/**
 * Onda 37 — precisão de saída do export técnico (decisão Gabriell: 4 casas).
 * 0.0001mm é abaixo da precisão de máquinas laser pequenas.
 */
const OUTPUT_DECIMALS = 4;

/** Cor de stroke por operação (decisão Gabriell #5). */
export const OPERATION_STROKE: Record<Operation, string> = {
  corte: '#000000',
  marcacao: '#0000FF',
  gravacao: '#FF0000',
};

/**
 * Conversão px → mm. Fabric trabalha em px; SVG final em mm.
 * O fator é uniforme em X e Y (MM_TO_PX = 4 em src/core/canvas/units.ts).
 * Escala via wrapper `<g transform="scale(1/4)">` em volta do toSVG
 * do canvas — equivalente matemático a re-emitir cada path em mm,
 * sem ter que reparsear path d.
 */
const PX_PER_MM = 4;
const PX_TO_MM_SCALE = 1 / PX_PER_MM;

// Onda 35 — AssetExportInfo e AssetLookupFn foram movidos para
// `asset-routing-types.ts` pra serem compartilhados com routing-resolver
// sem ciclo de imports. Re-exportamos aqui pra preservar a API pública.
export type { AssetExportInfo, AssetLookupFn } from './asset-routing-types';
import type { AssetExportInfo, AssetLookupFn } from './asset-routing-types';

export interface SvgExportOptions {
  productWidthMm: number;
  productHeightMm: number;
  /** Layers do canvas. Espelha o que `CanvasEngine.serialize().capi.layers` retorna. */
  layers: LayerMeta[];
  /** Resolve asset id → operation+machines. Veja AssetLookupFn. */
  assetLookup: AssetLookupFn;
  /**
   * Onda 9D-bis — converte fabric.Text em <path> via opentype.js.
   * Opcional pra retrocompat com chamadas pré-9D-bis: sem loader, textos
   * caem pro placeholder XML (mesmo comportamento da Fase 9D). Em produção,
   * a UI compõe com `convertFileSrc + fetch` lendo `fonts.file` do banco.
   *
   * Roteamento de texto (decisão de design):
   *   - operation = 'gravacao' (briefing Gabriell — texto é gravação normalmente).
   *   - machines = herdadas do PrincipalLayerMeta pai (aplique). Texto solto sem
   *     parentLayerId não tem rota — vira placeholder + erro estruturado.
   */
  fontBufferLoader?: FontBufferLoader;
  /**
   * Onda 9D-bis — callback opcional pra UI mostrar toast quando uma fonte
   * falha (font-not-found, font-unsupported, parse-error). O texto vira
   * placeholder XML pra não bloquear o resto do export. Sem callback,
   * erros são apenas logados via console.warn.
   */
  onTextConversionError?: (err: TextConversionError, text: string) => void;
  /**
   * Onda 9D-bis-fix — overrides de roteamento por texto, vindos do dialog de
   * confirmação da Fase 9F. Chave = id capi do texto (LayerMeta.id).
   *
   *   - operation: substitui o default 'gravacao'.
   *   - machines (opcional): substitui o default herdado do PrincipalLayerMeta
   *     pai. Quando omitido, machines continuam vindo do aplique pai.
   *
   * Override é por pedido, NÃO persiste no padrão mestre (CLAUDE.md regra).
   * Texto que não tem entrada no Map mantém defaults da decisão da 9D-bis.
   */
  textRouting?: Map<string, { operation: Operation; machines?: string[] }>;
  /**
   * Onda 37 bug-fix — quando informado, desloca o conteúdo do SVG em mm
   * (subtrai do todas as coords) antes de renderizar. Usado pra desfazer
   * o offset de `CHAPA_LABEL_HEIGHT_MM` do useBoardEngine: o canvas tem
   * 8mm reservados no topo pro label visual ("Broches (N)"), mas o SVG
   * técnico deve sair sem essa faixa. Multi-chapa (board-exporter) faz
   * isso via `translate` próprio; single-chapa precisa deste hook.
   *
   * Default `undefined` = sem deslocamento (retrocompat).
   */
  contentOffsetMm?: { xMm: number; yMm: number };
}

/**
 * Exporta o canvas como Map<machineId, svgString>. A chave é o id da
 * máquina (`master-biro`, `fiber-laser`, `due-laser`) — naming PascalCase
 * acontece na camada de arquivo (Fase 9F), não aqui.
 *
 * Retorna Map vazio quando não há nenhum elemento exportável.
 */
export async function exportSvgByMachine(
  canvas: fabric.Canvas,
  options: SvgExportOptions
): Promise<Map<string, string>> {
  const {
    productWidthMm,
    productHeightMm,
    layers,
    assetLookup,
    fontBufferLoader,
    onTextConversionError,
    textRouting,
    contentOffsetMm,
  } = options;

  // Index LayerMeta por id pra lookup O(1) ao iterar objetos do canvas.
  const layerById = new Map<string, LayerMeta>();
  for (const layer of layers) layerById.set(layer.id, layer);

  // Onda 37 — frame matricial externo aplicado a todos os paths:
  //   1. scale(1/MM_TO_PX) — converte coord canvas (px) → mm.
  //   2. translate(-contentOffsetMm) — desfaz offset de label de chapa.
  // Composição: frame = translate × scale. Aplica scale primeiro a cada
  // ponto, depois translate.
  const offX = contentOffsetMm?.xMm ?? 0;
  const offY = contentOffsetMm?.yMm ?? 0;
  const frame: AffineMatrix = multiplyMatrix(
    translateMatrix(-offX, -offY),
    scaleMatrix(PX_TO_MM_SCALE)
  );

  // ── Coleta: pra cada objeto user do canvas, resolve asset routing ──────────
  //
  // Itera na ORDEM do canvas — `canvas.getObjects()` retorna em z-order
  // (índice 0 = fundo, último = topo). Preservamos essa ordem ao emitir
  // cada elemento no SVG por máquina.
  interface ResolvedObject {
    fabricObj: fabric.FabricObject;
    layerMeta: LayerMeta;
    /** Quando objeto é texto: o conteúdo string. */
    text?: string;
    /** Para shapes (não-texto): info de routing do banco. */
    asset?: AssetExportInfo;
    /** Para texto convertido: fragmento <g><path/></g> pré-gerado. */
    convertedTextSvg?: string;
    /** Operation+machines herdadas (texto) ou do asset (shapes). */
    routing: AssetExportInfo;
    /** True quando texto não conseguiu ser convertido — vira placeholder XML. */
    isTextPlaceholder: boolean;
  }

  const resolved: ResolvedObject[] = [];

  for (const obj of canvas.getObjects()) {
    // Base do produto + overlays excluídos do export não entram.
    if (obj.excludeFromExport) continue;
    // Bug-fix Onda 36+: body de slot (hitbox transparente) e placeholder de
    // AREA são guias do editor. Marcados via flag pra svg-exporter pular
    // sem afetar serialização/persistência (excludeFromExport quebraria
    // loadSlotsFromCanvas ao reabrir). Defesa em profundidade — placeholder
    // de AREA já tem excludeFromExport: true, mas o flag continua útil pra
    // patterns antigos que possam ter perdido a flag em algum roundtrip.
    const rec = obj as unknown as Record<string, unknown>;
    if (rec.__capiSlotBody === true || rec.__capiAreaPlaceholder === true) continue;
    // Heurística: base do produto e helpers internos não têm id capi.
    const id = getCapiId(rec);
    if (!id) continue;

    const layerMeta = layerById.get(id);
    if (!layerMeta) {
      throw new Error(
        `[svg-exporter] objeto canvas id="${id}" sem LayerMeta correspondente. ` +
          `Estado quebrado — provavelmente layerMeta.delete sem canvas.remove ou vice-versa.`
      );
    }

    if (!layerMeta.visible) continue;

    // Texto: convertido via opentype (9D-bis) ou placeholder XML (fallback).
    if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
      const text = (obj as unknown as { text?: string }).text ?? '';
      // Onda 35 — resolução em cascata via routing-resolver:
      //  1. override do dialog 9F   2. patternRole na própria layer
      //  3. patternRole no pai      4. asset legado do pai
      // resolveTextLayerRouting nunca lança por ausência de rota — retorna
      // routing=null (políticas Onda 18 + briefing texto-sem-rota). Aqui
      // mantemos o contrato original: texto SEM rota é erro estruturado
      // (legacy throw) — o caller espera que se há fabric.Text, ele exporta
      // ou explode. Para Onda 35, isso vira warn + placeholder XML.
      const textRoutingResolution = await resolveTextLayerRouting(
        layerMeta,
        layerById,
        assetLookup,
        textRouting?.get(id),
        'svg-exporter'
      );
      if (!textRoutingResolution.routing) {
        console.warn(
          `[svg-exporter] texto id="${id}" sem rota — ${textRoutingResolution.reason ?? 'motivo desconhecido'}; ignorado no export.`
        );
        continue;
      }
      const parentRouting = textRoutingResolution.routing;

      if (!fontBufferLoader) {
        // Sem loader injetado — comportamento da Fase 9D (placeholder).
        console.warn(
          `[svg-exporter] texto "${text}" não convertido em path — ` +
            `fontBufferLoader não foi injetado (Fase 9D legacy mode).`
        );
        resolved.push({
          fabricObj: obj,
          layerMeta,
          text,
          routing: parentRouting,
          isTextPlaceholder: true,
        });
        continue;
      }

      // Tenta converter via opentype.js. Em falha estruturada, log + callback
      // pra UI mostrar toast, e vira placeholder XML.
      const fabricText = obj as unknown as {
        text?: string;
        fontFamily?: string;
        fontSize?: number;
        left?: number;
        top?: number;
        angle?: number;
        scaleX?: number;
        scaleY?: number;
      };
      const conversion = await tryConvertTextToSvgPath(
        {
          text,
          fontFamily: fabricText.fontFamily ?? 'Montserrat',
          fontSize: fabricText.fontSize ?? 16,
          left: fabricText.left ?? 0,
          top: fabricText.top ?? 0,
          angle: fabricText.angle ?? 0,
          scaleX: fabricText.scaleX ?? 1,
          scaleY: fabricText.scaleY ?? 1,
          fill: OPERATION_STROKE[parentRouting.operation],
        },
        fontBufferLoader,
        frame // Onda 37: emite d em mm finais flat
      );

      if (conversion.ok) {
        resolved.push({
          fabricObj: obj,
          layerMeta,
          text,
          routing: parentRouting,
          convertedTextSvg: conversion.svg,
          isTextPlaceholder: false,
        });
      } else {
        console.warn(
          `[svg-exporter] falha ao converter texto "${text}" via opentype.js ` +
            `(${conversion.error.kind}): ${conversion.error.message}`
        );
        onTextConversionError?.(conversion.error, text);
        resolved.push({
          fabricObj: obj,
          layerMeta,
          text,
          routing: parentRouting,
          isTextPlaceholder: true,
        });
      }
      continue;
    }

    // Onda 35 — resolução unificada via routing-resolver. Cascata:
    //  1. patternRole+processType+machineTargets completos (Onda 33) — vence
    //  2. asset legado via appliqueId/engravingId/markingId
    //  3. nada → null + warn + skip (política Onda 18, não trava export)
    const layerRouting = await resolveLayerRouting(layerMeta, assetLookup, 'svg-exporter');
    if (!layerRouting.routing) {
      console.warn(
        `[svg-exporter] camada id="${id}" name="${layerMeta.name}" sem rota — ` +
          `${layerRouting.reason ?? 'motivo desconhecido'}; ignorada no export.`
      );
      continue;
    }

    resolved.push({
      fabricObj: obj,
      layerMeta,
      asset: layerRouting.routing,
      routing: layerRouting.routing,
      isTextPlaceholder: false,
    });
  }

  // ── Coleta máquinas únicas envolvidas (inclui texto) ──────────────────────
  const machinesInvolved = new Set<string>();
  for (const r of resolved) {
    for (const m of r.routing.machines) machinesInvolved.add(m);
  }

  if (machinesInvolved.size === 0) {
    return new Map();
  }

  // ── Emite 1 SVG por máquina, mantendo z-order ────────────────────────────
  const output = new Map<string, string>();
  for (const machineId of machinesInvolved) {
    const elements: string[] = [];

    for (const r of resolved) {
      if (!r.routing.machines.includes(machineId)) continue;

      if (r.text !== undefined) {
        // Caminho de texto: convertido ou placeholder.
        if (r.isTextPlaceholder) {
          elements.push(
            `  <!-- Texto pendente: ${escapeXmlComment(r.text)} (Onda 9D-bis: opentype.js) -->`
          );
        } else {
          // Texto convertido já vem com a cor da operação aplicada no fill
          // (escolhida em tryConvertTextToSvgPath via OPERATION_STROKE[op]).
          elements.push(r.convertedTextSvg!);
        }
        continue;
      }

      // Shape normal (Path/Rect/Circle/etc).
      const fragment = renderObjectSvg(r.fabricObj, r.routing.operation, frame);
      elements.push(fragment);
    }

    // Onda 37 — paths já estão em coords mm finais (frame matrix aplicado em
    // renderObjectSvg). Wrapper é só viewBox + xmlns. Sem `<g>` global.
    const inner = elements.join('\n');
    const svg = wrapAsProductSvg(inner, productWidthMm, productHeightMm);
    output.set(machineId, svg);
  }

  return output;
}

// ── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Onda 37 (export técnico flat) — emite `<path d="..."/>` com coords já em mm
 * finais. Aplica matriz world (frame externa × matrix do objeto) e preserva
 * Bézier matematicamente. Sem wrappers `<g transform="...">`, sem matriz por
 * shape, sem rect/circle/ellipse — apenas paths flat para máxima clareza
 * técnica.
 *
 * Frame externa:
 *   - scale(1/MM_TO_PX) → converte coord canvas (px) em mm
 *   - translate(-contentOffsetMm) → desfaz offset de label de chapa
 *   Composição: frame = translate × scale
 *
 * Pattern fill / clipPath: estilo agora é setado direto por nós (stroke +
 * fill=none), independente do que está no obj. Strip de pattern não é
 * necessário porque NÃO chamamos mais `obj.toSVG()`.
 */
function renderObjectSvg(
  obj: fabric.FabricObject,
  operation: Operation,
  frame: AffineMatrix
): string {
  const stroke = OPERATION_STROKE[operation];
  const d = shapeToFlatPathD(obj, frame, OUTPUT_DECIMALS);
  if (!d) return '';
  return (
    `<path d="${d}" ` +
    `stroke="${stroke}" stroke-width="0.01" fill="none" ` +
    `vector-effect="non-scaling-stroke"/>`
  );
}

/**
 * @deprecated Onda 37 — não é mais chamada pelo pipeline principal. O novo
 * `renderObjectSvg` emite `<path>` flat já com stroke/fill corretos. Esta
 * função fica como helper de retrocompat para callers/testes externos.
 *
 * Substitui fill/stroke em todo o fragmento. Cobre:
 *   - Inline style: `fill: rgb(0,0,0)` → `fill: none`
 *   - Atributos: `fill="black"` → `fill="none"`, `stroke="…"` → `stroke="{hex}"`
 *   - `fill="url(#SVGID_0)"` → `fill="none"`
 *   - `<pattern>...</pattern>` em defs → removido
 *   - `<image xlink:href="...">` → removido
 */
export function recolorSvgFragment(svg: string, stroke: string): string {
  return svg
    .replace(/<pattern\b[^>]*>[\s\S]*?<\/pattern>/gi, '')
    .replace(/<image\b[^/]*\/>/gi, '')
    .replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, '')
    .replace(/<defs>\s*<\/defs>/gi, '')
    .replace(/fill\s*:\s*[^;"'}]+/gi, 'fill: none')
    .replace(/stroke\s*:\s*[^;"'}]+/gi, `stroke: ${stroke}`)
    .replace(/\bfill\s*=\s*"[^"]*"/gi, 'fill="none"')
    .replace(/\bstroke\s*=\s*"[^"]*"/gi, `stroke="${stroke}"`);
}

/**
 * Empacota o conteúdo (fragmentos já recolorizados em coords px de canvas)
 * num SVG completo cujo viewBox está em mm — ver decisão #5 do Gabriell.
 *
 * O wrapper `<g transform="scale({1/MM_TO_PX})">` transforma o sistema
 * de coordenadas de px (Fabric) para mm sem reescrever cada path d.
 *
 * Exportado para teste unitário.
 */
export function wrapAsProductSvg(
  innerSvg: string,
  productWidthMm: number,
  productHeightMm: number,
  /**
   * @deprecated Onda 37 — agora o offset é absorvido na matriz `frame` que
   * `renderObjectSvg` usa pra emitir paths em mm finais. Este parâmetro é
   * ignorado nesta versão (callers continuam podendo passar pra retrocompat
   * de assinatura; o exporter já aplicou o offset antes de chegar aqui).
   *
   * Mantido por enquanto pra não quebrar testes externos / callers em
   * trânsito. Limpeza definitiva numa onda futura.
   */
  contentOffsetMm: { xMm: number; yMm: number } = { xMm: 0, yMm: 0 }
): string {
  void contentOffsetMm; // já aplicado no path level (Onda 37)
  // Onda 37: SVG técnico FLAT. Sem `<g transform="scale(...)">`, sem
  // `<g transform="translate(...)">`. Apenas `<path d="...">` em mm finais.
  // Mantemos xmlns:xlink declarado por defesa (caso algum caminho residual
  // emita atributo xlink:href em release futuro).
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" ` +
    `width="${productWidthMm}mm" height="${productHeightMm}mm" ` +
    `viewBox="0 0 ${productWidthMm} ${productHeightMm}">\n` +
    `${innerSvg}\n` +
    `</svg>\n`
  );
}

/** XML-safe comment text: stripa `--` que quebraria o comentário. */
function escapeXmlComment(text: string): string {
  return text.replace(/--/g, '__');
}

// Re-export para conveniência dos testes — mantém superfície pública mínima.
export { VALID_OPERATIONS };
export type { Operation };
