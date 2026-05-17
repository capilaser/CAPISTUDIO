/**
 * dxf-exporter.ts — Motor de exportação DXF R12 por máquina+operação (Onda 18).
 *
 * Espelha svg-exporter.ts no que importa pro fluxo do operador:
 *   - Reusa a mesma AssetLookupFn (resolve asset → operation+machines)
 *   - Reusa textRouting (override de op/machines por texto)
 *   - Reusa FontBufferLoader + opentype.js (texto → polilinhas)
 *   - Honra LayerMeta.visible, excludeFromExport e cut-stroke (#2a2c2e)
 *
 * Diferenças do SVG:
 *   - Saída em **mm puros DIRETO nos comandos DXF** (não via wrapper scale).
 *     Convertemos px → mm em cada ponto antes de emitir.
 *   - **Y invertido** (DXF é Y+ pra cima, Fabric é Y+ pra baixo).
 *   - **1 arquivo por máquina+operação** (decisão Gabriell), não por máquina só.
 *     Map key = `${machineId}|${operation}`.
 *   - Geometria flattened em polilinhas (R12 não tem SPLINE/Bézier).
 *   - Texto vetorizado convertido em polilinhas via opentype + path-flattener.
 *
 * Duplicação consciente: a lógica de "iterar canvas → resolver routing →
 * coletar máquinas" é cópia adaptada do svg-exporter. **Não** extraímos
 * uma função compartilhada agora pra não arriscar regressão nos 426
 * testes do SVG. Refactor DRY fica pra wave de hardening (Onda 24).
 */
import type * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerMeta } from '@/data/schema';
import {
  assertValidMachines,
  assertValidOperation,
  type Operation,
} from '@/data/repositories/_export-validation';

import { DxfBuilder, type DxfLayerName, flipY } from './dxf-writer';
import { flattenSvgPath, type FlatPolyline } from './path-flattener';
import { type FontBufferLoader, tryConvertTextToSvgPath } from './svg-text-converter';

/** PX_PER_MM constante (igual canvas-engine/svg-exporter). */
const PX_PER_MM = 4;
const PX_TO_MM = 1 / PX_PER_MM;

/** Tolerância de flatten em mm — sub-precisão de laser pequeno. */
const FLATTEN_TOLERANCE_MM = 0.1;

export interface AssetExportInfo {
  operation: Operation;
  machines: string[];
}

export type AssetLookupFn = (id: string) => Promise<AssetExportInfo | null>;

export interface DxfExportOptions {
  productWidthMm: number;
  productHeightMm: number;
  layers: LayerMeta[];
  assetLookup: AssetLookupFn;
  fontBufferLoader?: FontBufferLoader;
  textRouting?: Map<string, { operation: Operation; machines?: string[] }>;
  /** Tolerância de flatten em mm. Default 0.1. */
  toleranceMm?: number;
}

/** Chave de agrupamento: `${machineId}|${operation}` — 1 arquivo cada. */
export type DxfBucketKey = string;

export function makeDxfBucketKey(machineId: string, operation: Operation): DxfBucketKey {
  return `${machineId}|${operation}`;
}

export function parseDxfBucketKey(key: DxfBucketKey): { machineId: string; operation: Operation } {
  const [machineId, operation] = key.split('|');
  return { machineId: machineId!, operation: operation as Operation };
}

/**
 * Exporta o canvas como Map<machineId|operation, dxfString>.
 * Map vazio quando nada exportável.
 */
