/**
 * dxf-export-service.ts — Orquestra export DXF da prancha (Onda 18).
 *
 * Espelha svg-export-service:
 *   - Pasta default vem de settings (`export.dxf.lastFolder`)
 *   - 1 arquivo por bucket (machineId+operation) — decisão Gabriell
 *   - Naming: `${stem}_${machineId}_${operation}.dxf`
 *   - Abre Explorer na pasta após salvar (configurável)
 *
 * O motor de export (exportDxfByMachineAndOperation) é chamado pela UI,
 * que tem contexto pra resolver asset lookup / font loader. Este service
 * só recebe o Map<bucketKey, dxfString> pronto e salva.
 */
import { getSetting, setSetting } from '@/data/repositories/settingsRepository';
import { parseDxfBucketKey, type DxfBucketKey } from '@/core/export/dxf-exporter';

import type { TauriIO } from './png-export-service';

/** Key do settings onde persistimos a última pasta de export DXF usada. */
export const DXF_EXPORT_LAST_FOLDER_KEY = 'export.dxf.lastFolder';

/**
 * Pasta default pra exportação DXF:
 *   1. settings `export.dxf.lastFolder` se existir
 *   2. caso contrário, `documentDir()` do Tauri
 */
export async function getDefaultDxfFolder(io: TauriIO): Promise<string> {
  const fromSettings = await getSetting(DXF_EXPORT_LAST_FOLDER_KEY);
  if (fromSettings && fromSettings.length > 0) return fromSettings;
  return io.documentDir();
}

export interface SaveDxfsOptions {
  /** Map<bucketKey, dxfString> retornado por exportDxfByMachineAndOperation. */
  byBucket: Map<DxfBucketKey, string>;
  /** Pasta de destino (absoluto). */
  folder: string;
  /**
   * Prefixo do nome do arquivo. Convenção:
   *   `${stem}_${machineId}_${operation}.dxf`.
   */
  filenameStem: string;
  /** Se true, abre Explorer na pasta após salvar. Default true. */
  openFolderAfter?: boolean;
  /** Se true, persiste `folder` em settings. Default true. */
  rememberFolder?: boolean;
}

export interface SaveDxfsResult {
  /** Paths absolutos dos arquivos salvos, na ordem do Map. */
  paths: string[];
}

/**
 * Salva 1 DXF por bucket (machineId+operation) na pasta escolhida. Erros
 * de IO no primeiro arquivo abortam o resto — mesma postura "tudo ou nada"
 * do svg-export-service pra não deixar operador com pasta meio-cheia.
 */
export async function saveDxfs(io: TauriIO, opts: SaveDxfsOptions): Promise<SaveDxfsResult> {
  const { byBucket, folder, filenameStem, openFolderAfter = true, rememberFolder = true } = opts;

  const paths: string[] = [];
  const encoder = new TextEncoder();

  for (const [bucketKey, dxfString] of byBucket) {
    const { machineId, operation } = parseDxfBucketKey(bucketKey);
    const filename = `${filenameStem}_${machineId}_${operation}.dxf`;
    const path = await io.joinPath(folder, filename);
    await io.writeFile(path, encoder.encode(dxfString));
    paths.push(path);
  }

  if (rememberFolder) {
    await setSetting(DXF_EXPORT_LAST_FOLDER_KEY, folder);
  }
  if (openFolderAfter && paths.length > 0) {
    try {
      await io.openFolder(folder);
    } catch (err) {
      console.warn(`[dxf-export-service] openFolder falhou (não-fatal): ${String(err)}`);
    }
  }

  return { paths };
}
