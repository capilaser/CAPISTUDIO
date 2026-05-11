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
import type * as fabric from 'fabric';

import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerMeta } from '@/data/schema';

/**
 * DPI base do canvas Fabric. `MM_TO_PX = 4` em units.ts equivale a um
 * canvas de 4 px/mm. 1 inch = 25.4 mm, então 4 px/mm = 4 * 25.4 = 101.6 px/inch.
 * É essa a "DPI nativa" — pra atingir 300 DPI no PNG, o multiplier
 * é `targetDpi / 101.6`.
 */
const CANVAS_NATIVE_DPI = 101.6;

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
   */
  backgroundColor?: string;
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
  const { layers, dpi = 300, backgroundColor } = options;

  // Index visibility por id pra lookup O(1).
  const hiddenIds = new Set<string>();
  for (const layer of layers) {
    if (!layer.visible) hiddenIds.add(layer.id);
  }

  // ── STRIP: oculta objetos invisíveis + salva estado original ──────────────
  // Padrão idêntico ao STRIP-BEFORE-SERIALIZE do canvas-engine.ts. Garante
  // que o canvas visível ao usuário não seja alterado entre frames.
  const restoredVisibility: Array<{ obj: fabric.FabricObject; visible: boolean }> = [];
  if (hiddenIds.size > 0) {
    for (const obj of canvas.getObjects()) {
      const id = getCapiId(obj as unknown as Record<string, unknown>);
      if (!id) continue;
      if (hiddenIds.has(id)) {
        restoredVisibility.push({ obj, visible: obj.visible ?? true });
        obj.set({ visible: false });
      }
    }
  }

  const originalBg = canvas.backgroundColor;
  if (backgroundColor !== undefined) {
    canvas.backgroundColor = backgroundColor;
  }

  // toDataURL precisa do canvas renderizado pra capturar o estado mais
  // recente (objetos recém-ocultados não estariam fora do composite sem isso).
  canvas.requestRenderAll();
  // `requestRenderAll` é assíncrono — força o render aqui pra garantir
  // que o frame que vamos rasterizar reflete o `visible: false`.
  canvas.renderAll();

  const multiplier = dpi / CANVAS_NATIVE_DPI;

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL({
      format: 'png',
      multiplier,
      // Não passa width/height — Fabric calcula do canvas vivo * multiplier.
      // Não passa enableRetinaScaling — queremos px reais, não DPR-aware.
    });
  } finally {
    // ── RESTORE: símétrico ao STRIP. Sempre executa (mesmo em erro). ─────
    for (const { obj, visible } of restoredVisibility) {
      obj.set({ visible });
    }
    if (backgroundColor !== undefined) {
      canvas.backgroundColor = originalBg;
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
