/**
 * AlignmentToolbar.tsx — segunda linha condicional com 6 botões de alinhamento.
 *
 * Aparece quando há ≥1 objeto selecionado no canvas. Some quando a seleção
 * é limpa. Slide-down ao aparecer; saída instantânea (sem AnimatePresence —
 * decisão da Fase D).
 *
 * Lógica:
 *   - 1 obj selecionado          → ref = pai imediato (getParentBoundsForObject)
 *                                  ou canvas inteiro quando parentLayerId === null
 *   - 2+ objs (ActiveSelection)  → ref = bounding box dos próprios objs (Figma-style)
 *
 * Em multi-seleção, desagrupa antes de aplicar (set absoluto em cada filho top-level)
 * e reagrupa depois para preservar a UX de seleção. ActiveSelection guarda
 * coordenadas dos filhos relativas ao centro do grupo — set direto sem desagrupar
 * bagunça posições.
 */
import { useEffect, useState, type RefObject } from 'react';
import * as fabric from 'fabric';
import {
  AlignLeft,
  AlignCenterHorizontal,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  type LucideIcon,
} from 'lucide-react';

import { CanvasEngine, isBaseObject } from '@/core/canvas/canvas-engine';
import { applyAlignment, type AlignmentCommand } from '@/core/canvas/alignment/alignment-commands';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';
import { getCapiId } from '@/core/canvas/capi-id';
import { mmToPx, pxToMm } from '@/core/canvas/units';
import { Button } from '@/ui/components/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/tooltip';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
}

interface ButtonSpec {
  command: AlignmentCommand;
  icon: LucideIcon;
  label: string;
}

const BUTTONS: readonly ButtonSpec[] = [
  { command: 'alignLeft', icon: AlignLeft, label: 'Alinhar à esquerda' },
  { command: 'alignCenterH', icon: AlignCenterHorizontal, label: 'Centralizar horizontal' },
  { command: 'alignRight', icon: AlignRight, label: 'Alinhar à direita' },
  { command: 'alignTop', icon: AlignStartVertical, label: 'Alinhar topo' },
  { command: 'alignCenterV', icon: AlignCenterVertical, label: 'Centralizar vertical' },
  { command: 'alignBottom', icon: AlignEndVertical, label: 'Alinhar base' },
];

// ─── Helpers de leitura de objeto Fabric → RectMm ─────────────────────────────

function fabricObjectToRectMm(obj: fabric.FabricObject): RectMm {
  const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
  const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
  return {
    left: pxToMm(obj.left ?? 0),
    top: pxToMm(obj.top ?? 0),
    width: pxToMm(w),
    height: pxToMm(h),
  };
}

/**
 * Bounding box absoluto (em mm) de um filho dentro de uma ActiveSelection.
 * Em Fabric 6, `child.left/top` é relativo ao centro da seleção. Usamos
 * `getBoundingRect()` (canvas-absolute, considera transform da seleção).
 */
