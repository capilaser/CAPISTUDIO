/**
 * tauri-io.ts — Adapter para operações de filesystem do app.
 *
 * Interface mínima usada pelos services que escrevem arquivos (exports, projetos)
 * e abrem pastas no Explorer. Mantido em arquivo separado para não importar
 * `@tauri-apps/plugin-*` em código puro (testes em Node falham ao importar
 * plugins Tauri).
 *
 * Onda 4 (Exportação) e Onda 2B (Sistema de arquivos do projeto) vão consumir.
 */
import { writeFile } from '@tauri-apps/plugin-fs';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { documentDir, join } from '@tauri-apps/api/path';

export interface TauriIO {
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  openFolder(path: string): Promise<void>;
  documentDir(): Promise<string>;
  joinPath(...segments: string[]): Promise<string>;
}

export function makeTauriIO(): TauriIO {
  return {
    async writeFile(path: string, bytes: Uint8Array): Promise<void> {
      await writeFile(path, bytes);
    },
    async openFolder(path: string): Promise<void> {
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
