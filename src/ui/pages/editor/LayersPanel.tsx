import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Lock,
  MoveRight,
  Plus,
  Settings2,
  Trash2,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { LayerService } from '@/core/canvas/layers/layer-service';
import type { Layer } from '@/core/project/project-file';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/components/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/ui/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';

import { LayerDetailsDialog } from './LayerDetailsDialog';

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
  const [detailsForId, setDetailsForId] = useState<string | null>(null);
  const detailsLayer = detailsForId ? (layers.find((l) => l.id === detailsForId) ?? null) : null;

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

  function moveUp(l: Layer) {
    if (!layerService) return;
    layerService.moveTo(l.id, Math.min(layers.length - 1, l.zIndex + 1));
  }
  function moveDown(l: Layer) {
    if (!layerService) return;
    layerService.moveTo(l.id, Math.max(0, l.zIndex - 1));
  }

  function deleteLayer(l: Layer) {
    if (!layerService || !engine) return;
    if (l.locked) {
      toast.error('Camada travada. Destrave antes de apagar.');
      return;
    }
    // Apaga objetos pertencentes à camada antes de remover.
    const targets = engine.fabric.getObjects().filter((o) => o.layerId === l.id);
    let blocked = 0;
    for (const o of targets) {
      if (o.capiImported) {
        blocked++;
        continue;
      }
      engine.fabric.remove(o);
    }
    engine.fabric.requestRenderAll();
    if (blocked > 0) {
      toast.error('Existe objeto base importado nesta camada — não apagado.');
      return;
    }
    layerService.remove(l.id);
  }

  function moveSelectionToLayer(targetLayerId: string) {
    if (!engine) return;
    const active = engine.fabric.getActiveObjects();
    let moved = 0;
    for (const o of active) {
      if (o.capiImported) continue;
      o.layerId = targetLayerId;
      moved++;
    }
    if (moved > 0) {
      engine.fabric.requestRenderAll();
      toast.success(`${moved} objeto(s) movido(s).`);
    } else {
      toast.message('Nenhum objeto selecionado (ou só objetos base).');
    }
  }

  // Render top-down (zIndex maior em cima da lista).
  const ordered = layers.slice().reverse();

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Camadas
          </h2>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-ink-400 hover:text-ink-100"
                  aria-label="Mover seleção para camada"
                  title="Mover seleção para camada"
                  disabled={layers.length === 0}
                >
                  <MoveRight className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider">
                  Mover seleção para…
                </DropdownMenuLabel>
                {layers
                  .slice()
                  .reverse()
                  .map((target) => (
                    <DropdownMenuItem
                      key={target.id}
                      onSelect={() => moveSelectionToLayer(target.id)}
                    >
                      {target.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-ink-400 hover:text-ink-100"
              onClick={createLayer}
              aria-label="Nova camada"
              title="Nova camada"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2 text-xs">
          {ordered.map((l) => (
            <ContextMenu key={l.id}>
              <ContextMenuTrigger asChild>
                <li
                  className={cn(
                    'group flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-ink-900',
                    !l.visible && 'opacity-50'
                  )}
                  onDoubleClick={() => setDetailsForId(l.id)}
                >
                  <button
                    type="button"
                    onClick={() => toggleVisibility(l)}
                    className="text-ink-500 hover:text-ink-200"
                    aria-label={l.visible ? 'Ocultar' : 'Mostrar'}
                  >
                    {l.visible ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLock(l)}
                    className="text-ink-500 hover:text-ink-200"
                    aria-label={l.locked ? 'Destravar' : 'Travar'}
                  >
                    {l.locked ? (
                      <Lock className="h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5" />
                    )}
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
                  <span className="font-mono text-[9px] text-ink-600">
                    {l.machines.join(',') || '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailsForId(l.id)}
                    className="text-ink-500 opacity-0 hover:text-ink-200 group-hover:opacity-100"
                    aria-label="Detalhes da camada"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => setDetailsForId(l.id)}>
                  <Settings2 className="mr-2 h-4 w-4" /> Editar…
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => moveUp(l)}
                  disabled={l.zIndex >= layers.length - 1}
                >
                  <ArrowUp className="mr-2 h-4 w-4" /> Para cima
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => moveDown(l)} disabled={l.zIndex <= 0}>
                  <ArrowDown className="mr-2 h-4 w-4" /> Para baixo
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="text-danger focus:text-danger"
                  disabled={l.locked}
                  onSelect={() => deleteLayer(l)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Apagar camada
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          {ordered.length === 0 && (
            <li className="px-2 py-3 text-[11px] text-ink-600">Nenhuma camada ainda.</li>
          )}
        </ul>
      </div>

      <LayerDetailsDialog
        open={detailsForId !== null}
        onOpenChange={(o) => {
          if (!o) setDetailsForId(null);
        }}
        layer={detailsLayer}
        service={layerService}
      />
    </>
  );
}
