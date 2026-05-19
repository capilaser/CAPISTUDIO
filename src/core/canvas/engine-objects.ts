/**
 * engine-objects.ts — funções puras de criação de objetos do canvas (Onda 30.C).
 *
 * Extraído de canvas-engine.ts. Cobre:
 *  - addAppliqueSvg (Principal layer)
 *  - addEngravingSvg (Visual layer com engravingId)
 *  - addMarkingSvg (Visual layer com markingId)
 *  - addRectangle (rect decorativo, registra VisualLayerMeta default)
 *
 * Cada função recebe `canvas` + `layerMeta` + helpers. registerLayerMeta
 * vive em engine-layers.ts; reutilizamos via parâmetro.
 */
import * as fabric from 'fabric';

import type { LayerMeta, PrincipalLayerMeta, VisualLayerMeta } from '@/data/schema';
import type { RectMm } from './alignment/snap-targets';
import type { CorelSvgMeta } from './corel-svg-parser';
import { generateObjectId } from './engine-serialization';
import { mmToPx } from './units';

/**
 * ADR 010 §3: canvas engine is authoritative for base-layer colour.
 * Matches tailwind token ink-700 (#2a2c2e) — do NOT use CSS var() here.
 */
const SVG_BASE_STROKE = '#2a2c2e';
const DEFAULT_LAYER_FILL = 'rgba(122, 162, 247, 0.18)';

/**
 * Loads an applique SVG onto the canvas as a new principal layer.
 *
 * Positioning is literal + centred relative to the product viewBox (R3):
 *   left = mmToPx((productWidthMm  − meta.widthMm)  / 2)
 *   top  = mmToPx((productHeightMm − meta.heightMm) / 2)
 * If the applique is larger than the product, left/top go negative — this is
 * intentional (applique extravasates the product boundary by design).
 *
 * Onda 13.6: aceita `position` opcional pra colocar o aplique em coordenada
 * absoluta (em mm). Usado pelo editor multi-broche: cada broche entra
 * empilhado no offset Y certo, ignorando centragem.
 */
export async function addAppliqueSvg(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  productWidthMm: number,
  productHeightMm: number,
  meta: CorelSvgMeta,
  name: string,
  appliqueId: string,
  position?: { leftMm: number; topMm: number }
): Promise<string> {
  const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
  const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
  if (validObjects.length === 0) {
    throw new Error(
      `[canvas-engine] addAppliqueSvg: no drawable shapes in SVG for applique "${appliqueId}".`
    );
  }

  // ADR 011: fill: '' = transparent in Fabric/Canvas2D. Do NOT use 'none'.
  for (const obj of validObjects) {
    obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
  }

  const group = fabric.util.groupSVGElements(validObjects);

  const scaleX = meta.scaleFactor;
  const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

  // Onda 13.6 — quando `position` é passado, pula centragem.
  const leftMm = position ? position.leftMm : (productWidthMm - meta.widthMm) / 2;
  const topMm = position ? position.topMm : (productHeightMm - meta.heightMm) / 2;
  const left = mmToPx(leftMm);
  const top = mmToPx(topMm);

  group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

  // Onda 26c — apliques-base do Novo Pedido (appliqueId `board-item:*`) são
  // a "página" do produto. Operador edita o que está em cima (textos, logos,
  // decorativos), não a base. Travados: não vira target de pointer (click
  // atravessa pro filho acima, padrão Figma/Corel) e não aparece em seleção.
  // No editor de Padrões (appliqueId arbitrário) continua editável.
  const isBoardItemBase = appliqueId.startsWith('board-item:');
  if (isBoardItemBase) {
    group.set({ selectable: false, evented: false, hoverCursor: 'default' });
  }

  const id = generateObjectId();
  (group as unknown as Record<string, unknown>).id = id;

  canvas.add(group);
  canvas.requestRenderAll();

  const principalMeta: PrincipalLayerMeta = {
    id,
    parentLayerId: null,
    name,
    zIndex: canvas.getObjects().length - 1,
    visible: true,
    locked: false,
    kind: 'principal',
    materialId: null,
    appliqueId,
    // Mini-Onda 8.6: bounds autoritativos do viewBox SVG (ADR 005).
    originalBounds: {
      left: leftMm,
      top: topMm,
      width: meta.widthMm,
      height: meta.heightMm,
    },
  };
  layerMeta.set(id, principalMeta);

  return id;
}

/**
 * Adiciona uma gravação do banco como camada visual no canvas (Onda 8.5).
 *
 * Diferenças vs `addAppliqueSvg`:
 *   - Cria `VisualLayerMeta` (kind: 'visual'), não principal — gravação é
 *     filha de aplique, não peça física.
 *   - Aceita `parentLayerId` opcional do caller. Quando há aplique pai válido,
 *     posiciona no centro do APLIQUE (não do canvas); senão, centro do canvas.
 *   - Persiste `engravingId` em `VisualLayerMeta.engravingId` — Onda 9 lê
 *     isso pra rotear pra máquina/operação correta via `engraving.metadata`.
 *   - Seleciona o grupo recém-criado.
 */
