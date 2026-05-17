/**
 * logo-storage.ts — IPC Tauri pra arquivos de logo (Onda 14).
 *
 * Espelha applique-storage.ts. Comandos:
 *   - save_logo_file (id, content) → path absoluto em appData/assets/logos/{id}.svg
 *   - read_logo_file (path) → string SVG
 */
import { invoke } from '@tauri-apps/api/core';

/** Grava SVG em appData/assets/logos/{id}.svg. Retorna o path absoluto. */
export async function saveLogoFile(id: string, content: string): Promise<string> {
  return invoke<string>('save_logo_file', { id, content });
}

/** Lê SVG de um logo do disco e retorna o conteúdo. */
export async function readLogoFile(path: string): Promise<string> {
  return invoke<string>('read_logo_file', { path });
}
