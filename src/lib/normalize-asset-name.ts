/**
 * Normaliza nome de arquivo de asset para o padrão do projeto:
 * kebab-case + lowercase + sem acentos + sem caracteres especiais.
 *
 * Usado pela UI de cadastro (Onda 10) ao copiar arquivos de upload
 * pra `appData`. Nesta Onda 8.5 a função é criada e testada mas NÃO
 * usada em runtime (assets são bundled em src-tauri/resources/ e
 * renomeados manualmente na cópia inicial — ver IDEA
 * onda-10-ui-cadastro-bancos.md).
 *
 * Regras:
 *   - Desacenta (NFD + strip combining marks)
 *   - Lowercase
 *   - Trim
 *   - Espaços (1+) viram hífen
 *   - Caracteres que não são [a-z0-9.-] são removidos
 *   - Extensão preservada e em lowercase
 *
 * Exemplos:
 *   "BALANÇA ADVOGADO.svg"     → "balanca-advogado.svg"
 *   "Médico  Dentista.svg"     → "medico-dentista.svg"
 *   "Dr@ ANA & cia.svg"        → "dr-ana-cia.svg"
 *   "Foo.SVG"                  → "foo.svg"
 */
export function normalizeAssetName(raw: string): string {
  const trimmed = raw.trim();
  // Separa nome da extensão pra normalizar cada parte independentemente.
  // Última ocorrência de '.' marca a extensão (se houver).
  const lastDot = trimmed.lastIndexOf('.');
  const hasExt = lastDot > 0; // > 0 (não >=0) — evita ".hidden" virar só extensão
  const base = hasExt ? trimmed.slice(0, lastDot) : trimmed;
  const ext = hasExt ? trimmed.slice(lastDot) : '';

  const normalizeSegment = (s: string): string =>
    s
      // Desacenta: NFD separa base+combining, strip remove os marks
      // (Unicode block "Combining Diacritical Marks" U+0300..U+036F).
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Espaços (1+) → hífen único.
      .replace(/\s+/g, '-')
      // Remove qualquer coisa fora de [a-z0-9.-]. Mantém ponto e hífen.
      .replace(/[^a-z0-9.-]/g, '')
      // Hífens duplicados (ex: "A & B" → "a--b") colapsam.
      .replace(/-+/g, '-')
      // Remove hífens no começo/fim.
      .replace(/^-+|-+$/g, '');

  return `${normalizeSegment(base)}${normalizeSegment(ext)}`;
}
