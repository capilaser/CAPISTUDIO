import { Eye, EyeOff, Lock, Plus, Unlock } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { LayerService } from '@/core/canvas/layers/layer-service';
import type { Layer } from '@/core/project/project-file';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/components/button';

interface LayersPanelProps {
  layers: Layer[];
  layerService: LayerService | null;
  engine: CanvasEngine | null;
}

const OPERATION_COLOR: Record<NonNullable<Layer['operation']>, string> = {
  corte: 'bg-ink-100',
  gravacao: 'bg-danger',
  marcacao: 'bg-laser',
};

export function LayersPanel({ layers, layerService, engine }: LayersPanelProps) {
  function toggleVisibility(l: Layer) {
    if (!layerService) return;
    const next = !l.visible;
    layerService.setVisibility(l.id, next);
    engine?.setLayerVisibility(l.id, next);
  }

  function toggleLock(l: Layer) {
    if (!layerService) return;
    const next = !l.locked;
    layerService.setLocked(l.id, next);
    engine?.setLayerLocked(l.id, next);
  }

  function createLayer() {
    layerService?.create();
  }

  // Render top-down (zIndex maior em cima da lista).
  const ordered = layers.slice().reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Camadas</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-ink-400 hover:text-ink-100"
          onClick={createLayer}
          aria-label="Nova camada"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2 text-xs">
        {ordered.map((l) => (
          <li
            key={l.id}
            className={cn(
              'group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-900',
              !l.visible && 'opacity-50'
            )}
          >
            <button
              type="button"
              onClick={() => toggleVisibility(l)}
              className="text-ink-500 hover:text-ink-200"
              aria-label={l.visible ? 'Ocultar' : 'Mostrar'}
            >
              {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => toggleLock(l)}
              className="text-ink-500 hover:text-ink-200"
              aria-label={l.locked ? 'Destravar' : 'Travar'}
            >
              {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                l.operation ? OPERATION_COLOR[l.operation] : 'bg-ink-700'
              )}
              title={l.operation ?? 'sem operação'}
            />
            <span className="flex-1 truncate text-ink-200" title={l.name}>
              {l.name}
            </span>
            <span className="font-mono text-[9px] text-ink-600">{l.machines.join(',') || '—'}</span>
          </li>
        ))}
        {ordered.length === 0 && (
          <li className="px-2 py-3 text-[11px] text-ink-600">Nenhuma camada ainda.</li>
        )}
      </ul>
    </div>
  );
}
