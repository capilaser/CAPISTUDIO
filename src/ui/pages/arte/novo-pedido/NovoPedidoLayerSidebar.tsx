/**
 * NovoPedidoLayerSidebar — painel direito (camadas) do editor (Onda 12 F4.1).
 *
 * F4.1: placeholder.
 * Fase 8: vai reusar LayerPanel existente, refinado com badges CUT/GRAV/MARC
 * e operação editável inline.
 */
import { Layers } from 'lucide-react';

export function NovoPedidoLayerSidebar() {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Camadas
        </span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
        <Layers className="h-6 w-6 text-muted-foreground/40" />
        <p className="font-mono text-[11px] text-muted-foreground">Sem camadas ainda</p>
        <p className="font-mono text-[10px] text-muted-foreground/60">
          Adicione um aplique, texto ou logo
        </p>
      </div>
    </aside>
  );
}
