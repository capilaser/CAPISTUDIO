/**
 * PatternClassificationPanel — Onda 33.E
 *
 * Painel mínimo de classificação semântica da camada selecionada conforme
 * spec "templates inteligentes":
 *  - Dropdown patternRole (5 valores + "sem classificação")
 *  - Botão "Converter em ÁREA" (TEXT_AREA / LOGO_AREA) com confirmação
 *  - Dropdown processType
 *  - 3 checkboxes M1/M2/M3
 *  - 4 toggles de lock granular
 *
 * Layout intencionalmente espartano — UI bonita fica pra Onda 34+.
 * Princípio: tudo o que a spec exige está aqui e é utilizável.
 *
 * Conexão com a engine via callbacks injetados (não usa engineRef direto
 * pra manter o componente testável sem Fabric).
 */
import { useState } from 'react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { MACHINE_CODES, MACHINE_LABEL } from '@/lib/machine-codes';
import type { LayerLocks, MachineCode, PatternRole, ProcessType } from '@/data/schema';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';

export interface PatternClassificationState {
  /** id da layer selecionada — `null` esconde o painel. */
  layerId: string | null;
  /** undefined = não classificada. */
  patternRole: PatternRole | undefined;
  processType: ProcessType | undefined;
  machineTargets: MachineCode[];
  locks: LayerLocks;
  /** true quando engine.hasChildren(id) — bloqueia "Converter em AREA". */
  hasChildren: boolean;
}

interface Props {
  state: PatternClassificationState;
  onSetPatternRole: (role: PatternRole | undefined) => void;
  onSetProcess: (process: ProcessType | undefined) => void;
  onSetMachines: (machines: MachineCode[]) => void;
  onSetLock: (key: keyof LayerLocks, value: boolean) => void;
  /**
   * Solicitação de converter o vetor selecionado em ÁREA. O caller
   * (PadraoEditorPage) é quem chama engine.convertToArea após confirmar.
   */
  onConvertToArea: (role: 'TEXT_AREA' | 'LOGO_AREA') => void;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: PatternRole | ''; label: string }> = [
  { value: '', label: 'Sem classificação' },
  { value: 'PRODUCT', label: 'PRODUCT — peça principal' },
  { value: 'APPLIQUE', label: 'APPLIQUE — peça adicional' },
  { value: 'CONTOUR', label: 'CONTOUR — contorno/decorativo' },
  { value: 'TEXT_AREA', label: 'TEXT_AREA — placeholder de texto' },
  { value: 'LOGO_AREA', label: 'LOGO_AREA — placeholder de logo' },
];

const PROCESS_OPTIONS: ReadonlyArray<{ value: ProcessType | ''; label: string }> = [
  { value: '', label: 'Sem processo' },
  { value: 'corte', label: 'Corte (preto)' },
  { value: 'gravacao', label: 'Gravação (vermelho)' },
  { value: 'marcacao', label: 'Marcação (azul)' },
];

const LOCK_LABELS: Record<keyof LayerLocks, string> = {
  position: 'Posição',
  scale: 'Escala',
  rotation: 'Rotação',
  structure: 'Estrutura',
};

export function PatternClassificationPanel({
  state,
  onSetPatternRole,
  onSetProcess,
  onSetMachines,
  onSetLock,
  onConvertToArea,
}: Props) {
  // Dialog de confirmação da conversão destrutiva.
  const [convertOpen, setConvertOpen] = useState<null | 'TEXT_AREA' | 'LOGO_AREA'>(null);

  if (state.layerId === null) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card/60 p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Classificação
        </span>
        <p className="text-[11px] text-muted-foreground">
          Selecione um objeto no canvas para classificar.
        </p>
      </div>
    );
  }

  function toggleMachine(code: MachineCode, on: boolean) {
    const current = new Set(state.machineTargets);
    if (on) current.add(code);
    else current.delete(code);
    onSetMachines(Array.from(current));
  }

  function handleRoleChange(value: string) {
    const role = value === '' ? undefined : (value as PatternRole);

    // Conversão destrutiva para AREAs requer confirmação explícita.
    if (role === 'TEXT_AREA' || role === 'LOGO_AREA') {
      if (state.hasChildren) {
        toast.error('Esta camada tem filhos — converter em ÁREA quebraria a hierarquia.');
        return;
      }
      setConvertOpen(role);
      return;
    }
    onSetPatternRole(role);
  }

  function handleProcessChange(value: string) {
    const process = value === '' ? undefined : (value as ProcessType);
    onSetProcess(process);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card/60 p-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Classificação
      </span>

      {/* ── Pattern role ────────────────────────────────────── */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Papel na spec
        </span>
        <select
          value={state.patternRole ?? ''}
          onChange={(e) => handleRoleChange(e.currentTarget.value)}
          className={cn(
            'h-7 rounded-md border border-border bg-background/60 px-2',
            'font-body text-xs text-foreground',
            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40'
          )}
        >
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* ── Process type ────────────────────────────────────── */}
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Processo
        </span>
        <select
          value={state.processType ?? ''}
          onChange={(e) => handleProcessChange(e.currentTarget.value)}
          className={cn(
            'h-7 rounded-md border border-border bg-background/60 px-2',
            'font-body text-xs text-foreground',
            'focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40'
          )}
        >
          {PROCESS_OPTIONS.map((opt) => (
            <option key={opt.value || 'none'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* ── Machines ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Máquinas
        </span>
        <div className="flex flex-col gap-1">
          {MACHINE_CODES.map((code) => {
            const checked = state.machineTargets.includes(code);
            return (
              <label key={code} className="flex items-center gap-2 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleMachine(code, e.currentTarget.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
                <span className="font-mono">{code}</span>
                <span className="text-muted-foreground">({MACHINE_LABEL[code]})</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Locks granulares ────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
          Travas
        </span>
        <div className="grid grid-cols-2 gap-1">
          {(Object.keys(LOCK_LABELS) as Array<keyof LayerLocks>).map((key) => {
            const checked = state.locks[key] === true;
            return (
              <label key={key} className="flex items-center gap-1.5 text-[11px] text-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onSetLock(key, e.currentTarget.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary"
                />
                <span>{LOCK_LABELS[key]}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Dialog de conversão destrutiva ─────────────────── */}
      <Dialog open={convertOpen !== null} onOpenChange={(o) => !o && setConvertOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Converter em {convertOpen}?</DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-xs">
              <span className="block">
                O vetor real desta camada vai ser <b>removido</b> e substituído por um placeholder
                tracejado roxo. Apenas os bounds em mm serão salvos — conforme a spec de áreas
                inteligentes.
              </span>
              <span className="block text-muted-foreground">
                Esta operação é destrutiva. Recomendado em camadas decorativas ou placeholders
                desenhados; <b>não</b> em vetores que vão pra produção.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConvertOpen(null)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                if (convertOpen) onConvertToArea(convertOpen);
                setConvertOpen(null);
              }}
            >
              Converter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
