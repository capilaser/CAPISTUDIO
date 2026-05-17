/**
 * NovoPedidoLayerSidebar — painel direito (camadas) do editor (Onda 15).
 *
 * Onda 15 — pluga o LayerPanel (Onda 7) que já estava pronto em
 * /dev/canvas-test. Agora visível no /arte/novo. Reusa a infra completa:
 * hierarchy, refresh por eventos do canvas, ações inline.
 */
import { type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { LayerPanel } from '@/ui/canvas/LayerPanel';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /** Sinaliza ao LayerPanel pra (re)anexar listeners quando o engine fica pronto. */
  engineReady: boolean;
  /** Onda 15.fix — incrementa a cada engine novo, força re-anexação. */
  engineVersion: number;
}

export function NovoPedidoLayerSidebar({ engineRef, engineReady, engineVersion }: Props) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Camadas</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <LayerPanel
          engineRef={engineRef}
          engineReady={engineReady}
          engineVersion={engineVersion}
          showTitle={false}
        />
      </div>
    </aside>
  );
}