export async function addEngravingSvg(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  getParentBoundsForObject: (objectId: string) => RectMm | null,
  productWidthMm: number,
  productHeightMm: number,
  meta: CorelSvgMeta,
  name: string,
  engravingId: string,
  parentLayerId: string | null
): Promise<string> {
  const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
  const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
  if (validObjects.length === 0) {
    throw new Error(
      `[canvas-engine] addEngravingSvg: no drawable shapes in SVG for engraving "${engravingId}".`
    );
  }

  // ADR 011: fill: '' = transparent. Stroke padrão da peça.
  for (const obj of validObjects) {
    obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
  }

  const group = fabric.util.groupSVGElements(validObjects);

  const scaleX = meta.scaleFactor;
  const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

  // Posição inicial: centro do aplique pai quando há parentLayerId válido,
  // senão centro do canvas.
  const parentBounds = parentLayerId ? getParentBoundsForObject(parentLayerId) : null;
  const cxMm = parentBounds ? parentBounds.left + parentBounds.width / 2 : productWidthMm / 2;
  const cyMm = parentBounds ? parentBounds.top + parentBounds.height / 2 : productHeightMm / 2;
  const left = mmToPx(cxMm - meta.widthMm / 2);
  const top = mmToPx(cyMm - meta.heightMm / 2);

  group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

  const id = generateObjectId();
  (group as unknown as Record<string, unknown>).id = id;

  canvas.add(group);

  const visualMeta: VisualLayerMeta = {
    id,
    parentLayerId,
    name,
    zIndex: canvas.getObjects().length - 1,
    visible: true,
    locked: false,
    kind: 'visual',
    materialId: null,
    engravingId,
  };
  layerMeta.set(id, visualMeta);

  // Seleciona o grupo recém-criado — feedback imediato + atalho pra
  // alignment/proximity overlay reagir na sequência.
  canvas.setActiveObject(group);
  canvas.requestRenderAll();

  return id;
}

/**
 * Adiciona uma marcação do banco como camada visual no canvas (Onda 9).
 *
 * Espelha `addEngravingSvg`: cria `VisualLayerMeta` filha do aplique
 * selecionado (ou solta), com `markingId` persistido pra Onda 9 rotear
 * pra máquina/operação correta no export.
 */
export async function addMarkingSvg(
  canvas: fabric.Canvas,
  layerMeta: Map<string, LayerMeta>,
  getParentBoundsForObject: (objectId: string) => RectMm | null,
  productWidthMm: number,
  productHeightMm: number,
  meta: CorelSvgMeta,
  name: string,
  markingId: string,
  parentLayerId: string | null
): Promise<string> {
  const { objects } = await fabric.loadSVGFromString(meta.svgStripped);
  const validObjects = objects.filter((o): o is fabric.FabricObject => o !== null);
  if (validObjects.length === 0) {
    throw new Error(
      `[canvas-engine] addMarkingSvg: no drawable shapes in SVG for marking "${markingId}".`
    );
  }

  for (const obj of validObjects) {
    obj.set({ fill: '', stroke: SVG_BASE_STROKE, strokeWidth: 1, strokeUniform: true });
  }

  const group = fabric.util.groupSVGElements(validObjects);

  const scaleX = meta.scaleFactor;
  const scaleY = mmToPx(meta.heightMm) / meta.viewBoxH;

  const parentBounds = parentLayerId ? getParentBoundsForObject(parentLayerId) : null;
  const cxMm = parentBounds ? parentBounds.left + parentBounds.width / 2 : productWidthMm / 2;
  const cyMm = parentBounds ? parentBounds.top + parentBounds.height / 2 : productHeightMm / 2;
  const left = mmToPx(cxMm - meta.widthMm / 2);
  const top = mmToPx(cyMm - meta.heightMm / 2);

  group.set({ left, top, originX: 'left', originY: 'top', scaleX, scaleY });

  const id = generateObjectId();
  (group as unknown as Record<string, unknown>).id = id;

  canvas.add(group);

  const visualMeta: VisualLayerMeta = {
    id,
    parentLayerId,
    name,
    zIndex: canvas.getObjects().length - 1,
    visible: true,
    locked: false,
    kind: 'visual',
    materialId: null,
    markingId,
  };
  layerMeta.set(id, visualMeta);

  canvas.setActiveObject(group);
  canvas.requestRenderAll();

  return id;
}

/**
 * Adds a user-editable rectangle in product mm coordinates.
 * Top-left positioning, dimensions in mm.
 * Caller deve chamar `registerLayerMeta` em seguida pra registrar VisualLayerMeta.
 */
export function addRectangle(
  canvas: fabric.Canvas,
  registerLayerMeta: (id: string, parentLayerId?: string | null) => void,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number
): fabric.Rect {
  const rect = new fabric.Rect({
    left: mmToPx(xMm),
    top: mmToPx(yMm),
    width: mmToPx(wMm),
    height: mmToPx(hMm),
    originX: 'left',
    originY: 'top',
    fill: DEFAULT_LAYER_FILL,
    stroke: '#7aa2f7',
    strokeWidth: 1,
    strokeUniform: true,
    cornerColor: '#7aa2f7',
    cornerStrokeColor: '#7aa2f7',
    borderColor: '#7aa2f7',
    transparentCorners: false,
    cornerSize: 8,
  });
  canvas.add(rect);

  // Assign a stable id immediately so layerMeta can be keyed by it.
  const rec = rect as unknown as Record<string, unknown>;
  if (typeof rec.id !== 'string' || !rec.id) {
    rec.id = generateObjectId();
  }
  registerLayerMeta(rec.id as string);

  canvas.setActiveObject(rect);
  canvas.requestRenderAll();
  return rect;
}