function activeSelectionChildToRectMm(child: fabric.FabricObject): RectMm {
  const r = child.getBoundingRect();
  return {
    left: pxToMm(r.left),
    top: pxToMm(r.top),
    width: pxToMm(r.width),
    height: pxToMm(r.height),
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AlignmentToolbar({ engineRef }: Props): React.ReactElement | null {
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const canvas = engine.canvas;
    const onChange = (): void => {
      const active = canvas.getActiveObject();
      // Active selection com getObjects() vazio (caso de borda) também é "sem seleção".
      if (!active) {
        setHasSelection(false);
        return;
      }
      if (active instanceof fabric.ActiveSelection) {
        setHasSelection(active.getObjects().length > 0);
        return;
      }
      // Objeto único: precisa ser user object (não a base do produto).
      setHasSelection(!isBaseObject(active));
    };

    canvas.on('selection:created', onChange);
    canvas.on('selection:updated', onChange);
    canvas.on('selection:cleared', onChange);

    return () => {
      canvas.off('selection:created', onChange);
      canvas.off('selection:updated', onChange);
      canvas.off('selection:cleared', onChange);
    };
    // engineRef é uma ref estável — sua identidade nunca muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasSelection) return null;

  const handleClick = (command: AlignmentCommand): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;
    const active = canvas.getActiveObject();
    if (!active) return;

    if (active instanceof fabric.ActiveSelection) {
      const children = active.getObjects().slice();
      const rectsBefore = children.map(activeSelectionChildToRectMm);

      // Para multi-seleção, ref é a borda mais externa (Figma) — alignment-commands
      // resolve isso quando rects.length >= 2 ignorando referenceBounds. Passamos o
      // canvas como referenceBounds só por completude do contrato.
      const canvasBounds: RectMm = {
        left: 0,
        top: 0,
        width: engine.config.productWidthMm,
        height: engine.config.productHeightMm,
      };
      const rectsAfter = applyAlignment(command, rectsBefore, canvasBounds);

      if (import.meta.env.DEV) {
        console.log(
          '[Align]',
          command,
          'rects=',
          children.length,
          'before=',
          rectsBefore.map((r) => ({ l: r.left, t: r.top })),
          'after=',
          rectsAfter.map((r) => ({ l: r.left, t: r.top }))
        );
      }

      // Desagrupa: limpa seleção, aplica posições absolutas em cada filho top-level,
      // reagrupa para preservar UX. Padrão Figma — sobrevive a transformações futuras
      // (rotação, escala) que matemática manual não sobreviveria.
      canvas.discardActiveObject();
      children.forEach((child, i) => {
        const r = rectsAfter[i];
        child.set({ left: mmToPx(r.left), top: mmToPx(r.top) });
        child.setCoords();
        // Slot body: dispara object:modified pra que slot-manager sincronize overlay
        // e persista capiSlot meta. Outros objetos: noop útil (handler ignora targets
        // sem entry).
        canvas.fire('object:modified', { target: child });
      });
      const newSelection = new fabric.ActiveSelection(children, { canvas });
      canvas.setActiveObject(newSelection);
      canvas.requestRenderAll();
      return;
    }

    // Objeto único.
    const obj = active as fabric.FabricObject;
    if (isBaseObject(obj)) return;

    const rectBefore = fabricObjectToRectMm(obj);

    // Referência: pai imediato (slot dentro de aplique → aplique) ou canvas.
    // Usa getCapiId — slots não têm obj.id direto, o id mora em capiSlot.id.
    // Sem essa abstração, slots silently faziam fallback pra canvas (Fix #1, Causa #B).
    const objectId = getCapiId(obj as unknown as Record<string, unknown>);
    const parentBounds = objectId ? engine.getParentBoundsForObject(objectId) : null;
    const referenceBounds: RectMm = parentBounds ?? {
      left: 0,
      top: 0,
      width: engine.config.productWidthMm,
      height: engine.config.productHeightMm,
    };

    const [rectAfter] = applyAlignment(command, [rectBefore], referenceBounds);

    if (import.meta.env.DEV) {
      console.log(
        '[Align]',
        command,
        'rects=',
        1,
        'ref=',
        parentBounds ? 'parent' : 'canvas',
        'before=',
        { l: rectBefore.left, t: rectBefore.top },
        'after=',
        { l: rectAfter.left, t: rectAfter.top }
      );
    }

    obj.set({ left: mmToPx(rectAfter.left), top: mmToPx(rectAfter.top) });
    obj.setCoords();
    // Dispara object:modified pra slot-manager sincronizar overlay (no-op para
    // outros tipos de objeto, slot-manager ignora targets sem entry).
    canvas.fire('object:modified', { target: obj });
    canvas.requestRenderAll();
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="flex h-10 items-center gap-1 border-b border-ink-700 bg-ink-800 px-4 animate-in slide-in-from-top-1 fade-in duration-150 ease-out"
        data-testid="alignment-toolbar"
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-500">Alinhar</span>
        <div className="ml-2 flex items-center gap-0.5">
          {BUTTONS.map(({ command, icon: Icon, label }) => (
            <Tooltip key={command}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleClick(command)}
                  aria-label={label}
                  className="h-8 w-8 text-ink-300 hover:bg-ink-700 hover:text-ink-100 [&_svg]:size-4"
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="font-mono text-[11px]">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
