/**
 * CheatsheetProvider — registro global do cheatsheet (Onda 20.D).
 *
 * Provê:
 *   - Tecla `?` (e Shift+/) abre o dialog em qualquer rota.
 *   - useCheatsheet() retorna { open() } pra abrir programaticamente
 *     (usado pelo botão de teclado no AppFooter).
 *
 * O dialog vive aqui em vez de cada página — atalho deve funcionar no
 * /inicial, /arte/novo, /padroes, etc. Provider envolve toda a app
 * dentro do BrowserRouter (montado em App.tsx).
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { CheatsheetDialog } from './cheatsheet-dialog';

interface CheatsheetContextValue {
  open: () => void;
}

const CheatsheetContext = createContext<CheatsheetContextValue | null>(null);

export function CheatsheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // `?` (US layouts dispara questionmark direto; ABNT2 BR é shift+/).
  // react-hotkeys-hook normaliza ambas as combos. preventDefault evita
  // que algum form receba o caractere.
  useHotkeys(
    'shift+/',
    (e) => {
      e.preventDefault();
      setIsOpen((v) => !v);
    },
    { preventDefault: true }
  );

  return (
    <CheatsheetContext.Provider value={{ open }}>
      {children}
      <CheatsheetDialog open={isOpen} onClose={close} />
    </CheatsheetContext.Provider>
  );
}

export function useCheatsheet(): CheatsheetContextValue {
  const ctx = useContext(CheatsheetContext);
  if (!ctx) {
    throw new Error('useCheatsheet must be used inside <CheatsheetProvider>');
  }
  return ctx;
}
