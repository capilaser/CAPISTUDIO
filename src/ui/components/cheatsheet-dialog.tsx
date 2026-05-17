/**
 * CheatsheetDialog — lista de atalhos do editor (Onda 20.D).
 *
 * Abre via:
 *   - Tecla `?` em qualquer lugar do app (registrado em App.tsx)
 *   - Botão de teclado no AppFooter (descobrível pra quem não conhece `?`)
 *
 * Conteúdo agrupado em 2 seções:
 *   1. Globais (Ctrl+S/E/P/D) — funcionam em qualquer canto do editor.
 *   2. Canvas (Delete/Esc/Tab/Setas) — funcionam quando o foco está no canvas.
 *
 * Visual: kbds em mono pra técnico, descrição em body.
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface ShortcutRow {
  keys: string[];
  description: string;
}

const GLOBAL_SHORTCUTS: ShortcutRow[] = [
  { keys: ['Ctrl', 'S'], description: 'Salvar pedido' },
  { keys: ['Ctrl', 'E'], description: 'Exportar SVG corte' },
  { keys: ['Ctrl', 'P'], description: 'Exportar PNG mockup' },
  { keys: ['Ctrl', 'D'], description: 'Duplicar broche selecionado' },
];

const CANVAS_SHORTCUTS: ShortcutRow[] = [
  { keys: ['Delete'], description: 'Excluir camada selecionada (com confirmação)' },
  { keys: ['Esc'], description: 'Limpar seleção do canvas' },
  { keys: ['Tab'], description: 'Próximo slot do broche ativo' },
  { keys: ['Shift', 'Tab'], description: 'Slot anterior do broche ativo' },
  { keys: ['↑', '↓', '←', '→'], description: 'Mover objeto selecionado em 0,1 mm' },
  { keys: ['Shift', '↑/↓/←/→'], description: 'Mover objeto em 1 mm' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CheatsheetDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 pt-2">
          <ShortcutGroup title="Globais" rows={GLOBAL_SHORTCUTS} />
          <ShortcutGroup title="Canvas" rows={CANVAS_SHORTCUTS} />
        </div>

        <p className="pt-2 text-[10px] text-muted-foreground/70">
          Dica: pressione <Kbd>?</Kbd> em qualquer momento pra abrir essa janela.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutGroup({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className="text-xs text-foreground">{row.description}</span>
            <span className="flex items-center gap-1">
              {row.keys.map((k, j) => (
                <span key={j} className="flex items-center gap-1">
                  {j > 0 && <span className="text-[9px] text-muted-foreground/50">+</span>}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-ink-700 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-100 shadow-sm">
      {children}
    </kbd>
  );
}
