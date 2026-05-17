/**
 * useOrderShortcuts — atalhos globais do editor de pedido (Onda 20.B).
 *
 * Ctrl+S → Salvar pedido
 * Ctrl+E → Exportar SVG corte
 * Ctrl+P → Exportar PNG mockup (preventDefault no Tauri WebView)
 * Ctrl+D → Duplicar broche selecionado
 *
 * Os atalhos disparam handlers passados pelo caller. Não há lógica de
 * domínio aqui — o hook só faz o binding teclado→handler.
 *
 * Cada atalho usa `preventDefault: true` pra evitar comportamento default
 * do browser/WebView (Ctrl+S salva HTML, Ctrl+P abre print, etc).
 */
import { useHotkeys } from 'react-hotkeys-hook';

interface UseOrderShortcutsProps {
  onSave: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onDuplicateActive: () => void;
  /** Se false, atalhos ficam desativados (ex: durante saving). */
  enabled?: boolean;
}

export function useOrderShortcuts({
  onSave,
  onExportSvg,
  onExportPng,
  onDuplicateActive,
  enabled = true,
}: UseOrderShortcutsProps): void {
  useHotkeys(
    'mod+s',
    (e) => {
      e.preventDefault();
      onSave();
    },
    { enabled }
  );
  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault();
      onExportSvg();
    },
    { enabled }
  );
  useHotkeys(
    'mod+p',
    (e) => {
      e.preventDefault();
      onExportPng();
    },
    { enabled }
  );
  useHotkeys(
    'mod+d',
    (e) => {
      e.preventDefault();
      onDuplicateActive();
    },
    { enabled }
  );
}
