import { useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';

import { getAllFonts } from '@/data/repositories/fontRepository';

export function FontLoader() {
  useEffect(() => {
    async function load() {
      const fonts = await getAllFonts();

      for (const f of fonts) {
        if (!f.file) continue;
        const absPath = await resolveResource(f.file);
        const url = convertFileSrc(absPath);
        const weight = f.file.includes('-Variable') ? '100 900' : '400';

        const fontFace = new FontFace(f.family, `url(${url})`, { weight });

        try {
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
          if (import.meta.env.DEV) {
            console.info(`[FontLoader] ${f.family}: ✓`);
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.info(`[FontLoader] ${f.family}: ✗`, err instanceof Error ? err.message : String(err));
          }
        }
      }
    }

    load().catch((err) => console.error('[FontLoader]', err));
  }, []);

  return null;
}
