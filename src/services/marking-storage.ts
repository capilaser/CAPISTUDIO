/**
 * marking-storage.ts (Onda 9) — read-only helper para SVGs de marcações.
 *
 * Espelha `engraving-storage.ts`. Marcações ainda não têm UI de cadastro;
 * `save_marking_file` / `delete_marking_file` virão na Onda 10. Por ora
 * tudo que existe no banco é bundled em `src-tauri/resources/fixtures/markings/`.
 */
import { invoke } from '@tauri-apps/api/core';

/** Lê o conteúdo SVG de uma marcação do disco. Retorna o texto bruto. */
export async function readMarkingFile(path: string): Promise<string> {
  return invoke<string>('read_marking_file', { path });
}
