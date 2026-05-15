import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import CanvasTest from '@/ui/pages/dev/CanvasTest';
import MaterialsTestPage from '@/ui/pages/dev/MaterialsTestPage';
import BancoApliquesPagina from '@/ui/pages/banco-apliques/BancoApliquesPagina';
import DevDbCheck from '@/ui/pages/DevDbCheck';

// Onda 12 — 3 páginas oficiais do app.
import InicialPage from '@/ui/pages/inicial/InicialPage';
import ArteHubPage from '@/ui/pages/arte/ArteHubPage';
import NovoPedidoPage from '@/ui/pages/arte/NovoPedidoPage';
import BancoPage from '@/ui/pages/banco/BancoPage';

function useEscapeToHome() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (location.pathname === '/') return;

      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target.isContentEditable) return;
      if (target.closest('[role="dialog"]')) return;

      navigate('/');
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [navigate, location.pathname]);
}

export function RouterContent() {
  useEscapeToHome();

  return (
    <Routes>
      {/* Onda 12 — 3 páginas oficiais */}
      <Route path="/" element={<InicialPage />} />
      <Route path="/arte" element={<ArteHubPage />} />
      <Route path="/arte/novo" element={<NovoPedidoPage />} />
      <Route path="/banco" element={<BancoPage />} />

      {/* Rotas legadas mantidas até serem absorvidas/removidas:
       *   /banco/apliques → vai migrar pra aba dentro de /banco (Fase 10)
       *
       * Rotas DEV ocultas (sem link na nav, só pra debug em desenvolvimento):
       *   /dev/db-check        — inspeciona banco SQLite
       *   /dev/canvas-test     — sandbox do canvas
       *   /dev/materials-test  — teste de materiais
       */}
      <Route path="/banco/apliques" element={<BancoApliquesPagina />} />
      {import.meta.env.DEV && <Route path="/dev/db-check" element={<DevDbCheck />} />}
      {import.meta.env.DEV && <Route path="/dev/canvas-test" element={<CanvasTest />} />}
      {import.meta.env.DEV && <Route path="/dev/materials-test" element={<MaterialsTestPage />} />}
    </Routes>
  );
}
