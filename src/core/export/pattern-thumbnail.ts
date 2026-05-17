/**
 * pattern-thumbnail.ts — Onda 14
 *
 * Gera SVG schematic inline pra preview de patterns na galeria. Não é
 * thumbnail fotorrealista — é uma representação esquemática mostrando:
 *
 *   - Contorno do broche (retângulo claro)
 *   - Slots (retângulos tracejados, cor por tipo)
 *   - Decorativos (bordas e traços) como linhas
 *
 * Por que SVG inline em vez de PNG real:
 *   - Render imediato sem IO/canvas DOM
 *   - Escalável sem perda
 *   - Zero dependência do runtime Tauri (funciona em qualquer canvas size)
 *   - Suficiente pro contexto: operador identifica o layout do pattern de
 *     relance, escolhe pela ESTRUTURA, não pelo material (material vem da
 *     cascata).
 *
 * Refinamento futuro: trocar pra PNG real renderizado offscreen quando
 * houver demanda de preview "realista".
 */
import type { FabricCanvasJson } from '@/data/schema';

/** Cores schematic — distinguíveis em fundo claro ou escuro. */
const COLORS = {
  productOutline: '#6b7280', // cinza neutro pra bounds do produto
  slotLogo: '#a855f7', // violeta — logo
  slotNome: '#10b981', // verde — nome
  slotProfissao: '#f59e0b', // amber — profissão
  slotCustom: '#06b6d4', // ciano — texto custom
  decor: '#ef4444', // vermelho fraco — bordas/traços decorativos
} as const;

const MM_TO_PX = 4;

interface SlotMeta {
  type: 'logo' | 'nome' | 'profissao' | 'custom';
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

function slotColor(type: SlotMeta['type']): string {
  switch (type) {
    case 'logo':
      return COLORS.slotLogo;
    case 'nome':
      return COLORS.slotNome;
    case 'profissao':
      return COLORS.slotProfissao;
    case 'custom':
      return COLORS.slotCustom;
  }
}

interface ThumbnailOptions {
  /** Largura do produto em mm. Default 60 (broche). */
  productWidthMm?: number;
  /** Altura do produto em mm. Default 25 (broche). */
  productHeightMm?: number;
  /** Largura final do SVG em px. Resto escala proporcional. Default 120. */
  outWidthPx?: number;
}

/**
 * Renderiza um schematic SVG (string) a partir do canvasJson de um pattern.
 *
 * Convenções de coordenadas:
 *   - canvasJson armazena Fabric objects em px (mm × 4).
 *   - O SVG produzido tem viewBox em mm pra escala intuitiva.
 *   - outWidthPx controla o tamanho renderizado final via atributo `width`.
 */
export function renderPatternThumbnailSvg(
  canvasJson: FabricCanvasJson,
  options: ThumbnailOptions = {}
): string {
  const { productWidthMm = 60, productHeightMm = 25, outWidthPx = 120 } = options;
  const aspect = productHeightMm / productWidthMm;
  const outHeightPx = Math.round(outWidthPx * aspect);

  const parts: string[] = [];

  // Contorno do produto.
  parts.push(
    `<rect x="0.3" y="0.3" width="${(productWidthMm - 0.6).toFixed(2)}" height="${(productHeightMm - 0.6).toFixed(2)}" ` +
      `fill="none" stroke="${COLORS.productOutline}" stroke-width="0.3" rx="0.5"/>`
  );

  // Objetos do canvas — converte px→mm e renderiza por tipo.
  for (const obj of canvasJson.objects ?? []) {
    const objRec = obj as unknown as Record<string, unknown>;
    const objType = String(objRec.type ?? '');
    const left = Number(objRec.left ?? 0) / MM_TO_PX;
    const top = Number(objRec.top ?? 0) / MM_TO_PX;

    if (objRec.capiSlot) {
      const slot = objRec.capiSlot as SlotMeta;
      const w = slot.maxWidth ?? Number(objRec.width ?? 0) / MM_TO_PX;
      const h = slot.maxHeight ?? Number(objRec.height ?? 0) / MM_TO_PX;
      const color = slotColor(slot.type);
      parts.push(
        `<rect x="${slot.x.toFixed(2)}" y="${slot.y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" ` +
          `fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="0.3" stroke-dasharray="0.8 0.4"/>`
      );
      continue;
    }

    if (objType === 'line') {
      const x1 = Number(objRec.x1 ?? 0) / MM_TO_PX;
      const y1 = Number(objRec.y1 ?? 0) / MM_TO_PX;
      const x2 = Number(objRec.x2 ?? 0) / MM_TO_PX;
      const y2 = Number(objRec.y2 ?? 0) / MM_TO_PX;
      parts.push(
        `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ` +
          `stroke="${COLORS.decor}" stroke-width="0.3"/>`
      );
      continue;
    }

    if (objType === 'rect') {
      const w = Number(objRec.width ?? 0) / MM_TO_PX;
      const h = Number(objRec.height ?? 0) / MM_TO_PX;
      parts.push(
        `<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" ` +
          `fill="none" stroke="${COLORS.decor}" stroke-width="0.3"/>`
      );
      continue;
    }
    // Tipos não conhecidos (path, group, image) — schematic pula. Operador
    // ainda vê o contorno + slots, que é o essencial pra reconhecer o layout.
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidthPx}" height="${outHeightPx}" ` +
    `viewBox="0 0 ${productWidthMm} ${productHeightMm}">` +
    parts.join('') +
    `</svg>`
  );
}
