/**
 * Converts errors thrown by parseCorelSvg into user-readable PT-BR messages
 * suitable for inline display in upload dialogs.
 *
 * Detection is string-based because parseCorelSvg throws generic Error objects.
 * If the parser gains typed errors in a future wave, replace the string checks
 * with error code comparisons and update this mapping accordingly.
 *
 * Reused by: UploadApliqueDialog (Onda 6.5), future upload dialogs for
 * engravings and markings (Onda 6.6).
 */
export function humanizeError(error: unknown): string {
  const msg =
    typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);

  // Error 1: XML malformed — message starts with "SVG inválido:".
  // The technical detail in parentheses is logged to console, not shown to user.
  if (msg.startsWith('SVG inválido:')) {
    console.error('[corel-svg-parser] detalhe técnico:', msg);
    return 'Arquivo inválido — não foi possível abrir o SVG. Verifique se o arquivo não está corrompido.';
  }

  // Error 4: invalid dimension value — message from parseMmAttribute helper.
  if (msg.includes('dimensão inválida no header')) {
    return 'SVG com tamanho inválido — a dimensão declarada no arquivo é zero ou ilegível. Verifique no Corel: Layout > Page Setup, e reexporte.';
  }

  // Error 5: viewBox absent or malformed — message from parseViewBox (svg-utils.ts).
  // That function throws in English ("Invalid viewBox"), so we wrap here.
  if (msg.includes('viewBox') || msg.includes('Invalid viewBox')) {
    return 'SVG sem área de trabalho válida (viewBox ausente ou corrompido). Certifique-se que a página tem dimensões definidas (Layout > Page Setup) e reexporte.';
  }

  // Error 10: no drawable shapes — message starts with "SVG está vazio".
  // Original message conflates "text not converted" with truly empty SVG.
  if (msg.startsWith('SVG está vazio')) {
    return 'SVG sem elementos de desenho. Se houver texto no arquivo, converta em curva no Corel (Ctrl+Q) e reexporte. Se não houver texto, o arquivo pode estar vazio.';
  }

  // Errors 2, 3, 6, 7, 8, 9 — messages are already good PT-BR, pass through as-is.
  return msg;
}
