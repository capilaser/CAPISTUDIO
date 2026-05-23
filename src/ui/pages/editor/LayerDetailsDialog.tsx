import { useEffect, useRef, useState } from 'react';

import type { LayerService } from '@/core/canvas/layers/layer-service';
import type { Layer } from '@/core/project/project-file';
import type { MachineCode, ProcessType } from '@/data/schema';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

interface LayerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layer: Layer | null;
  service: LayerService | null;
}

const OPERATIONS: Array<{ id: ProcessType | 'none'; label: string; color: string }> = [
  { id: 'none', label: 'Sem operação', color: 'bg-ink-700' },
  { id: 'corte', label: 'Corte', color: 'bg-ink-100' },
  { id: 'gravacao', label: 'Gravação', color: 'bg-danger' },
  { id: 'marcacao', label: 'Marcação', color: 'bg-laser' },
];

const MACHINES: Array<{ id: MachineCode; label: string }> = [
  { id: 'M1', label: 'MB' },
  { id: 'M2', label: 'FB' },
  { id: 'M3', label: 'DL' },
];

export function LayerDetailsDialog({
  open,
  onOpenChange,
  layer,
  service,
}: LayerDetailsDialogProps) {
  const [name, setName] = useState('');
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current && layer) {
      wasOpenRef.current = true;
      setName(layer.name);
    }
    if (!open) {
      wasOpenRef.current = false;
    }
  }, [open, layer]);

  if (!layer || !service) return null;

  function commitName() {
    if (!layer || !service) return;
    const trimmed = name.trim();
    if (trimmed && trimmed !== layer.name) {
      service.rename(layer.id, trimmed);
    }
  }

  function setOperation(op: ProcessType | 'none') {
    if (!service || !layer) return;
    service.setOperation(layer.id, op === 'none' ? null : op);
  }

  function toggleMachine(m: MachineCode) {
    if (!service || !layer) return;
    const has = layer.machines.includes(m);
    const next = has ? layer.machines.filter((x) => x !== m) : [...layer.machines, m];
    service.setMachines(layer.id, next);
  }

  function toggleExport(key: 'png' | 'svg' | 'dxf') {
    if (!service || !layer) return;
    service.setExportTo(layer.id, { [key]: !layer.exportTo[key] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Camada</DialogTitle>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="layer-name">Nome</Label>
            <Input
              id="layer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
              }}
              maxLength={60}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Operação</Label>
            <div className="grid grid-cols-2 gap-2">
              {OPERATIONS.map((op) => {
                const active =
                  op.id === 'none' ? layer.operation === null : layer.operation === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => setOperation(op.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-md border border-ink-800 px-2 py-1.5 text-left text-xs transition-colors hover:border-ink-700 hover:bg-ink-900',
                      active && 'border-laser/60 bg-laser/10 text-ink-100'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', op.color)} />
                    {op.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Máquinas</Label>
            <div className="flex gap-2">
              {MACHINES.map((m) => {
                const active = layer.machines.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMachine(m.id)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 font-mono text-xs transition-colors',
                      active
                        ? 'border-laser/60 bg-laser/10 text-laser'
                        : 'border-ink-800 text-ink-400 hover:border-ink-700 hover:bg-ink-900'
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-500">
              Toque para alternar. Cada camada pode ir para 1 a 3 máquinas.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Exportar em</Label>
            <div className="flex gap-2">
              {(['png', 'svg', 'dxf'] as const).map((fmt) => {
                const active = layer.exportTo[fmt];
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => toggleExport(fmt)}
                    className={cn(
                      'flex-1 rounded-md border px-2 py-1.5 font-mono text-xs uppercase transition-colors',
                      active
                        ? 'border-ok/40 bg-ok/10 text-ok'
                        : 'border-ink-800 text-ink-400 hover:border-ink-700 hover:bg-ink-900'
                    )}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-ink-500">
              PNG é aprovação; SVG/DXF são produção (PROJECT_VISION §9).
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
