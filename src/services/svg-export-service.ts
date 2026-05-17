/**
 * svg-export-service.ts — Orquestra export SVG da prancha (Onda 13.6).
 *
 * Junta:
 *   - core/export/board-exporter (Fase D) pra gerar Map<machineId, svgString>
 *   - Tauri fs (escrever 1 arquivo por máquina)
 *   - Tauri shell (abrir Explorer)
 *   - settingsRepository (persistir última pasta usada — chave separada do PNG)
 *
 * O materializar canvas offscreen pra cada item NÃO está aqui — fica na UI
 * (dialog), que tem contexto pra resolver produto/material/asset. Este
 * service só pega o resultado pronto do board-exporter e salva.
 */
import { getSetting, setSetting } from '@/data/repositories/settingsRepository';

import type { TauriIO } from './png-export-service';

/** Key do settings onde persistimos a última pasta de export SVG usada. */
export const SVG_EXPORT_LAST_FOLDER_KEY = 'export.svg.lastFolder';

/**
 * Retorna a pasta default pra exportação SVG:
 *   1. settings `export.svg.lastFolder` se existir
 *   2. caso contrário, `documentDir()` do Tauri
 */
export async function getDefaultSvgFolder(io: TauriIO): Promise<string> {
  const fromSettings = await getSetting(SVG_EXPORT_LAST_FOLDER_KEY);
  if (fromSettings && fromSettings.length > 0) return fromSettings;
  return io.documentDir();
}

export interface SaveSvgsOptions {
  /** Map<machineId, svgString> retornado por exportBoardSvg. */
  byMachine: Map<string, string>;
  /** Pasta de destino (absoluto). */
  folder: string;
  /**
   * Prefixo do nome do arquivo. Convenção: `${stem}_${machineId}.svg`.
   * Ex: stem="joao-silva", machineId="fiber-laser" → "joao-silva_fiber-laser.svg".
   */
  filenameStem: string;
  /** Se true, abre Explorer na pasta após salvar. Default true. */
  openFolderAfter?: boolean;
  /** Se true, persiste `folder` em settings. Default true. */
  rememberFolder?: boolean;
}

export interface SaveSvgsResult {
  /** Paths absolutos dos arquivos salvos, na ordem dos machineIds do Map. */
  paths: string[];
}

/**
 * Salva 1 SVG por máquina no path escolhido. Erros de IO no primeiro arquivo
 * abortam o resto (chamadas atômicas — não deixa o operador com pasta
 * meio-cheia que pode confundir).
 */
export async function saveSvgs(io: TauriIO, opts: SaveSvgsOptions): Promise<SaveSvgsResult> {
  const { byMachine, folder, filenameStem, openFolderAfter = true, rememberFolder = true } = opts;

  const paths: string[] = [];
  const encoder = new TextEncoder();

  for (const [machineId, svgString] of byMachine) {
    const filename = `${filenameStem}_${machineId}.svg`;
    const path = await io.joinPath(folder, filename);
    await io.writeFile(path, encoder.encode(svgString));
    paths.push(path);
  }

  if (rememberFolder) {
    await setSetting(SVG_EXPORT_LAST_FOLDER_KEY, folder);
  }
  if (openFolderAfter && paths.length > 0) {
    try {
      await io.openFolder(folder);
    } catch (err) {
      console.warn(`[svg-export-service] openFolder falhou (não-fatal): ${String(err)}`);
    }
  }

  return { paths };
}
