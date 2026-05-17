import { Keyboard } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useTauriVersion } from '@/hooks/useTauriVersion';
import { useCheatsheet } from '@/ui/components/cheatsheet-provider';

export function AppFooter() {
  const { version, reachable } = useTauriVersion();
  const { open: openCheatsheet } = useCheatsheet();

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-ink-800 bg-ink-900/80 px-4 font-mono text-[11px] text-ink-400">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${reachable ? 'bg-ok' : 'bg-warn'}`}
          />
          tauri:{version ?? 'detecting…'}
        </span>
        <span>onda:5</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openCheatsheet}
          title="Atalhos de teclado (?)"
          className="flex items-center gap-1 text-ink-500 transition-colors hover:text-ink-200"
        >
          <Keyboard className="h-3 w-3" />
          atalhos
        </button>

        {import.meta.env.DEV && (
          <>
            <Link to="/dev/db-check" className="text-ink-600 transition-colors hover:text-ink-300">
              db-check →
            </Link>
            <Link
              to="/dev/canvas-test"
              className="text-ink-600 transition-colors hover:text-ink-300"
            >
              canvas-test →
            </Link>
            <Link
              to="/dev/materials-test"
              className="text-ink-600 transition-colors hover:text-ink-300"
            >
              materials-test →
            </Link>
          </>
        )}
      </div>
    </footer>
  );
}
