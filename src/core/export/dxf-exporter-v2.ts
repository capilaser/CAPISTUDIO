/**
 * dxf-exporter-v2.ts — Pipeline DXF de produção (Sub-onda DXF-3).
 *
 * Substituto do `dxf-exporter.ts` legado (R12/POLYLINE, Onda 18) seguindo
 * CAPISTUDIO_DXF_STANDARD (ADR 020):
 *   - AC1032
 *   - SPLINE como única entidade geométrica
 *   - Cor por entidade (corte=31, gravacao=250, marcacao=5)
 *   - Layer única "Camada 1"
 *   - Coordenadas normalizadas em mm, Y para CIMA (flip vs canvas)
 *
 * Pipeline:
 *   1. Itera canvas.getObjects() (z-order preservada).
 *   2. Para cada objeto: filtra excludeFromExport, guias do editor (slot body,
 *      area placeholder), e objetos sem id capi / sem LayerMeta / invisíveis.
 *   3. Resolve routing via `resolveLayerRouting` / `resolveTextLayerRouting`
 *      (mesma cascata pattern-role > asset legado do exportador antigo).
 *   4. Converte para path SVG `d` em mm:
 *      - Texto → `tryConvertTextToSvgPath` (opentype.js)
 *      - Shapes → `shapeToFlatPathD` (Path/Rect/Circle/Ellipse/Polygon/Group)
 *   5. Para cada `d`: `svgPathToSplines` → `normalizeForDxf` → `encodeSpline`.
 *   6. Agrupa por (machineId, operation) em buckets.
 *   7. Para cada bucket: monta `buildDxfDocument` e retorna no Map.
 *
 * REUSO INTENCIONAL: módulos compartilhados com `svg-exporter.ts` (e antigo
 * dxf-exporter):
 *   - routing-resolver (resoluções de rota)
 *   - svg-shape-to-path (geometria → d em mm)
 *   - svg-text-converter (texto → d via opentype)
 *   - asset-routing-types (tipos canônicos)
 *
 * NÃO COBERTO neste arquivo (escopo DXF-3, decisão Gabriell):
 *   - clipBoundsMm (multi-chapa) — fica para DXF-3.5
 *   - placeholder XML para texto que falha conversão — em DXF não faz sentido
 *     (não existe comentário visível para o operador no software laser).
 *     Quando opentype falha: warn no console + skip (mesma política do exporter
 *     antigo).
 */
import type * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import { type Operation } from '@/data/repositories/_export-validation';
import type { LayerMeta } from '@/data/schema';

import type { AssetExportInfo, AssetLookupFn } from './asset-routing-types';
import { normalizeForDxf } from './dxf-coordinate-normalize';
import {
  bboxOfPathD,
  bboxOfSplines,
  unionBboxes,
  type DebugBbox,
  type DebugObjectSnapshot,
  type DxfDebugReport,
} from './dxf-debug-report';
import { buildDxfDocument, type DxfBounds } from './dxf-document';
import { svgPathToSplines } from './dxf-path-to-splines';
import { type DxfProcess } from './dxf-process-color';
import { encodeSpline, type SplineInput } from './dxf-spline-encoder';
import { resolveLayerRouting, resolveTextLayerRouting } from './routing-resolver';
import { shapeToFlatPathD } from './svg-shape-to-path';
import {
  fromFabricMatrix,
  multiplyMatrix,
  scaleMatrix,
  translateMatrix,
  type AffineMatrix,
} from './svg-path-transform';
import { type FontBufferLoader, tryConvertTextToSvgPath } from './svg-text-converter';

/** Conversão px (canvas Fabric) → mm (sistema técnico). Espelha svg-exporter. */
const PX_PER_MM = 4;
const PX_TO_MM_SCALE = 1 / PX_PER_MM;

/** Precisão decimal usada em `shapeToFlatPathD` (idem svg-exporter). */
const OUTPUT_DECIMALS = 4;

