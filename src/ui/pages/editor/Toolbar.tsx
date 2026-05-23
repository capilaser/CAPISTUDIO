import {
  Circle as CircleIcon,
  MousePointer2,
  Slash,
  Square as SquareIcon,
  Type,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/ui/components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/tooltip';

export type ToolId = 'select' | 'rect' | 'circle' | 'line' | 'text';

interface ToolbarProps {
  activeTool: ToolId;
  onToolChange: (id: ToolId) => void;
  /** Disabled = sem camada editavel disponivel. */
  disabled?: boolean;
}

const TOOLS: Array<{ id: ToolId; label: string; icon: typeof MousePointer2; shortcut: string }> = [
  { id: 'select', label: 'Selecionar', icon: MousePointer2, shortcut: 'V' },
  { id: 'rect', label: 'Retângulo', icon: SquareIcon, shortcut: 'R' },
  { id: 'circle', label: 'Círculo', icon: CircleIcon, shortcut: 'O' },
  { id: 'line', label: 'Linha', icon: Slash, shortcut: 'L' },
  { id: 'text', label: 'Texto', icon: Type, shortcut: 'T' },
];

export function Toolbar({ activeTool, onToolChange, disabled }: ToolbarProps) {
  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex w-12 flex-col items-center gap-1 border-r border-ink-800 bg-ink-925 py-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeTool;
          const isInsertTool = t.id !== 'select';
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t.label}
                  aria-pressed={active}
                  disabled={disabled && isInsertTool}
                  onClick={() => onToolChange(t.id)}
                  className={cn(
                    'h-9 w-9 rounded-md text-ink-300 hover:bg-ink-800 hover:text-ink-100',
                    active && 'bg-ink-800 text-laser ring-1 ring-laser/40'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-mono text-[11px]">
                {t.label} · {t.shortcut}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
