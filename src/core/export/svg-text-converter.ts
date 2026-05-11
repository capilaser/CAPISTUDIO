/**
 * svg-text-converter.ts — Conversão de fabric.Text → <path> SVG (Onda 9, Fase 9D-bis).
 *
 * Por que existe:
 *   A Fase 9D deixou textos como comentário XML placeholder no SVG de produção.
 *   Software de laser não renderiza fontes — precisa de paths (curvas). Esta
 *   fase usa opentype.js pra vetorizar o texto na fonte correta, preservando
 *   posição/escala/rotação do fabric.Text original.
 *
 * Estratégia de carga (injection):
 *   - O converter NÃO acessa Tauri APIs diretamente. Recebe um
 *     `FontBufferLoader` injetado que devolve ArrayBuffer pra uma `fontFamily`.
 *   - Em runtime, a UI (Fase 9F) compõe com `convertFileSrc + fetch` lendo
 *     `fonts.file` do banco. Em testes, lê do disco direto.
 *   - Cache parsed fonts (+ resultados de erro) por fontFamily — opentype.parse
 *     é pesado e idempotente.
 *
 * Variable fonts:
 *   Probe revelou que Roboto Slab Variable falha no opentype.js com
 *   "substitutionType: 62 lookupType: 6 - substFormat: 2 is not yet supported"
 *   (limitação conhecida — algumas tabelas GSUB recentes não são suportadas).
 *   As outras 4 fontes bundled funcionam: Bebas Neue (estática), Montserrat,
 *   Caveat, Playfair Display (variable). Sem instalar fontkit (dep extra
 *   grande): detectamos a falha no primeiro getPath() e cacheamos um erro
 *   estruturado. O svg-exporter cai pro placeholder XML, e a UI mostra toast
 *   pedindo vetorização manual (decisão #1 — Gabriell).
 *
 * Erros estruturados:
 *   TextConversionError contém `kind` discriminado pro caller saber se é:
 *     - 'font-not-found' (loader retornou null — fonte não está no banco)
 *     - 'font-unsupported' (opentype falhou no parse ou getPath)
 *     - 'parse-error' (ArrayBuffer corrompido)
 */
import opentype from 'opentype.js';

export type TextConversionErrorKind = 'font-not-found' | 'font-unsupported' | 'parse-error';

export class TextConversionError extends Error {
  readonly kind: TextConversionErrorKind;
  readonly fontFamily: string;
  constructor(kind: TextConversionErrorKind, fontFamily: string, message: string) {
    super(message);
    this.kind = kind;
    this.fontFamily = fontFamily;
    this.name = 'TextConversionError';
  }
}

/**
 * Função injetada que devolve os bytes brutos de uma fonte. Retorna null
 * quando a fonte não existe no banco. Lança apenas em falha de I/O genuína —
 * "fonte ausente" é estado normal, não erro.
 */
export type FontBufferLoader = (fontFamily: string) => Promise<ArrayBuffer | null>;

/** Opções pra `convertTextToSvgPath` — espelham campos do fabric.Text. */
export interface TextConversionOptions {
  /** Texto a vetorizar. Pode ter múltiplas linhas (\n). */
  text: string;
  /** Família CSS — usada pra lookup no FontBufferLoader. */
  fontFamily: string;
  /** Em px do canvas (igual fabric.Text.fontSize). */
  fontSize: number;
  /** Posição top-left do bounding box do texto, em px do canvas. */
  left: number;
  top: number;
  /** Rotação em graus (0 = sem rotação). */
  angle?: number;
  /** Escala uniforme (1 = sem escala). */
  scaleX?: number;
  scaleY?: number;
  /** Cor do fill no path (hex). Em export laser, é o stroke da operação. */
  fill: string;
}

/**
 * Cache global de fontes parseadas — chave: fontFamily. Valor é discriminado:
 * font carregada com sucesso ou erro estruturado pra evitar reprocessar.
 *
 * Exportado para os testes poderem limpar entre runs (resetFontCache).
 */
type CacheEntry = { ok: true; font: opentype.Font } | { ok: false; error: TextConversionError };
const fontCache = new Map<string, CacheEntry>();

/** Limpa cache. Usado em testes pra garantir isolamento entre `it()`. */
export function resetFontCache(): void {
  fontCache.clear();
}

/**
 * Carrega e parseia a fonte (com cache). Não chama `getPath` aqui — a
 * detecção de fontes "unsupported" precisa de uma chamada real de getPath
 * com texto válido, e isso fica em convertTextToSvgPath().
 *
 * Exportado pra testes que queiram pré-aquecer cache ou validar erros.
 */
