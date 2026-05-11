/**
 * engraving-storage.ts (Onda 8.5) — read-only helper para SVGs de gravações.
 *
 * Diferente do `applique-storage.ts` que tem `save`/`delete`/`read`, esta
 * Onda 8.5 entrega só a leitura: gravações vivem **bundled** em
 * `src-tauri/resources/fixtures/engravings/` (resource://) e ainda não há
 * UI de cadastro que precise gravar arquivos novos no appData em runtime.
 *
 * A Onda 10 (UI de cadastro de bancos) é quem vai adicionar `save_engraving_file`
 * e `delete_engraving_file` espelhando o applique-storage — ver IDEA
 * `docs/IDEAS/onda-10-ui-cadastro-bancos.md`.
 */
import { invoke } from '@tauri-apps/api/core';

/** Lê o conteúdo SVG de uma gravação do disco. Retorna o texto bruto. */
export async function readEngravingFile(path: string): Promise<string> {
  return invoke<string>('read_engraving_file', { path });
}
