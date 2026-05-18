/**
 * pattern-thumbnail.ts — Onda 14 (Onda 26 redesign: thumbnail "fotorrealista")
 *
 * Gera SVG inline pra preview de patterns na galeria. Visualiza o padrão de
 * forma próxima ao broche real: fundo metálico (dourado por padrão), textos
 * fictícios renderizados nos slots, bordas e traços decorativos. Sem render
 * em canvas offscreen — escala perfeito, render instantâneo, sem IO.
 *
 * Convenções de coordenadas:
 *   - canvasJson armazena Fabric objects em px (mm × 4).
 *   - O SVG produzido tem viewBox em mm pra escala intuitiva.
 *   - outWidthPx controla o tamanho renderizado final via atributo `width`.
 */
import type { FabricCanvasJson } from '@/data/schema';

const MM_TO_PX = 4;
const PT_TO_MM = 0.3528;

/** Textos fictícios renderizados nos slots conforme o tipo. */
const DEMO_TEXT: Record<'nome' | 'profissao' | 'custom', string> = {
  nome: 'João Silva',
  profissao: 'Advogado',
  custom: 'Texto',
};

/** Família de cores do material padrão (dourado ABS). */
const MATERIAL_COLORS = {
  base: '#c9a961',
  highlight: '#e8d488',
  shadow: '#8a7340',
  rim: '#7a6435',
} as const;

const COLORS = {
  decor: '#1a1a1a',
  textNome: '#1a1a1a',
  textProfissao: '#2a2a2a',
  textCustom: '#2a2a2a',
  logoPlaceholder: '#8a7340',
} as const;

interface SlotMeta {
  type: 'logo' | 'nome' | 'profissao' | 'custom';
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
}

interface ThumbnailOptions {
  /** Largura do produto em mm. Default 60 (broche). */
  productWidthMm?: number;
  /** Altura do produto em mm. Default 25 (broche). */
  productHeightMm?: number;
  /** Largura final do SVG em px. Resto escala proporcional. Default 120. */
  outWidthPx?: number;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renderiza um SVG (string) "fotorrealista" do pattern: fundo metálico,
 * decorativos (bordas/traços) em cor de gravação, textos fictícios nos
 * slots. Aproximação visual do broche pronto, sem canvas offscreen.
 */
export function renderPatternThumbnailSvg(
  canvasJson: FabricCanvasJson,
  options: ThumbnailOptions = {}
): string {
  const { productWidthMm = 60, productHeightMm = 25, outWidthPx = 120 } = options;
  const aspect = productHeightMm / productWidthMm;
  const outHeightPx = Math.round(outWidthPx * aspect);

  const defs: string[] = [];
  const parts: string[] = [];

  // ── Fundo metálico (gradient dourado) ──────────────────────────────────
  // linearGradient simula a reflexão escovada do ABS dourado. ID com sufixo
  // único previne colisão se múltiplos thumbnails ficarem no mesmo DOM.
  const gradientId = `metalGrad-${Math.random().toString(36).slice(2, 8)}`;
  defs.push(
    `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">` +
      `<stop offset="0%" stop-color="${MATERIAL_COLORS.highlight}"/>` +
      `<stop offset="45%" stop-color="${MATERIAL_COLORS.base}"/>` +
      `<stop offset="100%" stop-color="${MATERIAL_COLORS.shadow}"/>` +
      `</linearGradient>`
  );

  parts.push(
    `<rect x="0" y="0" width="${productWidthMm}" height="${productHeightMm}" ` +
      `fill="url(#${gradientId})" rx="0.8"/>`
  );

  // Borda externa sutil (rim) — dá sensação de espessura/aplique físico.
  parts.push(
    `<rect x="0.15" y="0.15" width="${(productWidthMm - 0.3).toFixed(2)}" height="${(productHeightMm - 0.3).toFixed(2)}" ` +
      `fill="none" stroke="${MATERIAL_COLORS.rim}" stroke-width="0.15" rx="0.7"/>`
  );

  // ── Objetos do canvas — decorativos + slots ────────────────────────────
  for (const obj of canvasJson.objects ?? []) {
    const objRec = obj as unknown as Record<string, unknown>;
    const objType = String(objRec.type ?? '');
    const left = Number(objRec.left ?? 0) / MM_TO_PX;
    const top = Number(objRec.top ?? 0) / MM_TO_PX;

    if (objRec.capiSlot) {
      const slot = objRec.capiSlot as SlotMeta;
      const w = slot.maxWidth ?? Number(objRec.width ?? 0) / MM_TO_PX;
      const h = slot.maxHeight ?? Number(objRec.height ?? 0) / MM_TO_PX;
      parts.push(renderSlotContent(slot, w, h));
      continue;
    }

    if (objType === 'line') {
      const x1 = Number(objRec.x1 ?? 0) / MM_TO_PX;
      const y1 = Number(objRec.y1 ?? 0) / MM_TO_PX;
      const x2 = Number(objRec.x2 ?? 0) / MM_TO_PX;
      const y2 = Number(objRec.y2 ?? 0) / MM_TO_PX;
      parts.push(
        `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" ` +
          `stroke="${COLORS.decor}" stroke-width="0.25" stroke-linecap="round"/>`
      );
      continue;
    }

    if (objType === 'rect') {
      const w = Number(objRec.width ?? 0) / MM_TO_PX;
      const h = Number(objRec.height ?? 0) / MM_TO_PX;
      parts.push(
        `<rect x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" ` +
          `fill="none" stroke="${COLORS.decor}" stroke-width="0.25"/>`
      );
      continue;
    }
    // Tipos não conhecidos (path, group, image) — pulam. Fundo + slots +
    // decorativos básicos já dão a leitura do layout.
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidthPx}" height="${outHeightPx}" ` +
    `viewBox="0 0 ${productWidthMm} ${productHeightMm}">` +
    `<defs>${defs.join('')}</defs>` +
    parts.join('') +
    `</svg>`
  );
}

