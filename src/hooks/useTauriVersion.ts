import { getVersion } from '@tauri-apps/api/app';
import { useEffect, useState } from 'react';

export function useTauriVersion() {
  const [version, setVersion] = useState<string | null>(null);
  const [reachable, setReachable] = useState(false);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((v) => {
        if (active) {
          setVersion(v);
          setReachable(true);
        }
      })
      .catch(() => {
        if (active) setReachable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { version, reachable };
}
