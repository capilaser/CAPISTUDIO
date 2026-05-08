import { appDataDir, join } from '@tauri-apps/api/path';
import { resolveResource } from '@tauri-apps/api/path';

/**
 * Resolves a stored filePath to an absolute filesystem path.
 *
 * Two path types are supported (ADR 010 — Onda 6a):
 *
 *   resource://fixtures/svg-bases/broche-simples.svg
 *     → resolveResource("resources/fixtures/svg-bases/broche-simples.svg")
 *     → absolute path inside the bundled resources directory
 *     → used for immutable fixture SVGs shipped with the app
 *
 *   appdata://assets/svg-bases/custom.svg
 *     → appDataDir() + "/assets/svg-bases/custom.svg"
 *     → absolute path inside the user's appData directory
 *     → used for user-uploaded SVGs (Onda 6.5+)
 *
 * @throws {Error} if the filePath prefix is unrecognised
 */
export async function resolveSvgPath(filePath: string): Promise<string> {
  if (filePath.startsWith('resource://')) {
    const relative = filePath.slice('resource://'.length);
    // resolveResource() resolves relative to the resource_dir root.
    // Bundle places files at <resource_dir>/resources/..., so we must
    // prepend "resources/" — matching the convention used in
    // materialRepository.ts (Onda 4.5).
    return resolveResource(`resources/${relative}`);
  }

  if (filePath.startsWith('appdata://')) {
    const relative = filePath.slice('appdata://'.length);
    const base = await appDataDir();
    return join(base, relative);
  }

  throw new Error(
    `[svgPathResolver] Unrecognised filePath prefix: "${filePath}". ` +
      'Expected "resource://" or "appdata://".'
  );
}
