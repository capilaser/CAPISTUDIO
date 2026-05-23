/**
 * dxf-export-service-v2.ts — Orquestra export DXF v2 da prancha (Sub-onda DXF-4).
 *
 * Espelha `dxf-export-service.ts` (legado) mas com:
 *   - Sufixo `_v2.dxf` no filename para coexistir com legado sem colisão
 *   - Setting key separada (`export.dxf-v2.lastFolder`) — usuário pode
 *     escolher pastas diferentes para v1 e v2 durante a transição
 *   - Tipos do exporter v2 (DxfV2BucketKey, parseDxfV2BucketKey)
 *
 * O motor de export (exportDxfV2ByMachineAndOperation) é chamado pela UI,
 * que tem contexto para resolver asset lookup / font loader. Este service só
 * recebe o Map<bucketKey, dxfString> pronto e salva.
 */
import { getSetting, setSetting } from '@/data/repositories/settingsRepository';
import { parseDxfV2BucketKey, type DxfV2BucketKey } from '@/core/export/dxf-exporter-v2';

import type { TauriIO } from './png-export-service';

/** Key do settings onde persistimos a última pasta de export DXF v2 usada. */
export const DXF_V2_EXPORT_LAST_FOLDER_KEY = 'export.dxf-v2.lastFolder';

/**
 * Pasta default para exportação DXF v2:
 *   1. settings `export.dxf-v2.lastFolder` se existir
 *   2. caso contrário, `documentDir()` do Tauri
 */
export async function getDefaultDxfV2Folder(io: TauriIO): Promise<string> {
  const fromSettings = await getSetting(DXF_V2_EXPORT_LAST_FOLDER_KEY);
  if (fromSettings && fromSettings.length > 0) return fromSettings;
  return io.documentDir();
}

export interface SaveDxfsV2Options {
  /** Map<bucketKey, dxfString> retornado por exportDxfV2ByMachineAndOperation. */
  byBucket: Map<DxfV2BucketKey, string>;
  /** Pasta de destino (absoluto). */
  folder: string;
  /**
   * Prefixo do nome do arquivo. Convenção v2:
   *   `${stem}_${machineId}_${operation}_v2.dxf`.
   */
  filenameStem: string;
  /** Se true, abre Explorer na pasta após salvar. Default true. */
  openFolderAfter?: boolean;
  /** Se true, persiste `folder` em settings. Default true. */
  rememberFolder?: boolean;
}

export interface SaveDxfsV2Result {
  /** Paths absolutos dos arquivos salvos, na ordem do Map. */
  paths: string[];
}

/**
 * Salva 1 DXF v2 por bucket (machineId+operation) na pasta escolhida. Erros
 * de IO no primeiro arquivo abortam o resto — mesma postura "tudo ou nada"
 * do v1 para não deixar operador com pasta meio-cheia.
 */
export async function saveDxfsV2(io: TauriIO, opts: SaveDxfsV2Options): Promise<SaveDxfsV2Result> {
  const { byBucket, folder, filenameStem, openFolderAfter = true, rememberFolder = true } = opts;

  const paths: string[] = [];
  const encoder = new TextEncoder();

  for (const [bucketKey, dxfString] of byBucket) {
    const { machineId, operation } = parseDxfV2BucketKey(bucketKey);
    const filename = `${filenameStem}_${machineId}_${operation}_v2.dxf`;
    const path = await io.joinPath(folder, filename);
    await io.writeFile(path, encoder.encode(dxfString));
    paths.push(path);
  }

  if (rememberFolder) {
    await setSetting(DXF_V2_EXPORT_LAST_FOLDER_KEY, folder);
  }
  if (openFolderAfter && paths.length > 0) {
    try {
      await io.openFolder(folder);
    } catch (err) {
      console.warn(`[dxf-export-service-v2] openFolder falhou (não-fatal): ${String(err)}`);
    }
  }

  return { paths };
}
