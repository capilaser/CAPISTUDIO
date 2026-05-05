import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { seedDatabase } from '@/data/seeds';
import { Toaster } from '@/ui/components/sonner';
import DevDbCheck from '@/ui/pages/DevDbCheck';
import Home from '@/ui/pages/Home';

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
      <main className="flex h-full items-center justify-center bg-ink-950 font-mono text-sm text-danger">
        DB init error: {dbError}
      </main>
    );
  }

  if (!dbReady) {
    return (
      <main className="flex h-full items-center justify-center bg-ink-950 font-mono text-sm text-ink-400">
        initializing…
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/" element={<Home />} />
        {import.meta.env.DEV && <Route path="/dev/db-check" element={<DevDbCheck />} />}
      </Routes>
    </BrowserRouter>
  );
}
