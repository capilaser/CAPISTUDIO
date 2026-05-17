/**
 * LiveMetricsOverlay.tsx (Onda 26) — HUD numérico flutuante durante drag/resize.
 *
 * Mostra ao lado do objeto sendo manipulado:
 *   - drag:   x, y (absoluto em mm) + Δx, Δy (delta desde o início do drag)
 *   - resize: w, h (em mm)
 *
 * Aparece quando há exatamente 1 user-object ativo em movimento. Some no
 * mouse:up, selection:cleared ou quando o store desliga liveMetricsEnabled.
 *
 * Padrão herdado do MeasurementOverlay (Onda 7b Fase E):
 *   - DOM por cima do canvas (texto nítido com font-mono + tabular-nums)
 *   - style.transform direto via ref em object:moving/scaling (60fps sem setState)
 *   - rAF batching pra coalescer múltiplas fontes no mesmo frame
 *   - setState só em transições discretas (start/stop do gesture)
 *
 * Posicionamento: caixa ancorada ao canto inferior-direito da bounding box
 * do objeto, com gap de 8px pra não tapar a alça de resize. Quando o objeto
 * está perto da borda direita do canvas, o overlay pode sair da viewport —
 * isso é aceitável (overlay segue o objeto, regra simples).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as fabric from 'fabric';

import { CanvasEngine, isBaseObject } from '@/core/canvas/canvas-engine';
import { composeDragLine, composeResizeLine } from '@/core/canvas/format-metrics';
import { mmToPx, pxToMm } from '@/core/canvas/units';
import { useCanvasStore } from '@/stores/canvas-store';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
}

type GestureMode = 'drag' | 'resize';

interface GestureStart {
  mode: GestureMode;
  /** centro do objeto em mm no início do gesto (drag) */
  cxMm: number;
  cyMm: number;
}

/**
 * Bbox canvas-absolute do objeto em mm. `getBoundingRect()` retorna em px
 * relativo ao canvas (já aplica transform do grupo se for filho de seleção).
 */
function objectRectMm(obj: fabric.FabricObject): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const r = obj.getBoundingRect();
  return {
    left: pxToMm(r.left),
    top: pxToMm(r.top),
    width: pxToMm(r.width),
    height: pxToMm(r.height),
  };
}

/**
 * Converte ponto (xMm, yMm) no espaço do produto pra coordenadas DOM da
 * viewport, aplicando viewportTransform do Fabric + offset do <canvas>.
 * Mesma matemática do MeasurementOverlay.mmToDomPoint.
 */
function mmToDomPoint(
  xMm: number,
  yMm: number,
  canvas: fabric.Canvas,
  canvasRect: DOMRect
): { x: number; y: number } {
  const xPx = mmToPx(xMm);
  const yPx = mmToPx(yMm);
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const xCanvas = vpt[0] * xPx + vpt[4];
  const yCanvas = vpt[3] * yPx + vpt[5];
  return {
    x: canvasRect.left + xCanvas,
    y: canvasRect.top + yCanvas,
  };
}

/** Resolve o objeto sob gesto. Null se for base, ActiveSelection (multi) ou nada. */
function resolveSingleTarget(canvas: fabric.Canvas): fabric.FabricObject | null {
  const active = canvas.getActiveObject();
  if (!active) return null;
  if (active instanceof fabric.ActiveSelection) return null; // multi-seleção: fora de escopo
  if (isBaseObject(active)) return null;
  return active;
}

