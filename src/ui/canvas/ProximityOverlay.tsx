/**
 * ProximityOverlay.tsx (Onda 7b, Fase E2) — distâncias do objeto selecionado
 * pra coisa mais próxima em cada uma das 4 direções.
 *
 * Aparece sempre que houver EXATAMENTE 1 objeto selecionado (independente
 * do Ruler). Some quando há 0 ou 2+ selecionados — esses casos são domínio
 * do MeasurementOverlay (Fase E) ou de "nada" (0).
 *
 * Padrão híbrido idêntico ao da Fase E:
 *   - 4 fabric.Line violeta (#a78bfa) tracejadas dentro do Fabric, criadas
 *     via engine.renderProximityLines (acompanham zoom/pan automaticamente).
 *   - 4 caixinhas DOM com texto JetBrains Mono / tabular-nums.
 *
 * Performance: durante object:moving, posição via style.transform direto
 * no ref + textContent direto. setState só na transição "0/2+ → 1".
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as fabric from 'fabric';

import { CanvasEngine, isBaseObject } from '@/core/canvas/canvas-engine';
import {
  computeProximity,
  type ProximityResult,
} from '@/core/canvas/alignment/proximity-calculator';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';
import { getCapiId } from '@/core/canvas/capi-id';
import { mmToPx, pxToMm } from '@/core/canvas/units';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Bbox em mm de um objeto solto. Igual ao helper da AlignmentToolbar /
 * MeasurementOverlay — duplicado aqui pra manter os componentes UI
 * independentes (custo baixo, evita arquivo de utils compartilhado).
 */
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
 * Resolve target único selecionado, ou null. Critério:
 *   - 0 selecionados ou ActiveSelection (2+) → null
 *   - 1 selecionado e !isBaseObject e tem capi id → { rect, id }
 *
 * Quando há 2+, MeasurementOverlay assume; aqui retornamos null pra ele
 * cuidar (Fase E). Quando há 0, ambos retornam null.
 */
function readSelectedTarget(canvas: fabric.Canvas): { rect: RectMm; id: string } | null {
  const active = canvas.getActiveObject();
  if (!active) return null;
  if (active instanceof fabric.ActiveSelection) return null;
  if (isBaseObject(active)) return null;

  const id = getCapiId(active as unknown as Record<string, unknown>);
  if (!id) return null;

  return { rect: fabricObjectToRectMm(active), id };
}

