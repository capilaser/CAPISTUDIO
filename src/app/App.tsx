import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

export default function App() {
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [tauriReachable, setTauriReachable] = useState(false);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((v) => {
        if (active) {
          setAppVersion(v);
          setTauriReachable(true);
        }
      })
      .catch(() => {
        if (active) setTauriReachable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="relative flex h-full flex-col items-center justify-center bg-ink-950 text-ink-100">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="flex items-baseline gap-3 font-display">
          <span className="text-5xl font-medium tracking-tight">CAPI STUDIO</span>
          <span className="text-laser-muted text-xl tabular-nums">v2</span>
        </div>
        <p className="font-body text-sm text-ink-400 max-w-md">
          Production system for laser engraving and cutting.
        </p>
      </div>

      <footer className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-ink-700 bg-ink-900/80 px-4 py-2 font-mono text-[11px] text-ink-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                tauriReachable ? 'bg-ok' : 'bg-warn'
              }`}
            />
            tauri:{appVersion ?? 'detecting…'}
          </span>
          <span>theme:dark</span>
          <span>onda:0</span>
        </div>
        <span className="text-ink-500">bootstrap ok</span>
      </footer>
    </main>
  );
}
