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
    return convertFileSrc(absolutePath);
  }
  return convertFileSrc(filePath);
}

/**
 * Resolves a stored filePath to an absolute OS path suitable for IPC file reads.
 *
 * Unlike resolveDisplayUrl (which produces a Tauri asset URL for <img>),
 * this returns the raw filesystem path needed by read_applique_file IPC.
 *
 *   - "resource://fixtures/..." → resolveResource → absolute path
 *   - Absolute path            → returned as-is
 */
export async function resolveAbsolutePath(filePath: string): Promise<string> {
  if (filePath.startsWith(RESOURCE_PREFIX)) {
    const resourcePath = filePath.slice(RESOURCE_PREFIX.length);
    return resolveResource('resources/' + resourcePath);
  }
  return filePath;
}