/**
 * Ponto na viewport DOM correspondente a (xMm, yMm) no espaço do produto.
 * Mesma lógica do MeasurementOverlay — aplica viewportTransform do Fabric +
 * offset do <canvas> na viewport.
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
  return { x: canvasRect.left + xCanvas, y: canvasRect.top + yCanvas };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ProximityOverlay({ engineRef }: Props): React.ReactElement | null {
  const [hasTarget, setHasTarget] = useState(false);
  // Texto inicial das 4 caixinhas. Drags subsequentes vão direto via ref.
  const [initialText, setInitialText] = useState<{
    top: string;
    bottom: string;
    left: string;
    right: string;
  }>({ top: '', bottom: '', left: '', right: '' });

  const boxTopRef = useRef<HTMLDivElement | null>(null);
  const boxBottomRef = useRef<HTMLDivElement | null>(null);
  const boxLeftRef = useRef<HTMLDivElement | null>(null);
  const boxRightRef = useRef<HTMLDivElement | null>(null);
  /**
   * Flag de "primeira aparição do target" — evita setState em drags
   * subsequentes. Resetado quando o target some (selection cleared,
   * 2+ selecionados, etc.).
   */
  const firstShowRef = useRef(true);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;

    let cachedCanvasRect: DOMRect = canvas.getElement().getBoundingClientRect();
    let pendingRaf: number | null = null;

    const recompute = (): void => {
      const target = readSelectedTarget(canvas);

      if (!target) {
        engine.clearProximityLines();
        setHasTarget(false);
        firstShowRef.current = true;
        return;
      }

      // Coleta obstáculos: tudo com capi id, exceto o próprio target.
      const allMeasurable = engine.getMeasurableObjects();
      const others = allMeasurable.filter((m) => m.id !== target.id).map((m) => m.rect);

      const canvasBounds: RectMm = {
        left: 0,
        top: 0,
        width: engine.config.productWidthMm,
        height: engine.config.productHeightMm,
      };

      const result: ProximityResult = computeProximity({
        target: target.rect,
        others,
        canvasBounds,
      });

      // Linhas Fabric — engine cuida de criar/atualizar idempotente.
      engine.renderProximityLines(target.rect, result);

      // Posições das 4 caixinhas no espaço do produto (mm) — meio de cada
      // segmento de medição:
      //   top:    centro horizontal do target, meio entre target.top e (target.top - dist)
      //   bottom: centro horizontal do target, meio entre target.bottom e (target.bottom + dist)
      //   left:   centro vertical do target, meio entre target.left e (target.left - dist)
      //   right:  centro vertical do target, meio entre target.right e (target.right + dist)
      const cx = target.rect.left + target.rect.width / 2;
      const cy = target.rect.top + target.rect.height / 2;
      const tLeft = target.rect.left;
      const tRight = target.rect.left + target.rect.width;
      const tTop = target.rect.top;
      const tBottom = target.rect.top + target.rect.height;

      const points = {
        top: { xMm: cx, yMm: tTop - result.top / 2 },
        bottom: { xMm: cx, yMm: tBottom + result.bottom / 2 },
        left: { xMm: tLeft - result.left / 2, yMm: cy },
        right: { xMm: tRight + result.right / 2, yMm: cy },
      };

      const dom = {
        top: mmToDomPoint(points.top.xMm, points.top.yMm, canvas, cachedCanvasRect),
        bottom: mmToDomPoint(points.bottom.xMm, points.bottom.yMm, canvas, cachedCanvasRect),
        left: mmToDomPoint(points.left.xMm, points.left.yMm, canvas, cachedCanvasRect),
        right: mmToDomPoint(points.right.xMm, points.right.yMm, canvas, cachedCanvasRect),
      };

      const labels = {
        top: `${result.top.toFixed(1)}mm`,
        bottom: `${result.bottom.toFixed(1)}mm`,
        left: `${result.left.toFixed(1)}mm`,
        right: `${result.right.toFixed(1)}mm`,
      };

      // Aplica posição + texto direto via ref (zero re-render React em drag).
      const apply = (
        ref: HTMLDivElement | null,
        point: { x: number; y: number },
        label: string
      ): void => {
        if (!ref) return;
        ref.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
        ref.textContent = label;
      };
      apply(boxTopRef.current, dom.top, labels.top);
      apply(boxBottomRef.current, dom.bottom, labels.bottom);
      apply(boxLeftRef.current, dom.left, labels.left);
      apply(boxRightRef.current, dom.right, labels.right);

      // Sincroniza estado React só na primeira aparição. Texto inicial
      // pelo JSX cobre o frame em que os refs ainda são null.
      if (firstShowRef.current) {
        firstShowRef.current = false;
        setHasTarget(true);
        setInitialText(labels);
        // Após o React montar os divs, dispara mais um recompute pra aplicar
        // transform via ref (que ainda era null nesta passagem).
        scheduleRecompute();
      }
    };

    const scheduleRecompute = (): void => {
      if (pendingRaf !== null) return;
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;
        recompute();
      });
    };

    const onResize = (): void => {
      cachedCanvasRect = canvas.getElement().getBoundingClientRect();
      scheduleRecompute();
    };

    canvas.on('selection:created', scheduleRecompute);
    canvas.on('selection:updated', scheduleRecompute);
    canvas.on('selection:cleared', scheduleRecompute);
    canvas.on('object:moving', scheduleRecompute);
    canvas.on('after:render', scheduleRecompute);
    window.addEventListener('resize', onResize);

    // Roda 1× no mount pra inicializar com estado atual.
    scheduleRecompute();

    return () => {
      canvas.off('selection:created', scheduleRecompute);
      canvas.off('selection:updated', scheduleRecompute);
      canvas.off('selection:cleared', scheduleRecompute);
      canvas.off('object:moving', scheduleRecompute);
      canvas.off('after:render', scheduleRecompute);
      window.removeEventListener('resize', onResize);
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      // Limpa linhas ao desmontar — protege contra HMR ou unmount real.
      engine.clearProximityLines();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasTarget) return null;

  // 4 caixinhas. Mesma classe da Fase E. Posicionamento via style.transform
  // aplicado dentro do recompute (acima).
  const boxClass =
    'pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-ink-900/80 px-1.5 py-1 font-mono text-[11px] text-ink-200 tabular-nums shadow-sm';

  return (
    <>
      <div ref={boxTopRef} data-testid="proximity-top" className={boxClass}>
        {initialText.top}
      </div>
      <div ref={boxBottomRef} data-testid="proximity-bottom" className={boxClass}>
        {initialText.bottom}
      </div>
      <div ref={boxLeftRef} data-testid="proximity-left" className={boxClass}>
        {initialText.left}
      </div>
      <div ref={boxRightRef} data-testid="proximity-right" className={boxClass}>
        {initialText.right}
      </div>
    </>
  );
}