export async function exportDxfByMachineAndOperation(
  canvas: fabric.Canvas,
  options: DxfExportOptions
): Promise<Map<DxfBucketKey, string>> {
  const {
    productWidthMm,
    productHeightMm,
    layers,
    assetLookup,
    fontBufferLoader,
    textRouting,
    toleranceMm = FLATTEN_TOLERANCE_MM,
  } = options;

  // Defensivo: prancha sem dimensões reais é caller mal-formado.
  if (productWidthMm <= 0 || productHeightMm <= 0) {
    throw new Error(
      `[dxf-exporter] productWidthMm/productHeightMm inválidos: ${productWidthMm}x${productHeightMm}`
    );
  }

  const layerById = new Map<string, LayerMeta>();
  for (const l of layers) layerById.set(l.id, l);

  // ── Coleta: resolved[] com routing por objeto ──────────────────────────────
  interface ResolvedShape {
    kind: 'shape';
    fabricObj: fabric.FabricObject;
    routing: AssetExportInfo;
  }
  interface ResolvedText {
    kind: 'text';
    polylines: FlatPolyline[];
    routing: AssetExportInfo;
  }
  type Resolved = ResolvedShape | ResolvedText;

  const resolved: Resolved[] = [];

  // Filtro implícito da forma de corte do produto: ela é adicionada por
  // canvas-engine SEM id capi (não passa por addAppliqueSvg/etc), então o
  // check getCapiId() abaixo já a descarta. Não precisamos detectar por
  // cor de stroke — isso seria agressivo demais (todos os apliques/
  // gravações usam o mesmo SVG_BASE_STROKE #2a2c2e por convenção visual).
  // Aqui o discriminador correto é "tem LayerMeta? então é user content".
  for (const obj of canvas.getObjects()) {
    if (obj.excludeFromExport) continue;

    const id = getCapiId(obj as unknown as Record<string, unknown>);
    if (!id) continue;

    const layerMeta = layerById.get(id);
    if (!layerMeta) {
      // Órfão: objeto Fabric sem entrada em layers[]. SVG já valida; aqui só
      // avisa pra operador notar via DevTools quando exporta só DXF.
      console.warn(`[dxf-exporter] objeto id="${id}" ignorado — sem LayerMeta correspondente.`);
      continue;
    }
    if (!layerMeta.visible) continue;

    // Texto: converte via opentype → flatten cada path resultante.
    if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
      const routing = await resolveTextRouting(
        layerMeta,
        layerById,
        assetLookup,
        textRouting?.get(id)
      );
      if (!fontBufferLoader) {
        // Sem loader: ignora texto (não emite placeholder em DXF — operador
        // que abrir o arquivo não veria nada de útil, e o SVG cobre esse caso).
        console.warn(`[dxf-exporter] texto id="${id}" ignorado — fontBufferLoader não injetado.`);
        continue;
      }
      const text = (obj as unknown as { text?: string }).text ?? '';
      const ft = obj as unknown as {
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
          fontFamily: ft.fontFamily ?? 'Montserrat',
          fontSize: ft.fontSize ?? 16,
          left: ft.left ?? 0,
          top: ft.top ?? 0,
          angle: ft.angle ?? 0,
          scaleX: ft.scaleX ?? 1,
          scaleY: ft.scaleY ?? 1,
          fill: '#000000', // cor irrelevante — só queremos a geometria
        },
        fontBufferLoader
      );
      if (!conversion.ok) {
        console.warn(
          `[dxf-exporter] falha ao converter texto "${text}" (${conversion.error.kind}): ${conversion.error.message}`
        );
        continue;
      }
      // O SVG retornado é `<g><path d="..."/></g>` em coords de canvas (px).
      const dStr = extractPathD(conversion.svg);
      if (!dStr) continue;
      const polylines = flattenSvgPath(dStr, { toleranceMm });
      // Converte px → mm + Y-flip pra DXF.
      const dxfPolylines = polylines.map((p) => pointsToMm(p, productHeightMm));
      resolved.push({ kind: 'text', polylines: dxfPolylines, routing });
      continue;
    }

    // Shape (Path/Rect/Circle/Group): resolve asset via routing tradicional.
    let assetId: string | null = null;
    if (layerMeta.kind === 'principal') assetId = layerMeta.appliqueId;
    else if (layerMeta.kind === 'visual') {
      assetId = layerMeta.engravingId ?? layerMeta.markingId ?? null;
    } else continue; // OperationLayerMeta não tem objeto Fabric

    if (!assetId) {
      // visual avulso (rect/slot sem asset). SVG lança; DXF avisa.
      console.warn(`[dxf-exporter] layer id="${id}" ignorada — visual sem assetId.`);
      continue;
    }

    const asset = await assetLookup(assetId);
    if (!asset) {
      // banco inconsistente — log já saiu do SVG; aqui avisa.
      console.warn(`[dxf-exporter] assetId="${assetId}" não encontrado no banco.`);
      continue;
    }
    assertValidOperation(asset.operation, `dxf-exporter:asset(${assetId})`);
    assertValidMachines(asset.machines, `dxf-exporter:asset(${assetId})`);

    resolved.push({ kind: 'shape', fabricObj: obj, routing: asset });
  }

  if (resolved.length === 0) return new Map();

  // ── Bucketing: cada (machineId, operation) vira um arquivo ────────────────
  const buckets = new Map<DxfBucketKey, Resolved[]>();
  for (const r of resolved) {
    for (const machineId of r.routing.machines) {
      const key = makeDxfBucketKey(machineId, r.routing.operation);
      const arr = buckets.get(key) ?? [];
      arr.push(r);
      buckets.set(key, arr);
    }
  }

  // ── Emite 1 DXF por bucket ────────────────────────────────────────────────
  const output = new Map<DxfBucketKey, string>();
  for (const [key, items] of buckets) {
    const { operation } = parseDxfBucketKey(key);
    const layerName: DxfLayerName = operation; // 1:1 mapping
    const builder = new DxfBuilder().useLayer(layerName);

    for (const r of items) {
      if (r.kind === 'text') {
        for (const poly of r.polylines) {
          builder.polyline(poly.points, poly.closed);
        }
      } else {
        const polylines = extractGeometryAsMm(r.fabricObj, productHeightMm, toleranceMm);
        for (const poly of polylines) {
          builder.polyline(poly.points, poly.closed);
        }
      }
    }

    output.set(key, builder.build());
  }

  return output;
}

