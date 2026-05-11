/**
 * tauri-io.ts — Adapter real do TauriIO (Onda 9.F).
 *
 * Compõe os 3 plugins (fs/shell/path) numa interface única usada pelo
 * png-export-service. Em testes, o service recebe mock; em runtime, a UI
 * passa `makeTauriIO()`.
 *
 * Mantido em arquivo separado pra não importar `@tauri-apps/plugin-*` no
 * service puro (testes em Node falham ao importar plugins Tauri).
 */
import { writeFile } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { documentDir, join } from '@tauri-apps/api/path';

import type { TauriIO } from './png-export-service';

export function makeTauriIO(): TauriIO {
  return {
    async writeFile(path: string, bytes: Uint8Array): Promise<void> {
      await writeFile(path, bytes);
    },
    async openFolder(path: string): Promise<void> {
      // shell.open(path-de-pasta) → Windows Explorer / macOS Finder /
      // file manager Linux. Comportamento nativo da plataforma.
      await shellOpen(path);
    },
    async documentDir(): Promise<string> {
      return documentDir();
    },
    async joinPath(...segments: string[]): Promise<string> {
      return join(...segments);
    },
  };
}
