import { type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { AlignmentToolbar } from '@/ui/canvas/AlignmentToolbar';
import { MeasurementOverlay } from '@/ui/canvas/MeasurementOverlay';
import { ProximityOverlay } from '@/ui/canvas/ProximityOverlay';

import { OperatorInputs } from './OperatorInputs';
import { UnifiedRightPanel } from './UnifiedRightPanel';

export interface CanvasWorkspaceProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engineRef: RefObject<CanvasEngine | null>;
  ready: boolean;
  error: string | null;
  viewport: { widthPx: number; heightPx: number };
  /**
   * Quando true, renderiza o painel `OperatorInputs` na coluna direita.
   * Páginas que não têm noção de modo "operator" passam false.
   */
  showOperatorInputs: boolean;
}

export function CanvasWorkspace({
  canvasRef,
  engineRef,
  ready,
  error,
  viewport,
  showOperatorInputs,
}: CanvasWorkspaceProps) {
  return (
    <>
      {/* Onda 7b — Fase D: segunda linha condicional, aparece com seleção ativa.
          Só montamos depois que o engine está pronto — antes disso engineRef.current
          é null e o efeito de listener encerraria sem registrar. */}
      {ready && <AlignmentToolbar engineRef={engineRef} />}

      {/* Onda 7b — Fase E: caixinhas DOM com distância V/H entre 2 selecionados.
          Mesmo padrão de mount: só após ready (engine vivo). */}
      {ready && <MeasurementOverlay engineRef={engineRef} />}

      {/* Onda 7b — Fase E2: 4 caixinhas DOM com distância do objeto selecionado
          até a coisa mais próxima em cada direção (ou borda da placa). Aparece
          quando há exatamente 1 objeto selecionado, independente do Ruler. */}
      {ready && <ProximityOverlay engineRef={engineRef} />}

      {/* 3-column layout: canvas | UnifiedRightPanel | OperatorInputs */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 items-center justify-center p-6">
          {error ? (
            <p className="font-mono text-xs text-danger">error: {error}</p>
          ) : (
            <canvas
              ref={canvasRef}
              width={viewport.widthPx}
              height={viewport.heightPx}
              className="rounded-sm border border-ink-700 shadow-md"
            />
          )}
        </div>
        {/* UnifiedRightPanel: always visible, 3 tabs (Apliques | Materiais | Camadas) */}
        <UnifiedRightPanel engineRef={engineRef} />
        {/* OperatorInputs: visible only in operator mode */}
        {showOperatorInputs && <OperatorInputs engineRef={engineRef} />}
      </div>
    </>
  );
}
