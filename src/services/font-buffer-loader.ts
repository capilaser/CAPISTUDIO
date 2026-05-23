/**
 * font-buffer-loader.ts — Carrega ArrayBuffer de fontes em runtime Tauri
 * para o svg/dxf-exporter vetorizar textos via opentype.js.
 *
 * Por que existe (bug-fix Onda 36+):
 *   Pré-fix, ExportSvgDialog não passava `fontBufferLoader` para os exporters.
 *   Sem loader, svg-exporter caía no "Fase 9D legacy" e emitia
 *   `<!-- Texto pendente -->`. Arquivo de produção saía sem nomes/profissões.
 *
 * Estratégia (espelha FontLoader.tsx):
 *   1. Lista fontes via fontRepository (tabela `fonts`, coluna `file`).
 *   2. Cache `fontFamily → ArrayBuffer` em memória (uma vez por sessão).
 *   3. Lookup por family: `resolveResource(f.file)` → `convertFileSrc(absPath)`
 *      → `fetch(url).arrayBuffer()`.
 *   4. Retorna null se a família não existe no banco — svg-text-converter
 *      trata como `font-not-found` e o caller (export) decide bloquear/avisar.
 *
 * Side-effect awareness: o loader pré-carrega a lista uma vez. Se o usuário
 * cadastrar uma fonte nova durante a sessão, o loader continua usando o
 * snapshot da primeira chamada. Isso é aceitável — fontes raramente mudam
 * mid-session e o caller pode forçar reload via `resetFontBufferLoaderCache`.
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

import type { FontBufferLoader } from '@/core/export/svg-text-converter';
import { getAllFonts, type Font } from '@/data/repositories/fontRepository';

/** Cache global: family → ArrayBuffer já baixado. Vive na sessão. */
const bufferCache = new Map<string, ArrayBuffer>();
/** Snapshot da lista de fontes da primeira chamada — evita refetch SQL. */
let fontListCache: Font[] | null = null;

/**
 * Limpa caches. Útil quando a lista de fontes muda (raro) ou em testes que
 * precisam reset entre runs.
 */
export function resetFontBufferLoaderCache(): void {
  bufferCache.clear();
  fontListCache = null;
}

/**
 * Constrói o `FontBufferLoader` injetado nos exporters. Cada chamada retorna
 * a MESMA instância de loader, pra cache compartilhado entre múltiplos
 * exports na sessão.
 */
export function makeFontBufferLoader(): FontBufferLoader {
  return async (fontFamily: string): Promise<ArrayBuffer | null> => {
    // Cache hit por family — atalho mais barato.
    const cached = bufferCache.get(fontFamily);
    if (cached) return cached;

    // Carrega lista de fontes uma vez por sessão.
    if (!fontListCache) {
      try {
        fontListCache = await getAllFonts();
      } catch (err) {
        console.error(`[font-buffer-loader] getAllFonts falhou: ${String(err)}`);
        return null;
      }
    }

    // Match por family. `Font.family` é o nome CSS (ex: "Montserrat").
    const font = fontListCache.find((f) => f.family === fontFamily);
    if (!font || !font.file) return null;

    try {
      const absPath = await resolveResource(font.file);
      const url = convertFileSrc(absPath);
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(
          `[font-buffer-loader] fetch falhou pra "${fontFamily}" (HTTP ${response.status})`
        );
        return null;
      }
      const buffer = await response.arrayBuffer();
      bufferCache.set(fontFamily, buffer);
      return buffer;
    } catch (err) {
      console.error(
        `[font-buffer-loader] erro ao ler fonte "${fontFamily}" (file="${font.file}"): ${String(err)}`
      );
      return null;
    }
  };
}