export interface DxfV2ExportOptions {
  productWidthMm: number;
  productHeightMm: number;
  layers: LayerMeta[];
  assetLookup: AssetLookupFn;
  fontBufferLoader?: FontBufferLoader;
  /** Override por texto: (operation, machines opcional). Mesmo formato do legado. */
  textRouting?: Map<string, { operation: Operation; machines?: string[] }>;
  /**
   * Offset em mm para subtrair de cada coordenada antes da conversão.
   *
   * Caso de uso: `useBoardEngine` reserva `CHAPA_LABEL_HEIGHT_MM` (8mm) no topo
   * da prancha para um label visual ("Broches (N)"). Esses 8mm são parte do
   * canvas mas NÃO do produto técnico — sem o offset, o aplique posicionado em
   * y=8mm sairia em y=8mm no DXF, com faixa vazia em y=0..8.
   *
   * Espelha `contentOffsetMm` do `exportSvgByMachine`.
   *
   * Equivalente single-chapa do `clipBoundsMm` do exporter antigo: aqui só
   * subtraímos offset (sem recortar). Multi-chapa fica para DXF-3.5.
   */
  contentOffsetMm?: { xMm: number; yMm: number };
  /**
   * Callback opcional para erros estruturados de conversão de texto (opentype).
   *
   * Espelha o callback do `svg-exporter` — a UI acumula erros e mostra
   * `toast.error` persistente apontando textos/fontes que ficaram fora. DXF v2
   * NÃO emite placeholder XML (não há comentário útil ao operador no
   * software laser); um texto que falha é simplesmente ignorado, e o callback
   * é o único sinal de "saiu sem texto".
   */
  onTextConversionError?: (
    err: import('./svg-text-converter').TextConversionError,
    text: string
  ) => void;
  /**
   * DXF-PRODUCTION-ALIGNMENT — sink opcional de telemetria geométrica.
   *
   * Quando informado, o exporter coleta para CADA objeto exportado snapshots
   * das 8 etapas do pipeline (bbox px Fabric → bbox mm DXF final) + transforms
   * aplicadas + contexto (offset, frame, etc), e chama `debugSink(report)`
   * uma vez no final.
   *
   * Quando omitido, ZERO overhead — exporter não constrói report.
   *
   * Não afeta o conteúdo do Map<bucket, string> retornado.
   */
  debugSink?: (report: DxfDebugReport) => void;
}

/** Chave `${machineId}|${operation}` — 1 arquivo DXF cada. */
export type DxfV2BucketKey = string;

export function makeDxfV2BucketKey(machineId: string, operation: Operation): DxfV2BucketKey {
  return `${machineId}|${operation}`;
}

export function parseDxfV2BucketKey(key: DxfV2BucketKey): {
  machineId: string;
  operation: Operation;
} {
  const [machineId, operation] = key.split('|');
  return { machineId: machineId!, operation: operation as Operation };
}

/**
 * Operation (`'corte' | 'gravacao' | 'marcacao'`) → DxfProcess (mesma string
 * mas tipo isolado do encoder). Hoje os valores coincidem, mas mantemos a
 * função para evitar acoplamento futuro.
 */
function operationToProcess(operation: Operation): DxfProcess {
  return operation as DxfProcess;
}

/**
 * Exporta o canvas como `Map<machineId|operation, dxfString>`.
 *
 * Map vazio quando não há nada exportável (nenhum objeto com rota válida).
 */