// ── Helpers privados ─────────────────────────────────────────────────────────

/** Resolve texto: igual ao svg-exporter. Sem throws — texto sem rota é ignorado. */
async function resolveTextRouting(
  textLayer: LayerMeta,
  layerById: Map<string, LayerMeta>,
  assetLookup: AssetLookupFn,
  override?: { operation: Operation; machines?: string[] }
): Promise<AssetExportInfo> {
  if (override?.machines) {
    return { operation: override.operation, machines: override.machines };
  }
  // Sem override completo: precisa do PrincipalLayerMeta pai.
  if (textLayer.kind === 'visual' && textLayer.parentLayerId) {
    const parent = layerById.get(textLayer.parentLayerId);
    if (parent?.kind === 'principal' && parent.appliqueId) {
      const parentAsset = await assetLookup(parent.appliqueId);
      if (parentAsset) {
        return {
          operation: override?.operation ?? 'gravacao',
          machines: parentAsset.machines,
        };
      }
    }
  }
  // Sem rota — DXF retorna routing degenerado (machines: []); caller filtra.
  return { operation: override?.operation ?? 'gravacao', machines: [] };
}

/** Extrai o `d` do primeiro `<path>` no SVG retornado por opentype. */
function extractPathD(svg: string): string | null {
  const m = svg.match(/<path[^>]*\sd\s*=\s*"([^"]+)"/);
  return m ? m[1]! : null;
}

/** Converte polyline px → mm com Y-flip aplicado. */
function pointsToMm(poly: FlatPolyline, productHeightMm: number): FlatPolyline {
  return {
    points: poly.points.map((p) => ({
      x: p.x * PX_TO_MM,
      y: flipY(p.y * PX_TO_MM, productHeightMm),
    })),
    closed: poly.closed,
  };
}

/**
 * Extrai geometria de um Fabric object como polilinhas em mm/Y-flipped.
 *
 * Estratégia:
 *   - Rect: 4 cantos via aCoords (transform absoluto já aplicado pelo Fabric).
 *   - Circle/Ellipse: amostra paramétrica.
 *   - Path: cada cmd transformado via calcTransformMatrix + pathOffset.
 *   - Group: recursivo nos filhos (com matrix do grupo composta).
 *   - Outros: pega bbox e emite retângulo (degrada graciosamente).
 */
function extractGeometryAsMm(
  obj: fabric.FabricObject,
  productHeightMm: number,
  toleranceMm: number
): FlatPolyline[] {
  const type = obj.type;

  if (type === 'rect') {
    return [rectAsPolyline(obj, productHeightMm)];
  }
  if (type === 'circle') {
    return [circleAsPolyline(obj, productHeightMm, toleranceMm)];
  }
  if (type === 'path') {
    return pathAsPolylines(obj, productHeightMm, toleranceMm);
  }
  if (type === 'group') {
    // Recursivo: cada filho herda o transform do grupo no calcTransformMatrix.
    const group = obj as unknown as { _objects?: fabric.FabricObject[] };
    const children = group._objects ?? [];
    const out: FlatPolyline[] = [];
    for (const child of children) {
      out.push(...extractGeometryAsMm(child, productHeightMm, toleranceMm));
    }
    return out;
  }
  // Fallback: bbox como retângulo.
  return [rectAsPolyline(obj, productHeightMm)];
}

