/**
 * font-precheck.ts — bug-fix Onda 36+ (rodada 2).
 *
 * Pre-validação BLOQUEANTE de fontes antes do export gravar arquivos. Critério
 * operacional definido por Gabriell: "Não aceitar mais export com `Texto
 * pendente`". Roda DEPOIS do withSlotContentExportable promover content e
 * ANTES de chamar svg/dxf-exporter — se houver fontes que falham em
 * vetorizar, retorna lista de issues; caller (ExportSvgDialog) abre dialog
 * bloqueante e só grava se operador confirmar "Exportar mesmo assim".
 *
 * Estratégia: itera todos os fabric.Text do canvas (incluindo content de
 * slot já promovido por excludeFromExport=false), chama o loader real, e
 * tenta parsear via opentype.js. Usa o MESMO caminho que o svg-exporter
 * usaria depois — cache de fonts é compartilhado (svg-text-converter
 * cacheia por family), então o pre-check NÃO duplica custo.
 */
import type * as fabric from 'fabric';

import { type FontBufferLoader, type TextConversionError, loadFont } from './svg-text-converter';

/** Issue por texto que não vai conseguir vetorizar. */
export interface FontPrecheckIssue {
  /** Texto que vai cair como placeholder XML se export prosseguir. */
  text: string;
  /** Família CSS reportada pelo fabric.Text. */
  fontFamily: string;
  /** Erro estruturado do svg-text-converter (font-not-found / font-unsupported / parse-error). */
  error: TextConversionError;
}

export interface FontPrecheckResult {
  /** Issues — uma por texto que falhou. Vazio = export limpo. */
  issues: FontPrecheckIssue[];
  /** Familias únicas que falharam (pra mensagem do dialog). */
  failingFamilies: string[];
  /** Quantos textos serão exportados com sucesso. Pra contexto na UI. */
  okTextCount: number;
}

/**
 * Verifica se cada texto exportável do canvas pode ser vetorizado. NÃO
 * grava nada — só checa.
 *
 * @param canvas        engine.canvas — varremos `getObjects()` filtrando
 *                      `excludeFromExport=true` (consistente com svg/dxf-exporter).
 * @param fontBufferLoader  mesma instância usada no export. Cache é
 *                      compartilhado, então loadFont() aqui pre-aquece pro
 *                      svg-exporter.
 */
export async function precheckFonts(
  canvas: fabric.Canvas,
  fontBufferLoader: FontBufferLoader
): Promise<FontPrecheckResult> {
  const issues: FontPrecheckIssue[] = [];
  let okTextCount = 0;

  for (const obj of canvas.getObjects()) {
    if (obj.excludeFromExport) continue;

    const type = obj.type;
    if (type !== 'text' && type !== 'i-text' && type !== 'textbox') continue;

    const text = (obj as unknown as { text?: string }).text ?? '';
    if (text.length === 0) continue; // texto vazio não vai pro export

    const fontFamily = (obj as unknown as { fontFamily?: string }).fontFamily ?? 'Montserrat';

    try {
      await loadFont(fontFamily, fontBufferLoader);
      okTextCount++;
    } catch (err) {
      // loadFont só lança TextConversionError; outros erros são bugs.
      if (isTextConversionError(err)) {
        issues.push({ text, fontFamily, error: err });
      } else {
        throw err;
      }
    }
  }

  const failingFamilies = Array.from(new Set(issues.map((i) => i.fontFamily)));
  return { issues, failingFamilies, okTextCount };
}

function isTextConversionError(err: unknown): err is TextConversionError {
  return (
    err instanceof Error &&
    err.name === 'TextConversionError' &&
    typeof (err as { kind?: unknown }).kind === 'string'
  );
}