export async function exportDxfV2ByMachineAndOperation(
  canvas: fabric.Canvas,
  options: DxfV2ExportOptions
): Promise<Map<DxfV2BucketKey, string>> {
  const {
    productWidthMm,
    productHeightMm,
    layers,
    assetLookup,
    fontBufferLoader,
    textRouting,
    contentOffsetMm,
    onTextConversionError,
    debugSink,
  } = options;

  // DXF-PRODUCTION-ALIGNMENT — só aloca array quando há sink (zero overhead off).
  const debugSnapshots: DebugObjectSnapshot[] | null = debugSink ? [] : null;

  if (productWidthMm <= 0 || productHeightMm <= 0) {
    throw new Error(
      `[dxf-exporter-v2] productWidthMm/productHeightMm inválidos: ${productWidthMm}x${productHeightMm}`
    );
  }

  // Frame matricial externo (mesma fórmula do svg-exporter Onda 37):
  //   scale(1/PX_PER_MM)               — px do canvas → mm reais
  //   × translate(-offsetXmm, -offsetYmm) — desfaz label de chapa (single-chapa)
  // Composição: scale primeiro a cada ponto, depois translate.
  const offX = contentOffsetMm?.xMm ?? 0;
  const offY = contentOffsetMm?.yMm ?? 0;
  const frame: AffineMatrix = multiplyMatrix(
    translateMatrix(-offX, -offY),
    scaleMatrix(PX_TO_MM_SCALE)
  );

  // Bounds do produto. Y normalizado: [0, productHeightMm].
  const bounds: DxfBounds = {
    minX: 0,
    minY: 0,
    maxX: productWidthMm,
    maxY: productHeightMm,
  };

  const layerById = new Map<string, LayerMeta>();
  for (const layer of layers) layerById.set(layer.id, layer);

  // Resolved[]: cada objeto com rota válida + suas SPLINEs prontas (em coords
  // SVG, Y para baixo — flip aplicado depois ao bucketing).
  interface ResolvedShape {
    splines: SplineInput[];
    routing: AssetExportInfo;
  }
  const resolved: ResolvedShape[] = [];

  for (const obj of canvas.getObjects()) {
    if (obj.excludeFromExport) continue;

    // Guias do editor: hitbox de slot e placeholder de AREA não viram geometria.
    const rec = obj as unknown as Record<string, unknown>;
    if (rec.__capiSlotBody === true || rec.__capiAreaPlaceholder === true) continue;

    const id = getCapiId(rec);
    if (!id) continue;

    const layerMeta = layerById.get(id);
    if (!layerMeta) {
      // Mesma política do dxf-exporter legado: warn em vez de throw (banco
      // potencialmente inconsistente — o operador já viu erro no SVG export).
      console.warn(`[dxf-exporter-v2] objeto id="${id}" ignorado — sem LayerMeta correspondente.`);
      continue;
    }
    if (!layerMeta.visible) continue;

    // Texto: via opentype.js. Sem placeholder XML em DXF (não tem espaço para
    // comentário útil ao operador).
    if (obj.type === 'text' || obj.type === 'i-text' || obj.type === 'textbox') {
      const splinesAndRouting = await convertTextToSplines(
        obj,
        id,
        layerMeta,
        layerById,
        assetLookup,
        fontBufferLoader,
        textRouting?.get(id),
        frame,
        onTextConversionError,
        debugSnapshots
      );
      if (splinesAndRouting) resolved.push(splinesAndRouting);
      continue;
    }

    // Shape (Rect/Circle/Path/Group/etc).
    let layerRouting;
    try {
      layerRouting = await resolveLayerRouting(layerMeta, assetLookup, 'dxf-exporter-v2');
    } catch (err) {
      console.warn(
        `[dxf-exporter-v2] layer id="${id}" ignorada — ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
    if (!layerRouting.routing) {
      console.warn(
        `[dxf-exporter-v2] layer id="${id}" name="${layerMeta.name}" sem rota — ` +
          `${layerRouting.reason ?? 'motivo desconhecido'}; ignorada.`
      );
      continue;
    }

    const dStr = shapeToFlatPathD(obj, frame, OUTPUT_DECIMALS);
    if (!dStr) continue;

    const splines = svgPathToSplines(dStr, {
      process: operationToProcess(layerRouting.routing.operation),
    });
    if (splines.length === 0) continue;

    // Debug: snapshot do shape antes do bucketing/flip.
    if (debugSnapshots) {
      debugSnapshots.push(
        buildShapeSnapshot(obj, id, layerMeta, layerRouting.routing, dStr, splines, bounds)
      );
    }

    resolved.push({ splines, routing: layerRouting.routing });
  }

  if (resolved.length === 0) return new Map();

  // Bucketing: 1 entrada por (máquina, operação). Um objeto roteado para 2
  // máquinas aparece em 2 buckets (geometria duplicada — esperado).
  const buckets = new Map<DxfV2BucketKey, SplineInput[]>();
  for (const r of resolved) {
    for (const machineId of r.routing.machines) {
      const key = makeDxfV2BucketKey(machineId, r.routing.operation);
      const arr = buckets.get(key) ?? [];
      arr.push(...r.splines);
      buckets.set(key, arr);
    }
  }

  // Emite 1 documento DXF por bucket: flipY → encode → buildDocument.
  const output = new Map<DxfV2BucketKey, string>();
  for (const [key, splines] of buckets) {
    const flipped = normalizeForDxf(splines, bounds);
    const splineLines = flipped.map((s) => encodeSpline(s));
    const dxf = buildDxfDocument({ bounds, splineEntities: splineLines });
    output.set(key, dxf);
  }

  // Debug: monta o report e dispara o sink. Acontece SÓ se debugSink presente.
  if (debugSink && debugSnapshots) {
    // Atualiza os snapshots com a versão pós-flip (já calculamos durante o
    // pipeline, mas o snapshot guardou só pré-flip). Recalcula pós-flip por
    // objeto sobre as splines individuais — equivalente ao que normalizeForDxf
    // fez agrupado, mas preserva a correspondência objeto→splines.
    for (const snap of debugSnapshots) {
      const postFlip = normalizeForDxf(snap.splinesPreFlip, bounds);
      snap.splinesPostFlip = postFlip;
      snap.splinesPostFlipBboxMm = bboxOfSplines(postFlip);
    }

    // Bbox global canvas (px) e DXF final (mm).
    const canvasBbox = unionBboxes(debugSnapshots.map((s) => s.fabricBoundingRectPx));
    const dxfFinalBbox = unionBboxes(debugSnapshots.map((s) => s.splinesPostFlipBboxMm));

    const report: DxfDebugReport = {
      generatedAt: new Date().toISOString(),
      productMm: { widthMm: productWidthMm, heightMm: productHeightMm },
      contentOffsetMm: { xMm: offX, yMm: offY },
      frame,
      pxPerMm: PX_PER_MM,
      objects: debugSnapshots,
      canvasBoundingBoxPx: canvasBbox,
      dxfFinalBoundingBoxMm: dxfFinalBbox,
    };
    debugSink(report);
  }

  return output;
}

/**
 * Constrói o snapshot de telemetria para um shape (não-texto). As 8 etapas:
 *   1. fabricBoundingRectPx — obj.getBoundingRect() em px do canvas
 *   2. fabricTransformMatrix — obj.calcTransformMatrix() (matrix Fabric)
 *   3. localPathD — null (não emitimos o `d` local separado em shapes)
 *   4. worldPathDmm — o `d` retornado por shapeToFlatPathD (em mm)
 *   5. worldPathBboxMm — bbox parseado de worldPathDmm
 *   6. splinesPreFlip — splines retornadas por svgPathToSplines
 *   7. splinesPostFlip — preenchido depois (após pipeline)
 *   8. splinesPostFlipBboxMm — preenchido depois
 */
function buildShapeSnapshot(
  obj: fabric.FabricObject,
  id: string,
  layerMeta: LayerMeta,
  routing: AssetExportInfo,
  worldPathDmm: string,
  splines: SplineInput[],
  _bounds: DxfBounds
): DebugObjectSnapshot {
  let fabricBoundingRectPx: DebugBbox | null = null;
  try {
    const br = obj.getBoundingRect();
    fabricBoundingRectPx = {
      minX: br.left,
      minY: br.top,
      maxX: br.left + br.width,
      maxY: br.top + br.height,
      width: br.width,
      height: br.height,
    };
  } catch {
    fabricBoundingRectPx = null;
  }

  let fabricTransformMatrix: AffineMatrix | null = null;
  try {
    fabricTransformMatrix = fromFabricMatrix(obj.calcTransformMatrix());
  } catch {
    fabricTransformMatrix = null;
  }

  return {
    id,
    name: layerMeta.name,
    fabricType: obj.type ?? 'unknown',
    textContent: null,
    operation: routing.operation,
    machines: [...routing.machines],
    fabricBoundingRectPx,
    fabricTransformMatrix,
    localPathD: null,
    worldPathDmm,
    worldPathBboxMm: bboxOfPathD(worldPathDmm),
    splinesPreFlip: splines,
    splinesPreFlipBboxMm: bboxOfSplines(splines),
    // Placeholders — preenchidos pelo caller depois do pipeline.
    splinesPostFlip: [],
    splinesPostFlipBboxMm: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
  };
}

/**
 * Snapshot equivalente para texto. Para textos, fabricBoundingRectPx existe
 * mas representa o bbox do TEXTO RASTERIZADO (não da geometria pós-vetorização).
 * O worldPathDmm vem do opentype, já em mm.
 */
function buildTextSnapshot(
  obj: fabric.FabricObject,
  id: string,
  layerMeta: LayerMeta,
  routing: AssetExportInfo,
  textContent: string,
  worldPathDmm: string,
  splines: SplineInput[]
): DebugObjectSnapshot {
  let fabricBoundingRectPx: DebugBbox | null = null;
  try {
    const br = obj.getBoundingRect();
    fabricBoundingRectPx = {
      minX: br.left,
      minY: br.top,
      maxX: br.left + br.width,
      maxY: br.top + br.height,
      width: br.width,
      height: br.height,
    };
  } catch {
    fabricBoundingRectPx = null;
  }

  let fabricTransformMatrix: AffineMatrix | null = null;
  try {
    fabricTransformMatrix = fromFabricMatrix(obj.calcTransformMatrix());
  } catch {
    fabricTransformMatrix = null;
  }

  return {
    id,
    name: layerMeta.name,
    fabricType: obj.type ?? 'text',
    textContent,
    operation: routing.operation,
    machines: [...routing.machines],
    fabricBoundingRectPx,
    fabricTransformMatrix,
    localPathD: null,
    worldPathDmm,
    worldPathBboxMm: bboxOfPathD(worldPathDmm),
    splinesPreFlip: splines,
    splinesPreFlipBboxMm: bboxOfSplines(splines),
    splinesPostFlip: [],
    splinesPostFlipBboxMm: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Texto → SPLINEs + routing. Retorna null se a layer não tem rota ou se a
 * conversão de fonte falha (warn no console, mesma política do antigo).
 */
async function convertTextToSplines(
  obj: fabric.FabricObject,
  id: string,
  layerMeta: LayerMeta,
  layerById: Map<string, LayerMeta>,
  assetLookup: AssetLookupFn,
  fontBufferLoader: FontBufferLoader | undefined,
  textRoutingOverride: { operation: Operation; machines?: string[] } | undefined,
  frame: AffineMatrix,
  onTextConversionError:
    | ((err: import('./svg-text-converter').TextConversionError, text: string) => void)
    | undefined,
  debugSnapshots: DebugObjectSnapshot[] | null
): Promise<{ splines: SplineInput[]; routing: AssetExportInfo } | null> {
  const textResolution = await resolveTextLayerRouting(
    layerMeta,
    layerById,
    assetLookup,
    textRoutingOverride,
    'dxf-exporter-v2'
  );
  if (!textResolution.routing) {
    console.warn(
      `[dxf-exporter-v2] texto id="${id}" sem rota — ${textResolution.reason ?? 'motivo desconhecido'}; ignorado.`
    );
    return null;
  }

  if (!fontBufferLoader) {
    console.warn(`[dxf-exporter-v2] texto id="${id}" ignorado — fontBufferLoader não injetado.`);
    return null;
  }

  const routing = textResolution.routing;
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
      fill: '#000000', // cor irrelevante — descartamos o style, queremos só `d`
    },
    fontBufferLoader,
    frame
  );
  if (!conversion.ok) {
    console.warn(
      `[dxf-exporter-v2] falha ao converter texto "${text}" (${conversion.error.kind}): ${conversion.error.message}`
    );
    onTextConversionError?.(conversion.error, text);
    return null;
  }

  const dStr = extractPathD(conversion.svg);
  if (!dStr) return null;

  const splines = svgPathToSplines(dStr, { process: operationToProcess(routing.operation) });
  if (splines.length === 0) return null;

  if (debugSnapshots) {
    debugSnapshots.push(buildTextSnapshot(obj, id, layerMeta, routing, text, dStr, splines));
  }

  return { splines, routing };
}

/** Extrai o `d` do primeiro `<path>` no SVG retornado por opentype. */
function extractPathD(svg: string): string | null {
  const m = svg.match(/<path[^>]*\sd\s*=\s*"([^"]+)"/);
  return m ? m[1]! : null;
}
