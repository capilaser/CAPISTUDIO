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
 * Estados de erro (lança):
 *   - Objeto user (não-base) sem `id` resolvível via getCapiId.
 *   - LayerMeta ausente para id resolvido.
 *   - LayerMeta.kind 'principal' sem appliqueId — não dá pra rotear.
 *   - LayerMeta.kind 'visual' sem nenhum (engravingId | markingId | materialId)
 *     resolvível — não dá pra rotear (rect/slot sem asset).
 *   - assetLookup retorna null para id existente — banco inconsistente.
 *   - Asset com operation inválida ou machines vazio (defensivo — o
 *     repository já valida no create, mas dados externos podem violar).
 */
import type * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerMeta } from '@/data/schema';
import {
  VALID_OPERATIONS,
  assertValidMachines,
  assertValidOperation,
  type Operation,
} from '@/data/repositories/_export-validation';
import {
  type FontBufferLoader,
  TextConversionError,
  tryConvertTextToSvgPath,
} from './svg-text-converter';

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

/** Info mínima que o exporter precisa de cada asset pra roteamento. */
export interface AssetExportInfo {
  operation: Operation;
  /** 1-3 machine ids — já validado pelo repository no create. */
  machines: string[];
}

/**
 * Função de lookup injetada — resolve um asset id (de qualquer banco) pra
 * info de roteamento. Em runtime, UI passa um compositor que tenta os
 * 3 repos (applique → engraving → marking) ou usa cache pré-carregado.
 * Retorna null se id não existe em nenhum banco.
 */
export type AssetLookupFn = (id: string) => Promise<AssetExportInfo | null>;

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
  } = options;

  // Index LayerMeta por id pra lookup O(1) ao iterar objetos do canvas.
  const layerById = new Map<string, LayerMeta>();
  for (const layer of layers) layerById.set(layer.id, layer);

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
    // Heurística: base do produto e helpers internos não têm id capi.
    const id = getCapiId(obj as unknown as Record<string, unknown>);
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
      // Texto herda machines do PrincipalLayerMeta pai (aplique). Operation
      // fixa em 'gravacao' (briefing Gabriell — texto é gravação normalmente).
      // Override via textRouting (Fase 9F dialog) tem prioridade.
      const parentRouting = await resolveTextRouting(
        layerMeta,
        layerById,
        assetLookup,
        textRouting?.get(id)
      );

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
        fontBufferLoader
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

    // Resolve asset id conforme tipo de LayerMeta.
    let assetId: string | null = null;
    if (layerMeta.kind === 'principal') {
      assetId = layerMeta.appliqueId;
      if (!assetId) {
        throw new Error(
          `[svg-exporter] PrincipalLayerMeta id="${id}" sem appliqueId — ` +
            `peça física não vinculada a aplique do banco não tem rota de export.`
        );
      }
    } else if (layerMeta.kind === 'visual') {
      assetId = layerMeta.engravingId ?? layerMeta.markingId ?? null;
      if (!assetId) {
        throw new Error(
          `[svg-exporter] VisualLayerMeta id="${id}" name="${layerMeta.name}" sem ` +
            `engravingId nem markingId — camadas visuais avulsas (rect, slot) ainda ` +
            `não têm rota de export. Cadastre o elemento num banco antes de exportar.`
        );
      }
    } else {
      // OperationLayerMeta é sub-camada — não tem objeto Fabric próprio. Ignorada.
      continue;
    }

    const asset = await assetLookup(assetId);
    if (!asset) {
      throw new Error(
        `[svg-exporter] assetLookup retornou null para id="${assetId}" (layer id="${id}"). ` +
          `Banco inconsistente — FK no LayerMeta aponta pra registro inexistente.`
      );
    }

    // Defensivo — bancos podem ter dados de migration default ainda inválidos.
    assertValidOperation(asset.operation, `svg-exporter:asset(${assetId})`);
    assertValidMachines(asset.machines, `svg-exporter:asset(${assetId})`);

    resolved.push({
      fabricObj: obj,
      layerMeta,
      asset,
      routing: asset,
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
      const fragment = renderObjectSvg(r.fabricObj, r.routing.operation);
      elements.push(fragment);
    }

    // Wrapper scale: Fabric emite coords em px, queremos viewBox em mm.
    // <g transform="scale(0.25)"> ≡ dividir todas as coordenadas por 4.
    const inner = elements.join('\n');
    const svg = wrapAsProductSvg(inner, productWidthMm, productHeightMm);
    output.set(machineId, svg);
  }

  return output;
}

