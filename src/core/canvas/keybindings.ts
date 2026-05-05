export interface KeybindingHandlers {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onPanStart?: () => void;
  onPanEnd?: () => void;
  onSave?: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Wires window-level keyboard listeners for canvas zoom/pan shortcuts.
 *  - Ctrl+= / Ctrl++  → onZoomIn
 *  - Ctrl+-           → onZoomOut
 *  - Ctrl+0           → onZoomReset
 *  - Space (hold)     → onPanStart on first keydown, onPanEnd on keyup or blur
 *
 * Returns a cleanup function that detaches all listeners and ends pan mode
 * if it was active. Always call this in a useEffect cleanup.
 */
export function attachCanvasKeybindings(handlers: KeybindingHandlers): () => void {
  let spaceDown = false;

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handlers.onZoomIn?.();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handlers.onZoomOut?.();
      } else if (e.key === '0') {
        e.preventDefault();
        handlers.onZoomReset?.();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handlers.onSave?.();
      }
      return;
    }

    if (e.key === ' ' && !spaceDown && !e.repeat) {
      e.preventDefault();
      spaceDown = true;
      handlers.onPanStart?.();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === ' ' && spaceDown) {
      e.preventDefault();
      spaceDown = false;
      handlers.onPanEnd?.();
    }
  };

  const onBlur = () => {
    if (spaceDown) {
      spaceDown = false;
      handlers.onPanEnd?.();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    if (spaceDown) {
      spaceDown = false;
      handlers.onPanEnd?.();
    }
  };
}
