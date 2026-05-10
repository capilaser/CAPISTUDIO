import { useEffect, useRef } from 'react';

/**
 * Tracks whether the Alt key is currently pressed.
 * Returns a ref (not state) to avoid re-renders during drag.
 *
 * Listeners are registered at window level so Alt is captured even before
 * canvas focus. Cleanup on unmount avoids leaks across page navigations.
 */
export function useAltKey(): React.RefObject<boolean> {
  const altKeyRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Alt') altKeyRef.current = e.type === 'keydown';
    };
    // Reset ao perder foco — evita "Alt grudado" após Alt+Tab.
    // No Windows, o sistema intercepta Alt+Tab para trocar de janela e o
    // evento keyup nunca chega ao listener; sem esse reset, o snap fica
    // desligado pra sempre até o usuário pressionar e soltar Alt de novo.
    const onBlur = (): void => {
      altKeyRef.current = false;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
      altKeyRef.current = false;
    };
  }, []);
  return altKeyRef;
}
