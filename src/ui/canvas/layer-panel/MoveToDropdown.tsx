/**
 * MoveToDropdown.tsx — dropdown "Mover pra..." (Onda 7).
 *
 * Aparece pra slots/visuais selecionados. Lista apliques disponíveis
 * (exceto o pai atual) + opção "Solto (sem aplique pai)". Selecionar
 * dispara engine.reparentLayer.
 */
import { Move } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';

interface Option {
  id: string | null; // null = solto
  name: string;
}

interface Props {
  currentParentId: string | null;
  options: Option[];
  onSelect: (newParentId: string | null) => void;
  disabled?: boolean;
}

export function MoveToDropdown({
  currentParentId,
  options,
  onSelect,
  disabled,
}: Props): React.ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex h-6 w-6 items-center justify-center rounded text-ink-400 transition-colors hover:bg-ink-700 hover:text-ink-100 disabled:opacity-30"
        aria-label="Mover camada pra..."
        data-testid="move-to-trigger"
      >
        <Move className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="min-w-[180px] text-[11px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-500">
          Mover pra
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => {
          const isCurrent = (opt.id ?? null) === currentParentId;
          return (
            <DropdownMenuItem
              key={opt.id ?? '__none__'}
              disabled={isCurrent}
              onClick={() => onSelect(opt.id)}
              className="cursor-pointer text-[11px]"
            >
              {opt.name}
              {isCurrent && <span className="ml-auto text-ink-500">atual</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