function rectAsPolyline(obj: fabric.FabricObject, productHeightMm: number): FlatPolyline {
  // aCoords: 4 cantos absolutos (tl, tr, br, bl) — já com transform aplicado.
  const c = (obj as unknown as { aCoords?: Record<string, { x: number; y: number }> }).aCoords;
  if (c?.tl && c?.tr && c?.br && c?.bl) {
    return {
      points: [c.tl, c.tr, c.br, c.bl].map((p) => ({
        x: p.x * PX_TO_MM,
        y: flipY(p.y * PX_TO_MM, productHeightMm),
      })),
      closed: true,
    };
  }
  // Fallback raro (objeto sem aCoords inicializado): bbox.
  const bb = obj.getBoundingRect();
  return {
    points: [
      { x: bb.left, y: bb.top },
      { x: bb.left + bb.width, y: bb.top },
      { x: bb.left + bb.width, y: bb.top + bb.height },
      { x: bb.left, y: bb.top + bb.height },
    ].map((p) => ({ x: p.x * PX_TO_MM, y: flipY(p.y * PX_TO_MM, productHeightMm) })),
    closed: true,
  };
}

function circleAsPolyline(
  obj: fabric.FabricObject,
  productHeightMm: number,
  toleranceMm: number
): FlatPolyline {
  const c = obj as unknown as {
    left?: number;
    top?: number;
    radius?: number;
    scaleX?: number;
    scaleY?: number;
  };
  const cx = (c.left ?? 0) + (c.radius ?? 0);
  const cy = (c.top ?? 0) + (c.radius ?? 0);
  const r = (c.radius ?? 0) * Math.max(c.scaleX ?? 1, c.scaleY ?? 1);
  // N segmentos pra erro de chord < tolerance:
  //   chord_err ≈ r × (1 - cos(π/N)) ≈ r × π²/(2N²)
  //   → N ≥ π × sqrt(r / (2 × tolerance))
  const rMm = r * PX_TO_MM;
  const N = Math.max(8, Math.ceil(Math.PI * Math.sqrt(rMm / (2 * toleranceMm))));
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N;
    const px = cx + r * Math.cos(t);
    const py = cy + r * Math.sin(t);
    points.push({ x: px * PX_TO_MM, y: flipY(py * PX_TO_MM, productHeightMm) });
  }
  // Fecha repetindo o primeiro
  points.push({ ...points[0]! });
  return { points, closed: true };
}

function pathAsPolylines(
  obj: fabric.FabricObject,
  productHeightMm: number,
  toleranceMm: number
): FlatPolyline[] {
  const p = obj as unknown as {
    path?: Array<Array<string | number>>;
    pathOffset?: { x: number; y: number };
    calcTransformMatrix?: () => number[];
  };
  const path = p.path;
  if (!path || path.length === 0) return [];
  // Re-serializa path[] como string `d` (subtraindo pathOffset porque Fabric
  // centra o path no left/top, e calcTransformMatrix vai recentralizar).
  const offset = p.pathOffset ?? { x: 0, y: 0 };
  const dStr = serializePathCmds(path, offset);
  const polylines = flattenSvgPath(dStr, { toleranceMm });

  // Aplica transform absoluto em cada ponto.
  const matrix = p.calcTransformMatrix?.();
  if (!matrix) {
    return polylines.map((poly) => pointsToMm(poly, productHeightMm));
  }
  // Manualmente: [a, b, c, d, e, f] → (x', y') = (a*x + c*y + e, b*x + d*y + f)
  const [a, b, c, d, e, f] = matrix as [number, number, number, number, number, number];
  return polylines.map((poly) => ({
    points: poly.points.map((pt) => {
      const ax = a * pt.x + c * pt.y + e;
      const ay = b * pt.x + d * pt.y + f;
      return { x: ax * PX_TO_MM, y: flipY(ay * PX_TO_MM, productHeightMm) };
    }),
    closed: poly.closed,
  }));
}

/** Serializa fabric path[] como string `d`, subtraindo pathOffset. */
function serializePathCmds(
  path: Array<Array<string | number>>,
  offset: { x: number; y: number }
): string {
  const parts: string[] = [];
  for (const cmd of path) {
    const op = cmd[0] as string;
    if (op === 'Z' || op === 'z') {
      parts.push('Z');
      continue;
    }
    const nums: number[] = [];
    for (let i = 1; i < cmd.length; i++) {
      const v = cmd[i] as number;
      // Alterna x/y: índices ímpares (relativos ao 1) são x, pares são y.
      // Ex em C: cp1x cp1y cp2x cp2y x y — 0,2,4=x ; 1,3,5=y
      const isX = (i - 1) % 2 === 0;
      nums.push(v - (isX ? offset.x : offset.y));
    }
    parts.push(`${op} ${nums.join(' ')}`);
  }
  return parts.join(' ');
}