export async function loadFont(
  fontFamily: string,
  loader: FontBufferLoader
): Promise<opentype.Font> {
  const cached = fontCache.get(fontFamily);
  if (cached) {
    if (cached.ok) return cached.font;
    throw cached.error;
  }

  let buffer: ArrayBuffer | null;
  try {
    buffer = await loader(fontFamily);
  } catch (err) {
    const error = new TextConversionError(
      'font-not-found',
      fontFamily,
      `Falha ao carregar bytes da fonte "${fontFamily}": ${String(err)}`
    );
    fontCache.set(fontFamily, { ok: false, error });
    throw error;
  }

  if (!buffer) {
    const error = new TextConversionError(
      'font-not-found',
      fontFamily,
      `Fonte "${fontFamily}" não está registrada no banco de fontes.`
    );
    fontCache.set(fontFamily, { ok: false, error });
    throw error;
  }

  let font: opentype.Font;
  try {
    font = opentype.parse(buffer);
  } catch (err) {
    const error = new TextConversionError(
      'parse-error',
      fontFamily,
      `opentype.parse falhou para "${fontFamily}": ${String(err)}`
    );
    fontCache.set(fontFamily, { ok: false, error });
    throw error;
  }

  fontCache.set(fontFamily, { ok: true, font });
  return font;
}

/**
 * Vetoriza um texto e retorna um fragmento `<g><path/></g>` SVG pronto pra
 * inserir no output do svg-exporter. Coordenadas em px do canvas (svg-exporter
 * reescala pra mm via `<g transform="scale(0.25)">` no wrapper externo).
 *
 * Posição: fabric.Text usa top-left do bounding box; opentype getPath usa
 * baseline. Calculamos o offset via `font.ascender / unitsPerEm * fontSize`.
 *
 * Linhas múltiplas: split por \n e empilha verticalmente usando
 * `lineHeight * fontSize`. Sem auto-wrap (fabric.Textbox tem outra lógica que
 * não cabe nesta fase — se aparecer no canvas, é cenário pra Onda futura).
 */
export async function convertTextToSvgPath(
  options: TextConversionOptions,
  loader: FontBufferLoader
): Promise<string> {
  const {
    text,
    fontFamily,
    fontSize,
    left,
    top,
    angle = 0,
    scaleX = 1,
    scaleY = 1,
    fill,
  } = options;

  const font = await loadFont(fontFamily, loader);

  // Baseline offset: opentype getPath posiciona y=0 na baseline; fabric mede
  // top-left. Ascender / unitsPerEm * fontSize aproxima o topo do glyph.
  const baselineOffset = (font.ascender / font.unitsPerEm) * fontSize;

  const lines = text.split('\n');
  const lineHeight = fontSize * 1.16; // fabric.Text default

  const pathDs: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0) continue;
    let path: opentype.Path;
    try {
      // x=0, y=baselineOffset (+ deslocamento da linha). O transform externo
      // posiciona o conjunto no left/top do canvas.
      path = font.getPath(line, 0, baselineOffset + i * lineHeight, fontSize);
    } catch (err) {
      const error = new TextConversionError(
        'font-unsupported',
        fontFamily,
        `opentype getPath falhou para "${fontFamily}" texto="${line}": ${String(err)}. ` +
          `Fonte provavelmente usa tabela GSUB não suportada pelo opentype.js.`
      );
      // Cacheia como unsupported pra próximas chamadas curto-circuitarem.
      fontCache.set(fontFamily, { ok: false, error });
      throw error;
    }
    pathDs.push(path.toPathData(2));
  }

  const combinedD = pathDs.join(' ');

  // Transform: translate pro left/top, depois rotate, depois scale.
  // Ordem corresponde ao layout do fabric.Text (que aplica scale e angle
  // ao redor do top-left quando originX/Y = 'left'/'top').
  const transforms: string[] = [];
  transforms.push(`translate(${left} ${top})`);
  if (angle !== 0) transforms.push(`rotate(${angle})`);
  if (scaleX !== 1 || scaleY !== 1) transforms.push(`scale(${scaleX} ${scaleY})`);
  const transformAttr = transforms.join(' ');

  return (
    `<g transform="${transformAttr}">` +
    `<path d="${combinedD}" fill="${fill}" stroke="none"/>` +
    `</g>`
  );
}

/**
 * Helper de conveniência pra svg-exporter: tenta converter, retorna `null`
 * em qualquer falha estruturada. Caller deve cair pro placeholder XML quando
 * recebe null e logar o erro pra UI exibir toast.
 *
 * Não engole erros genéricos (TypeError, programação errada) — só os
 * estruturados de TextConversionError.
 */
export async function tryConvertTextToSvgPath(
  options: TextConversionOptions,
  loader: FontBufferLoader
): Promise<{ ok: true; svg: string } | { ok: false; error: TextConversionError }> {
  try {
    const svg = await convertTextToSvgPath(options, loader);
    return { ok: true, svg };
  } catch (err) {
    if (err instanceof TextConversionError) {
      return { ok: false, error: err };
    }
    throw err;
  }
}
