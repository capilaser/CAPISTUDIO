import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { seedDatabase } from '@/data/seeds';
import { Toaster } from '@/ui/components/sonner';

import { RouterContent } from './router';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    seedDatabase()
      .then(() => setDbReady(true))
      .catch((e: unknown) => setDbError(String(e)));
  }, []);

  if (dbError) {
    return (
      <main className="flex h-full min-h-screen items-center justify-center bg-ink-950 px-6 font-mono text-sm text-danger">
        Erro ao iniciar banco: {dbError}
      </main>
    );
  }

  if (!dbReady) {
    return (
      <main className="flex h-full min-h-screen items-center justify-center bg-ink-950 font-mono text-sm text-ink-400">
        inicializando…
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Toaster />
      <RouterContent />
    </BrowserRouter>
  );
}
