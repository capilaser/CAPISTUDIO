/**
 * NovoPedidoLayerSidebar — painel direito (camadas) do editor.
 *
 * Onda 15 — pluga o LayerPanel (Onda 7).
 * Onda 26 — largura 320px (era 280) pra acomodar thumbnails + slider de
 * opacidade do painel pro. Header/footer agora vivem dentro do LayerPanel
 * (showTitle=true), não mais nesta aside.
 */
import { type RefObject, type Ref } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { LayerPanel, type LayerPanelHandle } from '@/ui/canvas/LayerPanel';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /** Sinaliza ao LayerPanel pra (re)anexar listeners quando o engine fica pronto. */
  engineReady: boolean;
  /** Onda 15.fix — incrementa a cada engine novo, força re-anexação. */
  engineVersion: number;
  /** Onda 20.C — ref encaminhado ao LayerPanel pra atalhos globais (Delete). */
  panelRef?: Ref<LayerPanelHandle>;
}

export function NovoPedidoLayerSidebar({ engineRef, engineReady, engineVersion, panelRef }: Props) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
      <LayerPanel
        ref={panelRef}
        engineRef={engineRef}
        engineReady={engineReady}
        engineVersion={engineVersion}
        showTitle
      />
    </aside>
  );
}