/**
 * Resolve operation/machines pra um TEXTO (VisualLayerMeta de fabric.Text).
 *
 * Regras (default):
 *   - operation = 'gravacao' fixa (briefing Gabriell — texto é gravação).
 *   - machines = do PrincipalLayerMeta pai (aplique) via layerMeta.parentLayerId
 *     → resolve appliqueId → assetLookup.
 *   - Sem parentLayerId ou pai sem appliqueId → lança (texto sem rota).
 *
 * Override (Fase 9F dialog):
 *   - Se `override.operation` informado, substitui o default 'gravacao'.
 *   - Se `override.machines` informado, substitui as machines do pai —
 *     útil quando o usuário quer enviar o texto pra máquina diferente do
 *     aplique. Quando há machines no override, NÃO precisamos do pai
 *     (texto pode até ser solto — ainda preciso de parentLayerId só pra
 *     manter o invariante hierárquico).
 *
 * Pode parecer estranho que texto seja sempre gravação mesmo num aplique
 * de corte — mas é o que faz sentido produção. Aplique passa pela máquina,
 * texto vai ser gravado nessa mesma máquina antes/depois do corte.
 */
async function resolveTextRouting(
  textLayer: LayerMeta,
  layerById: Map<string, LayerMeta>,
  assetLookup: AssetLookupFn,
  override?: { operation: Operation; machines?: string[] }
): Promise<AssetExportInfo> {
  if (textLayer.kind !== 'visual') {
    throw new Error(
      `[svg-exporter] texto com LayerMeta.kind="${textLayer.kind}" — esperado 'visual'.`
    );
  }

  // Caminho rápido: override fornece operation + machines. Pula resolução
  // do pai inteiramente (dialog da Fase 9F é autoritativo).
  if (override?.machines) {
    assertValidOperation(override.operation, `svg-exporter:textOverride(${textLayer.id})`);
    assertValidMachines(override.machines, `svg-exporter:textOverride(${textLayer.id})`);
    return { operation: override.operation, machines: override.machines };
  }

  // Caminho normal: precisa do PrincipalLayerMeta pai pra herdar machines.
  if (!textLayer.parentLayerId) {
    throw new Error(
      `[svg-exporter] texto id="${textLayer.id}" name="${textLayer.name}" sem parentLayerId — ` +
        `texto solto não tem rota de export. Coloque-o como filho de um aplique ou ` +
        `passe textRouting com machines explícitas pra esse texto.`
    );
  }
  const parent = layerById.get(textLayer.parentLayerId);
  if (!parent) {
    throw new Error(
      `[svg-exporter] texto id="${textLayer.id}" aponta pra parentLayerId="${textLayer.parentLayerId}" ` +
        `que não existe — estado quebrado.`
    );
  }
  if (parent.kind !== 'principal' || !parent.appliqueId) {
    throw new Error(
      `[svg-exporter] texto id="${textLayer.id}" tem pai não-principal ou sem appliqueId — ` +
        `texto só herda routing de aplique do banco.`
    );
  }
  const parentAsset = await assetLookup(parent.appliqueId);
  if (!parentAsset) {
    throw new Error(
      `[svg-exporter] aplique pai (id="${parent.appliqueId}") do texto não está no banco.`
    );
  }

  // Operation: override > default 'gravacao'. Machines: do pai.
  return {
    operation: override?.operation ?? 'gravacao',
    machines: parentAsset.machines,
  };
}

// ── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Renderiza um objeto Fabric como fragmento SVG stroke-only com a cor da
 * operação. Reaproveita `obj.toSVG()` do Fabric e pós-processa fill/stroke
 * para garantir o contrato — mais robusto que reconstruir d strings do zero
 * (cobre Path, Rect, Circle, Ellipse, Polygon, Polyline, Group sem código
 * adicional).
 *
 * Pós-processamento mínimo:
 *   - `fill: ...` → `fill: none` (stroke-only).
 *   - `stroke: ...` → `stroke: {OPERATION_STROKE[op]}`.
 *   - Atributos `fill=` e `stroke=` em elementos individuais também trocados.
 *
 * Casos não atingidos (sem regressão para Fase 9D):
 *   - `fabric.Image` (PNG inline) — não tem path; tratado em Fase 9E (PNG mockup).
 *   - `fabric.Text` — interceptado antes em exportSvgByMachine().
 */
function renderObjectSvg(obj: fabric.FabricObject, operation: Operation): string {
  const stroke = OPERATION_STROKE[operation];
  let svg: string;
  try {
    svg = obj.toSVG();
  } catch (err) {
    throw new Error(`[svg-exporter] obj.toSVG() falhou para type="${obj.type}": ${String(err)}`);
  }

  return recolorSvgFragment(svg, stroke);
}

/**
 * Substitui fill/stroke em todo o fragmento. Cobre:
 *   - Inline style: `fill: rgb(0,0,0)` → `fill: none`
 *   - Inline style: `stroke: rgb(255,0,0)` → `stroke: {hex}`
 *   - Atributos: `fill="black"` → `fill="none"`, `stroke="…"` → `stroke="{hex}"`
 *
 * Não toca em `stroke-width`, `stroke-dasharray`, transforms ou paths em si.
 * Exportado para teste unitário.
 */
export function recolorSvgFragment(svg: string, stroke: string): string {
  return svg
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
  productHeightMm: number
): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ` +
    `width="${productWidthMm}mm" height="${productHeightMm}mm" ` +
    `viewBox="0 0 ${productWidthMm} ${productHeightMm}">\n` +
    `<g transform="scale(${PX_TO_MM_SCALE})">\n` +
    `${innerSvg}\n` +
    `</g>\n` +
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
