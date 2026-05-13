import { type RefObject } from 'react';
import { Download } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { Button } from '@/ui/components/button';
import { GridToggle } from '@/ui/canvas/GridToggle';
import { RulerToggle } from '@/ui/canvas/RulerToggle';

import { ModeToggle } from './ModeToggle';
import { SlotCreatorButtons } from './SlotCreatorButtons';

export interface CanvasToolbarProps {
  engineRef: RefObject<CanvasEngine | null>;
  ready: boolean;
  saving: boolean;
  onSave: () => void;
  onClear: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onExportPng: () => void;
  /**
   * Quando passado, renderiza o botão "Adicionar retângulo" (DEV-only).
   * Páginas de produção (pedido, edição de padrão) omitem este prop.
   */
  onAddRectangle?: () => void;
}

export function CanvasToolbar({
  engineRef,
  ready,
  saving,
  onSave,
  onClear,
  onSaveAs,
  onLoad,
  onExportPng,
  onAddRectangle,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-900/50 px-4 py-2">
      <ModeToggle />

      <SlotCreatorButtons engineRef={engineRef} disabled={!ready} />

      <div className="h-4 w-px bg-ink-700" />

      {onAddRectangle && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAddRectangle}
          disabled={!ready}
          className="font-mono text-[11px]"
        >
          Adicionar retângulo
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onClear}
        disabled={!ready}
        className="font-mono text-[11px]"
      >
        Limpar canvas
      </Button>
      <Button
        variant="default"
        size="sm"
        onClick={onSave}
        disabled={!ready || saving}
        className="font-mono text-[11px]"
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>

      <div className="h-4 w-px bg-ink-700" />

      <Button
        variant="outline"
        size="sm"
        onClick={onSaveAs}
        disabled={!ready}
        className="font-mono text-[11px]"
      >
        Salvar como padrão
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onLoad}
        disabled={!ready}
        className="font-mono text-[11px]"
      >
        Abrir padrão
      </Button>

      <div className="h-4 w-px bg-ink-700" />

      {/* Onda 9.F — exporta canvas como PNG mockup pro cliente. */}
      <Button
        variant="default"
        size="sm"
        onClick={onExportPng}
        disabled={!ready}
        className="font-mono text-[11px]"
        title="Exportar PNG mockup pro cliente"
      >
        <Download className="mr-1.5 h-3 w-3" />
        Exportar PNG
      </Button>

      <div className="h-4 w-px bg-ink-700" />

      {/* Onda 7b Fase E — toggle de modo medição. Ligado: laser; desligado: ink-300. */}
      <RulerToggle disabled={!ready} />

      {/* Onda 7b Fase F — toggle de pontinhos da grade. Snap em grade sempre ativo. */}
      <GridToggle engineRef={engineRef} disabled={!ready} />

      <span className="ml-auto font-mono text-[11px] text-ink-500">
        Ctrl+S salvar · Ctrl+= zoom · Ctrl+0 reset · Space+drag pan
      </span>
    </div>
  );
}
