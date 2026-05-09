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
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      altKeyRef.current = false;
    };
  }, []);
  return altKeyRef;
}