export function LiveMetricsOverlay({ engineRef }: Props): React.ReactElement | null {
  const liveMetricsEnabled = useCanvasStore((s) => s.liveMetricsEnabled);

  // active = "tem gesto ativo (drag ou resize) com objeto válido".
  // Estado discreto, muda só em start/stop do gesto. Conteúdo da caixa é
  // atualizado via textContent direto no ref durante moving/scaling.
  const [active, setActive] = useState(false);
  const [initialText, setInitialText] = useState('');

  const boxRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureStart | null>(null);

  useEffect(() => {
    if (!liveMetricsEnabled) return;
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;

    let cachedCanvasRect: DOMRect = canvas.getElement().getBoundingClientRect();
    let pendingRaf: number | null = null;

    const hide = (): void => {
      gestureRef.current = null;
      setActive(false);
    };

    /**
     * Compõe o texto do HUD a partir do objeto e do modo do gesto.
     */
    const composeText = (obj: fabric.FabricObject, mode: GestureMode): string => {
      const rect = objectRectMm(obj);
      if (mode === 'resize') {
        return composeResizeLine(rect.width, rect.height);
      }
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const start = gestureRef.current;
      if (!start || start.mode !== 'drag') {
        return composeDragLine(cx, cy);
      }
      return composeDragLine(cx, cy, cx - start.cxMm, cy - start.cyMm);
    };

    /**
     * Posiciona o HUD ao canto inferior-direito da bbox + 8px de gap.
     */
    const positionBox = (obj: fabric.FabricObject): void => {
      const rect = objectRectMm(obj);
      const anchorMm = { x: rect.left + rect.width, y: rect.top + rect.height };
      const point = mmToDomPoint(anchorMm.x, anchorMm.y, canvas, cachedCanvasRect);
      if (boxRef.current) {
        // translate +8px x/y pra afastar da alça de resize do canto.
        boxRef.current.style.transform = `translate(${point.x + 8}px, ${point.y + 8}px)`;
      }
    };

    const recompute = (): void => {
      const start = gestureRef.current;
      if (!start) return;
      const target = resolveSingleTarget(canvas);
      if (!target) {
        hide();
        return;
      }
      const text = composeText(target, start.mode);
      if (boxRef.current) {
        boxRef.current.textContent = text;
      }
      positionBox(target);
    };

    const scheduleRecompute = (): void => {
      if (pendingRaf !== null) return;
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;
        recompute();
      });
    };

    /**
     * Captura estado inicial no primeiro evento moving/scaling do gesto.
     * Eventos subsequentes apenas atualizam o conteúdo via recompute.
     */
    const startGestureIfNeeded = (mode: GestureMode): void => {
      if (gestureRef.current) return;
      const target = resolveSingleTarget(canvas);
      if (!target) return;
      const rect = objectRectMm(target);
      gestureRef.current = {
        mode,
        cxMm: rect.left + rect.width / 2,
        cyMm: rect.top + rect.height / 2,
      };
      // Primeira aparição: setState pra montar o div, com texto inicial via JSX.
      // Após a 1ª render, ref existe e textContent passa a ser fonte da verdade.
      setInitialText(composeText(target, mode));
      setActive(true);
      // Posicionamento direto via ref vai falhar na 1ª passagem (ref ainda null).
      // Agendamos um recompute pra rodar após o React montar o div.
      scheduleRecompute();
    };

    const onMoving = (): void => {
      startGestureIfNeeded('drag');
      scheduleRecompute();
    };
    const onScaling = (): void => {
      startGestureIfNeeded('resize');
      scheduleRecompute();
    };
    const onMouseUp = (): void => hide();
    const onSelectionCleared = (): void => hide();
    const onResize = (): void => {
      cachedCanvasRect = canvas.getElement().getBoundingClientRect();
      scheduleRecompute();
    };

    canvas.on('object:moving', onMoving);
    canvas.on('object:scaling', onScaling);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('after:render', scheduleRecompute);
    window.addEventListener('resize', onResize);

    return () => {
      canvas.off('object:moving', onMoving);
      canvas.off('object:scaling', onScaling);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.off('after:render', scheduleRecompute);
      window.removeEventListener('resize', onResize);
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      gestureRef.current = null;
    };
    // engineRef.current pode mudar entre boots, mas o efeito só roda quando
    // o componente é montado/desmontado pelo parent (ready flag).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMetricsEnabled]);

  if (!active) return null;

  return (
    <div
      ref={boxRef}
      data-testid="live-metrics-overlay"
      className="pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-ink-900/85 px-2 py-1 font-mono text-[11px] text-ink-100 tabular-nums shadow-md"
    >
      {initialText}
    </div>
  );
}
