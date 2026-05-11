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
  const { productWidthMm, productHeightMm, layers, assetLookup } = options;

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
    asset: AssetExportInfo | null; // null = texto pendente (Fase 9D-bis)
    isTextPlaceholder: boolean;
    placeholderText?: string;
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

    // Texto: placeholder até Fase 9D-bis (opentype.js).
    if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
      const text = (obj as unknown as { text?: string }).text ?? '';
      console.warn(
        `[svg-exporter] texto "${text}" não convertido em path — Fase 9D-bis (opentype.js).`
      );
      resolved.push({
        fabricObj: obj,
        layerMeta,
        asset: null,
        isTextPlaceholder: true,
        placeholderText: text,
      });
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
      isTextPlaceholder: false,
    });
  }

  // ── Coleta máquinas únicas envolvidas ─────────────────────────────────────
  const machinesInvolved = new Set<string>();
  for (const r of resolved) {
    if (r.isTextPlaceholder) continue;
    for (const m of r.asset!.machines) machinesInvolved.add(m);
  }

  if (machinesInvolved.size === 0) {
    return new Map();
  }

  // ── Emite 1 SVG por máquina, mantendo z-order ────────────────────────────
  const output = new Map<string, string>();
  for (const machineId of machinesInvolved) {
    const elements: string[] = [];

    for (const r of resolved) {
      if (r.isTextPlaceholder) {
        // Placeholder XML pra Fase 9D-bis — não conta como erro.
        elements.push(
          `  <!-- Texto pendente: ${escapeXmlComment(r.placeholderText ?? '')} (Onda 9D-bis: opentype.js) -->`
        );
        continue;
      }
      const asset = r.asset!;
      if (!asset.machines.includes(machineId)) continue;

      const fragment = renderObjectSvg(r.fabricObj, asset.operation);
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