/**
 * Renderiza o conteúdo de um slot conforme seu tipo:
 *   - nome/profissao/custom: <text> centralizado com nome fictício
 *   - logo: silhueta simples (círculo + iniciais) na cor metálica escura
 *
 * Tamanho da fonte aproxima o fitText: usa 70% da altura do slot como
 * tamanho-alvo em pt, clampado em [4, 18]pt — suficiente pra leitura no
 * thumbnail sem precisar simular fitText pra valer.
 */
function renderSlotContent(slot: SlotMeta, w: number, h: number): string {
  if (slot.type === 'logo') {
    const cx = slot.x + w / 2;
    const cy = slot.y + h / 2;
    const r = Math.min(w, h) * 0.35;
    return (
      `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" ` +
      `fill="none" stroke="${COLORS.logoPlaceholder}" stroke-width="0.2" stroke-dasharray="0.4 0.3"/>`
    );
  }

  const demoText =
    slot.type === 'nome'
      ? DEMO_TEXT.nome
      : slot.type === 'profissao'
        ? DEMO_TEXT.profissao
        : DEMO_TEXT.custom;

  // Tamanho aproximado da fonte. 70% da altura do slot em mm → pt.
  // Clamp [4, 18]pt mantém legível em thumbnails pequenos e não explode em slots grandes.
  const targetPt = Math.max(4, Math.min(18, (h * 0.7) / PT_TO_MM));
  const targetMm = targetPt * PT_TO_MM;

  const cx = slot.x + w / 2;
  const cy = slot.y + h / 2;

  // dominant-baseline=central centraliza vertical sem precisar calcular ascender/descender.
  const fill =
    slot.type === 'nome'
      ? COLORS.textNome
      : slot.type === 'profissao'
        ? COLORS.textProfissao
        : COLORS.textCustom;
  const fontWeight = slot.type === 'nome' ? '600' : '400';

  return (
    `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" ` +
    `font-family="Geist, system-ui, sans-serif" font-size="${targetMm.toFixed(2)}" ` +
    `font-weight="${fontWeight}" fill="${fill}" ` +
    `text-anchor="middle" dominant-baseline="central">${escapeXml(demoText)}</text>`
  );
}
