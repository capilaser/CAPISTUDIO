/**
 * Converts errors thrown by parseCorelSvg into user-readable PT-BR messages
 * suitable for toast or inline display.
 *
 * Onda 23 — retorna { title, description } pra alimentar toast.error com
 * 2 níveis de hierarquia: título curto (o que aconteceu) + descrição (como
 * resolver). Mensagens longas de uma linha só funcionam em toasts quando o
 * operador não está olhando — ele lê o título no canto da tela e ignora.
 * Quebrar em 2 níveis força ler a solução.
 *
 * Detecção continua string-based porque parseCorelSvg lança Error genérico.
 * Se o parser ganhar erros tipados numa onda futura, troque os startsWith()
 * por comparações de code e atualize este mapeamento.
 *
 * Reused by: NovoPedidoPage (upload SVG via menu), UploadApliqueDialog,
 * dev canvas-test panels (Aplique/Engraving/Marking).
 */

export interface SvgErrorMessage {
  /** Linha curta — o que aconteceu. Vai pro title do toast. */
  title: string;
  /** Linha(s) longa(s) — como resolver. Vai pro description do toast. */
  description?: string;
}

export function humanizeError(error: unknown): SvgErrorMessage {
  const raw =
    typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);

  // ── XML malformed: "SVG inválido: ..." ───────────────────────────────────
  if (raw.startsWith('SVG inválido:')) {
    // Detalhe técnico vai pro console — útil pra depurar sem incomodar o operador.
    console.error('[corel-svg-parser] detalhe técnico:', raw);
    return {
      title: 'Arquivo SVG corrompido',
      description:
        'Não consegui abrir o arquivo. Tente reexportar do Corel ou verificar se ele não está incompleto.',
    };
  }

  // ── Sem unidade ou unidade diferente de mm ───────────────────────────────
  if (raw.startsWith('SVG precisa estar em milímetros')) {
    return {
      title: 'SVG precisa estar em milímetros',
      description:
        'No Corel: Layout → Page Setup → Units: Millimeters. Depois exporte o arquivo de novo.',
    };
  }

  // ── Dimensão zerada/ilegível ─────────────────────────────────────────────
  if (raw.includes('dimensão inválida no header')) {
    return {
      title: 'Tamanho do SVG inválido',
      description:
        'A largura ou altura declarada no arquivo é zero ou ilegível. No Corel: Layout → Page Setup, ajuste as dimensões e reexporte.',
    };
  }

  // ── Aspect ratio distorcido (esticado num eixo só) ───────────────────────
  if (raw.startsWith('Esse SVG está esticado')) {
    return {
      title: 'SVG com proporção distorcida',
      description:
        'O desenho foi redimensionado num eixo só. No Corel: selecione o desenho, segure Shift e arraste pelo canto pra manter proporção. Depois reexporte.',
    };
  }

  // ── viewBox ausente/corrompido ───────────────────────────────────────────
  if (raw.includes('viewBox') || raw.includes('Invalid viewBox')) {
    return {
      title: 'SVG sem área de trabalho válida',
      description:
        'A página do Corel precisa ter dimensões definidas (Layout → Page Setup). Defina o tamanho e reexporte.',
    };
  }

  // ── Imagem rasterizada (Gate 3) ──────────────────────────────────────────
  if (raw.includes('imagem rasterizada')) {
    return {
      title: 'SVG contém imagem (não-vetor)',
      description:
        'O arquivo tem uma foto/imagem dentro. O Capi só aceita desenhos vetoriais. Remova a imagem ou vetorize antes de importar.',
    };
  }

  // ── Texto não convertido em curva (Gate 4) ───────────────────────────────
  if (raw.includes('texto não convertido em curva')) {
    return {
      title: 'Texto não convertido em curva',
      description:
        'No Corel: selecione o texto → Ctrl+Q (Converter em Curvas) → reexporte. Sem isso, o texto vira código não-suportado.',
    };
  }

  // ── <use>/<symbol> (Gate 5) ──────────────────────────────────────────────
  if (raw.includes('referências internas não suportadas')) {
    return {
      title: 'SVG com referências internas',
      description: 'No Corel: Ctrl+K pra quebrar vínculos entre objetos. Depois reexporte.',
    };
  }

  // ── SVG vazio (Gate 6: sem shape elements) ───────────────────────────────
  if (raw.startsWith('SVG está vazio')) {
    return {
      title: 'SVG sem elementos de desenho',
      description:
        'Se tem texto, converta em curva (Ctrl+Q no Corel). Se não, o arquivo realmente está vazio.',
    };
  }

  // ── Fallback: passa a mensagem original como título ──────────────────────
  // Erros não-mapeados (raros) preservam a mensagem original do parser.
  return { title: raw };
}

/**
 * Helper de compatibilidade: dispara toast.error com title + description.
 * Aceita o objeto direto do humanizeError pra não duplicar a chamada em
 * cada caller. Importar do mesmo módulo evita pulo entre arquivos.
 *
 * Uso:
 *   import { humanizeError, showSvgError } from '@/core/canvas/corel-svg-errors';
 *   try { ... } catch (err) { showSvgError(err); }
 */
export function svgErrorToToastArgs(error: unknown): {
  title: string;
  options: { description?: string };
} {
  const msg = humanizeError(error);
  return {
    title: msg.title,
    options: msg.description ? { description: msg.description } : {},
  };
}
