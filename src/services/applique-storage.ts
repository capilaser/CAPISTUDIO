import { invoke } from '@tauri-apps/api/core';

/** Writes SVG content to appData/assets/appliques/{id}.svg. Returns the absolute path. */
export async function saveAppliqueFile(id: string, content: string): Promise<string> {
  return invoke<string>('save_applique_file', { id, content });
}

/** Deletes an applique SVG file from disk. No-op if file does not exist. */
export async function deleteAppliqueFile(path: string): Promise<void> {
  return invoke('delete_applique_file', { path });
}

/** Reads an applique SVG file from disk and returns its content as a string. */
export async function readAppliqueFile(path: string): Promise<string> {
  return invoke<string>('read_applique_file', { path });
}
