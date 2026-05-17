/**
 * GridToggle.tsx (Onda 7b, Fase F) — botão isolado de visibilidade da grade.
 *
 * Liga/desliga apenas os pontinhos visuais. Snap em grade de 1mm continua
 * sempre ativo (invariante do sistema, ADR 014). Tooltip torna isso explícito
 * pra evitar a confusão "desliguei o snap clicando aqui".
 *
 * Lê gridVisible do store e dispara a renderização/clear no engine via
 * useEffect — assim o componente não acessa engine direto, deixa a sinc
 * estado→canvas para um único lugar.
 */
import { useEffect, type RefObject } from 'react';
import { Grid3x3 } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/ui/components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/tooltip';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  disabled?: boolean;
}

export function GridToggle({ engineRef, disabled }: Props): React.ReactElement {
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const toggle = useCanvasStore((s) => s.toggleGridVisible);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (gridVisible) {
      engine.renderGridDots();
    } else {
      engine.clearGridDots();
    }
    // engineRef é estável; gridVisible dispara rerun na transição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridVisible]);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            disabled={disabled}
            aria-label="Mostrar pontos da grade"
            aria-pressed={gridVisible}
            data-testid="grid-toggle"
            className={
              gridVisible
                ? 'h-8 w-8 text-laser hover:bg-ink-700 hover:text-laser [&_svg]:size-4'
                : 'h-8 w-8 text-ink-300 hover:bg-ink-700 hover:text-ink-100 [&_svg]:size-4'
            }
          >
            <Grid3x3 />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px]">
          Mostrar pontos da grade (snap 1mm sempre ativo)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
