/**
 * png-exporter.ts — Motor de exportação PNG mockup (Onda 9, Fase 9E).
 *
 * Por que existe:
 *   O cliente final do Gabriell precisa visualizar como a peça vai ficar
 *   ANTES da produção — mockup realista com texturas (ABS escovado dourado,
 *   prata, etc.). Diferente do SVG de produção (stroke-only, cores semânticas),
 *   o PNG é puramente visual: texturas, sombras, gradientes, exatamente como
 *   aparece no canvas.
 *
 * Por que é trivial:
 *   - Texturas no Capi são `fabric.Pattern` (ver material-applier.ts) aplicadas
 *     como fill nos objetos. Canvas2D nativo renderiza Pattern fills, e
 *     `fabric.Canvas.toDataURL({ multiplier })` faz exatamente isso em alta
 *     resolução. Sem reimplementar nada.
 *   - O multiplier converte do espaço de canvas (px @ MM_TO_PX=4 → 96 DPI)
 *     pro DPI alvo. Default 300 DPI = mockup de impressão pra cliente.
 *
 * Tratamento de visibility:
 *   `LayerMeta.visible === false` esconde objetos visualmente antes do
 *   `toDataURL`, depois restaura — padrão STRIP-BEFORE-SERIALIZE espelhando
 *   `CanvasEngine.serialize()`. Mantém estado do canvas vivo intacto pro
 *   usuário continuar editando após exportar.
 *
 * Retorno:
 *   Uint8Array (bytes brutos do PNG, header `89 50 4E 47 0D 0A 1A 0A`).
 *   Portável entre Node (testes) e browser (runtime); a UI converte pra
 *   Blob via `new Blob([bytes], { type: 'image/png' })` quando precisa
 *   pra `saveAs` ou similar.
 */
import * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerMeta } from '@/data/schema';

/**
 * DPI base do canvas Fabric. `MM_TO_PX = 4` em units.ts equivale a um
 * canvas de 4 px/mm. 1 inch = 25.4 mm, então 4 px/mm = 4 * 25.4 = 101.6 px/inch.
 * É essa a "DPI nativa" — pra atingir 300 DPI no PNG, o multiplier
 * é `targetDpi / 101.6`.
 */
const CANVAS_NATIVE_DPI = 101.6;

/**
 * Bounding box em pixels do canvas Fabric (mesmo espaço que `obj.left/top`
 * e `obj.getBoundingRect()`). Usado pra recortar a área da prancha no
 * mockup profissional — sem isso o PNG inclui todo o viewport, com vazios.
 */
export interface PngBoundingBoxPx {
  leftPx: number;
  topPx: number;
  rightPx: number;
  bottomPx: number;
}

/**
 * Viewport retangular calculado pelo `computeMockupViewport` — pronto pra
 * ser passado direto pro `fabric.Canvas.toDataURL({left, top, width, height})`.
 */
