/**
 * useCanvasEngine — hook que monta um CanvasEngine num elemento <canvas>
 * e expõe ações + estado de seleção.
 *
 * O engine é criado uma vez por (canvasEl, viewport) e disposto no cleanup.
 */

import { useEffect, useRef, useState } from 'react';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { ProjectViewport } from '@/core/project/project-file';

interface UseCanvasEngineArgs {
  viewport: ProjectViewport;
  onDirty?: () => void;
}

interface UseCanvasEngineResult {
  /** Ref para anexar no <canvas>. */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Engine instanciado. null antes do canvas montar. */
  engine: CanvasEngine | null;
  /** capiIds dos objetos atualmente selecionados. */
  selectedIds: string[];
}

export function useCanvasEngine(args: UseCanvasEngineArgs): UseCanvasEngineResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [engine, setEngine] = useState<CanvasEngine | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const eng = new CanvasEngine({
      canvasEl: el,
      viewport: args.viewport,
      events: {
        onDirty: args.onDirty,
        onSelection: (ids) => setSelectedIds(ids),
      },
    });
    setEngine(eng);
    return () => {
      eng.dispose();
      setEngine(null);
    };
    // viewport pode mudar entre projetos, mas mounting/unmounting do <canvas>
    // já cuida disso via key na EditorPage; aqui ignoramos width/height por ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.viewport.widthMm, args.viewport.heightMm]);

  return { canvasRef, engine, selectedIds };
}
