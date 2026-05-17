/**
 * RulerToggle.tsx (Onda 7b, Fase E) — botão isolado de modo medição.
 *
 * Lê measurementMode do store e dispara toggleMeasurementMode no clique.
 * Estado visual: laser quando ligado, ink-300 quando desligado.
 *
 * Vive separado de CanvasTest pra manter aquela página enxuta — mesma
 * decisão da Fase D com AlignmentToolbar e SlotCreatorButtons.
 */
import { Ruler } from 'lucide-react';

import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/ui/components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/tooltip';

interface Props {
  disabled?: boolean;
}

export function RulerToggle({ disabled }: Props): React.ReactElement {
  const measurementMode = useCanvasStore((s) => s.measurementMode);
  const toggle = useCanvasStore((s) => s.toggleMeasurementMode);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            disabled={disabled}
            aria-label="Modo medição"
            aria-pressed={measurementMode}
            data-testid="ruler-toggle"
            className={
              measurementMode
                ? 'h-8 w-8 text-laser hover:bg-ink-700 hover:text-laser [&_svg]:size-4'
                : 'h-8 w-8 text-ink-300 hover:bg-ink-700 hover:text-ink-100 [&_svg]:size-4'
            }
          >
            <Ruler />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px]">
          Modo medição (mostra distância entre objetos selecionados)
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
