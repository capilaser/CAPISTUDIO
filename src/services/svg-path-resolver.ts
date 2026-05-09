import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

const RESOURCE_PREFIX = 'resource://';

/**
 * Converts a stored filePath to a URL usable by <img> tags.
 *
 * Two formats are handled:
 *   - "resource://fixtures/..." → bundled Tauri resource → resolveResource + convertFileSrc
 *   - Absolute path            → user-uploaded file    → convertFileSrc directly
 *
 * Called at render time; results are not cached (URLs are stable across renders).
 */
export async function resolveDisplayUrl(filePath: string): Promise<string> {
  if (filePath.startsWith(RESOURCE_PREFIX)) {
    const resourcePath = filePath.slice(RESOURCE_PREFIX.length);
    const absolutePath = await resolveResource('resources/' + resourcePath);
    const assetUrl = convertFileSrc(absolutePath);
    console.debug('[svg-path-resolver]', { filePath, resourcePath, absolutePath, assetUrl });
    return assetUrl;
  }
  const assetUrl = convertFileSrc(filePath);
  console.debug('[svg-path-resolver]', { filePath, assetUrl });
  return assetUrl;
}
