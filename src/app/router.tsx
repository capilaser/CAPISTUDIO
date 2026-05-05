import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import DevDbCheck from '@/ui/pages/DevDbCheck';
import Home from '@/ui/pages/Home';

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
      <Route path="/" element={<Home />} />
      {import.meta.env.DEV && <Route path="/dev/db-check" element={<DevDbCheck />} />}
    </Routes>
  );
}