export interface PngMockupViewport {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export interface PngExportOptions {
  /**
   * Layers do canvas. Espelha o que `CanvasEngine.serialize().capi.layers`
   * retorna. Usado pra detectar quais objetos devem ser ocultados
   * (LayerMeta.visible === false).
   */
  layers: LayerMeta[];
  /**
   * DPI alvo do PNG. Default 300 (impressão profissional, mockup pra cliente).
   * Valores menores (96, 150) economizam memória/tempo em previews; valores
   * maiores podem estourar buffer em produtos grandes.
   */
  dpi?: number;
  /**
   * Cor de fundo do PNG. Default transparente. Algumas viewers tratam
   * transparência como preto; passar `#ffffff` se a UI quer fundo claro.
   *
   * Onda 17 — Mockup profissional usa `#F4F4F2` (cinza claro neutro).
   */
  backgroundColor?: string;
  /**
   * Onda 17 — Aplica sombra difusa nos objetos `kind: 'principal'` (apliques
   * base). Strip-restore simétrico: a sombra é adicionada antes do toDataURL
   * e removida no finally, então o canvas vivo continua sem sombra durante
   * edição. Default false (mantém comportamento legado).
   */
  shadow?: boolean;
  /**
   * Onda 17 — Quando informado junto com `clientBounds`, o PNG é recortado
   * no retângulo `clientBounds expandido por marginPx` (em px do canvas).
   * Default 0 (sem recorte — exporta viewport inteiro).
   */
  marginPx?: number;
  /**
   * Onda 17 — Bounding box dos broches da prancha em px do canvas. Caller
   * (useBoardEngine/page) é quem sabe quais objetos contam como "broche";
   * o exporter só recebe o retângulo pronto. Sem isso o PNG fica com o
   * viewport inteiro (canvas full, com vazios).
   */
  clientBounds?: PngBoundingBoxPx;
}

/**
 * Onda 17 — Calcula o viewport final do mockup a partir do bounding box
 * dos broches + margem. Função pura, testável sem Fabric.
 *
 * Garantias:
 *   - width/height são positivos (clampa em 1 px se bounds degenerados)
 *   - left/top podem ser negativos (caller decide se quer clampar a 0)
 *
 * Fórmula: viewport = bounds expandido em `marginPx` em cada lado.
 */
export function computeMockupViewport(
  bounds: PngBoundingBoxPx,
  marginPx: number
): PngMockupViewport {
  const m = Math.max(0, marginPx);
  const leftPx = bounds.leftPx - m;
  const topPx = bounds.topPx - m;
  const widthPx = Math.max(1, bounds.rightPx - bounds.leftPx + 2 * m);
  const heightPx = Math.max(1, bounds.bottomPx - bounds.topPx + 2 * m);
  return { leftPx, topPx, widthPx, heightPx };
}

/**
 * Onda 17 — Configuração default da sombra do mockup. Exportado pra testes
 * inspecionarem os valores aplicados. Tweaks de visual passam por aqui.
 */
export const MOCKUP_SHADOW_CONFIG = {
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  color: 'rgba(0,0,0,0.15)',
} as const;

/**
 * Onda 17 — Cor do stroke de corte aplicada pelo canvas-engine na base SVG
 * do produto e nos apliques principais (constante `SVG_BASE_STROKE` em
 * canvas-engine.ts:104). Esse contorno é decoração do editor (forma de
 * corte visível pro operador); no mockup pra cliente, sai do PNG.
 *
 * Match case-insensitive porque o Fabric pode normalizar pra `#2A2C2E`
 * dependendo do path de serialização/deserialização.
 */
const CUT_STROKE_COLOR = '#2a2c2e';

function isCutStroke(stroke: unknown): boolean {
  return typeof stroke === 'string' && stroke.toLowerCase() === CUT_STROKE_COLOR;
}

/**
 * Exporta o canvas como PNG bytes. Retorna Uint8Array (header `89 50 4E 47`).
 *
 * Side-effect contract: o método toca temporariamente em `visible` dos
 * objetos ocultados via LayerMeta e no `backgroundColor` do canvas, mas
 * restaura tudo antes de retornar. O usuário não percebe alteração visual
 * mesmo durante o export (`renderAll` é chamado uma vez no fim pra garantir).
 */
export async function exportPngMockup(
  canvas: fabric.Canvas,
  options: PngExportOptions
): Promise<Uint8Array> {
  const {
    layers,
    dpi = 300,
    backgroundColor,
    shadow = false,
    marginPx = 0,
    clientBounds,
  } = options;

  // Index visibility por id pra lookup O(1).
  const hiddenIds = new Set<string>();
  // Onda 17 — index principals pra aplicar sombra. Cruza com hiddenIds (não
  // aplica sombra em principal oculto — não faria diferença, mas garantimos).
  const principalIds = new Set<string>();
  for (const layer of layers) {
    if (!layer.visible) hiddenIds.add(layer.id);
    if (layer.kind === 'principal' && layer.visible) principalIds.add(layer.id);
  }

  // ── STRIP: oculta objetos invisíveis + salva estado original ──────────────
  // Padrão idêntico ao STRIP-BEFORE-SERIALIZE do canvas-engine.ts. Garante
  // que o canvas visível ao usuário não seja alterado entre frames.
  const restoredVisibility: Array<{ obj: fabric.FabricObject; visible: boolean }> = [];
  // Onda 17 — STRIP simétrico pra sombra. obj.shadow pode ser null ou
  // fabric.Shadow; guardamos a ref pra restaurar exatamente igual.
  const restoredShadow: Array<{ obj: fabric.FabricObject; shadow: fabric.Shadow | null }> = [];
  // Onda 17 (hotfix pós-print, definitivo) — STRIP simétrico pro stroke
  // de corte (#2a2c2e). Esse stroke é aplicado na base SVG do produto
  // (single-product) e em cada objeto do aplique (multi-broche) por
  // `addAppliqueSvg`/`loadProductSvg*`. Aparece como contorno cinza-escuro
  // ao redor da placa.
  //
  // Identificar pela COR é determinístico: #2a2c2e nunca aparece em
  // conteúdo do usuário (texto, logos importados); é constante interna do
  // editor. Funciona pra Path único, Group, ou filhos de Group — sem
  // depender de flags Capi.
  const restoredCutStrokes: Array<{
    obj: fabric.FabricObject;
    stroke: string | fabric.TFiller | null;
  }> = [];

  for (const obj of canvas.getObjects()) {
    const rec = obj as unknown as Record<string, unknown>;

    // Onda 17 (hotfix pós-print) — fabric.toDataURL ignora `excludeFromExport`
    // (esse flag só vale pra toObject/toJSON). Precisamos ocultar manualmente
    // o que NÃO deve aparecer no mockup, sendo específico sobre cada tipo:
    //
    //   - __capiOverlay         = slot overlay (tracejado vermelho), board
    //                             highlight (tracejado azul). Decoração editor.
    //   - __capiBase            = stroke preto da base SVG (linha de corte).
    //                             Pertence ao SVG de produção, não ao mockup.
    //   - __capiAreaPlaceholder = retângulo roxo de TEXT_AREA/LOGO_AREA da
    //                             Onda 33+. Bug-fix Onda 36+: guia visual,
    //                             nunca aparece em mockup do cliente.
    //
    // Mantemos __capiMaterialRect (a textura metálica) e conteúdo do usuário
    // (texto, logos) sem mexer.
    const isOverlay = rec.__capiOverlay === true;
    const isBase = rec.__capiBase === true;
    const isAreaPlaceholder = rec.__capiAreaPlaceholder === true;
    const isSlotBody = rec.__capiSlotBody === true;

    if (isOverlay || isBase || isAreaPlaceholder || isSlotBody) {
      restoredVisibility.push({ obj, visible: obj.visible ?? true });
      obj.set({ visible: false });
      continue;
    }

    const id = getCapiId(rec);
    if (!id) continue;
    if (hiddenIds.has(id)) {
      restoredVisibility.push({ obj, visible: obj.visible ?? true });
      obj.set({ visible: false });
    } else if (shadow && principalIds.has(id)) {
      // Onda 17 — sombra difusa em principals (apenas quando shadow=true).
      restoredShadow.push({
        obj,
        shadow: (obj.shadow as fabric.Shadow | null) ?? null,
      });
      obj.set({ shadow: new fabric.Shadow({ ...MOCKUP_SHADOW_CONFIG }) });
    }
  }

  // Onda 17 (hotfix definitivo) — varredura adicional pra ZERAR o stroke de
  // corte (#2a2c2e). Funciona em 3 casos:
  //   - Path único com stroke direto (multi-broche reaberto via snapshot,
  //     descobrimos por log que vira `path` único, não Group)
  //   - Group/aplique recém-criado: stroke nos filhos
  //   - Base SVG single-product: mesma estrutura
  // Por isso percorremos canvas + recursivamente filhos.
  function stripCutStrokeRecursive(o: fabric.FabricObject): void {
    if (isCutStroke(o.stroke)) {
      restoredCutStrokes.push({ obj: o, stroke: o.stroke ?? null });
      o.set({ stroke: '' });
    }
    const kids = (o as unknown as { _objects?: fabric.FabricObject[] })._objects;
    if (Array.isArray(kids)) {
      for (const k of kids) stripCutStrokeRecursive(k);
    }
  }
  for (const obj of canvas.getObjects()) {
    stripCutStrokeRecursive(obj);
  }

  const originalBg = canvas.backgroundColor;
  if (backgroundColor !== undefined) {
    canvas.backgroundColor = backgroundColor;
  }

  // Onda 17 — STRIP-RESTORE da viewportTransform.
  //   `toDataURL({left, top, width, height})` interpreta as coords no
  //   espaço CSS do canvas (após VPT aplicada). Como o usuário pode ter dado
  //   zoom/pan, `clientBounds` (em px de objeto) não bate com o que está na
  //   tela. Normalizamos a VPT pra identity durante o export — assim as
  //   coords de objeto e viewport coincidem — e restauramos no finally pra
  //   não estragar a sessão do operador (zoom/pan preservados).
  //
  //   Também restauramos backgroundColor independente de visibility/shadow
  //   pra garantir reset mesmo quando ninguém mexeu em obj algum.
  const originalVpt = canvas.viewportTransform
    ? ([...canvas.viewportTransform] as [number, number, number, number, number, number])
    : null;
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

  // toDataURL precisa do canvas renderizado pra capturar o estado mais
  // recente (objetos recém-ocultados não estariam fora do composite sem isso).
  canvas.requestRenderAll();
  // `requestRenderAll` é assíncrono — força o render aqui pra garantir
  // que o frame que vamos rasterizar reflete o `visible: false`.
  canvas.renderAll();

  const multiplier = dpi / CANVAS_NATIVE_DPI;

  // Onda 17 — se temos bounds + margem, recortamos o viewport. Caso
  // contrário, comportamento legado (canvas inteiro).
  const viewport = clientBounds ? computeMockupViewport(clientBounds, marginPx) : null;

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier,
      ...(viewport
        ? {
            left: viewport.leftPx,
            top: viewport.topPx,
            width: viewport.widthPx,
            height: viewport.heightPx,
          }
        : {}),
      // Não passa enableRetinaScaling — queremos px reais, não DPR-aware.
    });
  } finally {
    // ── RESTORE: símétrico ao STRIP. Sempre executa (mesmo em erro). ─────
    for (const { obj, visible } of restoredVisibility) {
      obj.set({ visible });
    }
    for (const { obj, shadow: original } of restoredShadow) {
      obj.set({ shadow: original });
    }
    for (const { obj, stroke: original } of restoredCutStrokes) {
      obj.set({ stroke: original });
    }
    if (backgroundColor !== undefined) {
      canvas.backgroundColor = originalBg;
    }
    if (originalVpt) {
      canvas.setViewportTransform(originalVpt);
    }
    canvas.requestRenderAll();
  }

  return dataUrlToBytes(dataUrl);
}

/**
 * Converte `data:image/png;base64,iVBORw0KGgo...` em Uint8Array dos bytes
 * do PNG. Funciona em Node (Buffer.from) e browser (atob).
 *
 * Exportado pra teste unitário.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error(`[png-exporter] data URL inválida: vírgula ausente`);
  }
  const base64 = dataUrl.slice(commaIdx + 1);
  // atob existe em jsdom + browsers modernos. Buffer.from(base64, 'base64')
  // funciona em Node — mas atob também via global polyfill no jsdom.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Multiplier exposto pra teste — confirma a fórmula do DPI.
 * 300 / 101.6 ≈ 2.9527 (4 px/mm → 300 dpi).
 */
export function dpiToMultiplier(dpi: number): number {
  return dpi / CANVAS_NATIVE_DPI;
}
