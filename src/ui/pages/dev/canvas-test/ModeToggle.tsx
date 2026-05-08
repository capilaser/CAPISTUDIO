import { type CanvasMode, useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/ui/components/button';

export function ModeToggle() {
  const { mode, setMode } = useCanvasStore();

  function btn(label: string, value: CanvasMode) {
    const active = mode === value;
    return (
      <Button
        size="sm"
        variant={active ? 'default' : 'ghost'}
        onClick={() => setMode(value)}
        className={`h-6 px-2 font-mono text-[11px] ${active ? '' : 'text-ink-400 hover:text-ink-200'}`}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded border border-ink-700 bg-ink-900 p-0.5">
      {btn('Designer', 'designer')}
      {btn('Operador', 'operator')}
    </div>
  );
}
