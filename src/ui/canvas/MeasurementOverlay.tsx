/**
 * MeasurementOverlay.tsx (Onda 7b, Fase E) — caixinhas DOM com distância V/H.
 *
 * Híbrido por decisão (resposta da Pergunta 1 do plano da Fase E):
 *   - Linhas conectoras "L" vivem dentro do Fabric (CanvasEngine.renderMeasurementLines)
 *     → acompanham zoom/pan/drag automaticamente.
 *   - Caixinhas com texto vivem no DOM (este componente)
 *     → JetBrains Mono / tabular-nums nítido com CSS.
 *
 * Performance (Risco 2): durante object:moving (60fps), nada de setState. A
 * posição das caixinhas é aplicada via style.transform direto no ref. setState
 * só acontece em mudança de seleção/modo (eventos discretos).
 *
 * Reposicionamento dispara em 4 fontes de mudança:
 *   1. selection:created/updated/cleared  → entra/sai do estado "2 selecionados"
 *   2. object:moving                      → arrastar
 *   3. after:render                       → cobre zoom/pan (única fonte de
 *                                           verdade pós-viewport-change no Fabric)
 *   4. window resize                      → invalida cache de boundingClientRect
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as fabric from 'fabric';

import { CanvasEngine, isBaseObject } from '@/core/canvas/canvas-engine';
import { computeDistance } from '@/core/canvas/alignment/distance-calculator';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';
import { mmToPx, pxToMm } from '@/core/canvas/units';
import { useCanvasStore } from '@/stores/canvas-store';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Bbox em mm de um filho dentro de ActiveSelection. `child.left/top` é
 * relativo ao centro do grupo; `getBoundingRect()` é canvas-absolute.
 * Mesmo helper de AlignmentToolbar (Onda 7b Fase D).
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

/**
 * Resolve a tupla [rectA, rectB] em mm a partir do estado atual de seleção,
 * ou null quando não há exatamente 2 user-objects selecionados.
 *
 * - 0/1/3+ selecionados → null
 * - 2 selecionados (sempre via ActiveSelection em Fabric 6) → tupla
 * - inclui base SVG na contagem? Não: a base não é selecionável, então
 *   nunca aparece em ActiveSelection. Mas defendemos via filtro mesmo assim.
 */
function readSelectedPair(canvas: fabric.Canvas): [RectMm, RectMm] | null {
  const active = canvas.getActiveObject();
  if (!active) return null;

  if (active instanceof fabric.ActiveSelection) {
    const children = active.getObjects().filter((o) => !isBaseObject(o));
    if (children.length !== 2) return null;
    return [activeSelectionChildToRectMm(children[0]), activeSelectionChildToRectMm(children[1])];
  }

  // Objeto único selecionado (não é o que esperamos, mas por completude).
  return null;
}

/**
 * Ponto na viewport DOM correspondente a (xMm, yMm) no espaço do produto.
 * Aplica viewportTransform do Fabric (zoom + translate) e soma o offset
 * do <canvas> na janela.
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
  // Fabric matriz [a, b, c, d, e, f] aplica como (a*x + c*y + e, b*x + d*y + f).
  // Para zoom+translate puros (b=c=0): (a*x + e, d*y + f).
  const xCanvas = vpt[0] * xPx + vpt[4];
  const yCanvas = vpt[3] * yPx + vpt[5];
  return {
    x: canvasRect.left + xCanvas,
    y: canvasRect.top + yCanvas,
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function MeasurementOverlay({ engineRef }: Props): React.ReactElement | null {
  const measurementMode = useCanvasStore((s) => s.measurementMode);
  // hasPair = "modo ligado E exatamente 2 selecionados". Estado discreto,
  // não muda durante drag — só em selection:* events.
  const [hasPair, setHasPair] = useState(false);
  // Texto inicial das caixinhas (1ª render, antes dos refs existirem).
  // Durante drag NÃO usamos setText — manipulamos textContent direto no ref.
  const [initialText, setInitialText] = useState<{ v: string; h: string }>({ v: '', h: '' });

  const boxVRef = useRef<HTMLDivElement | null>(null);
  const boxHRef = useRef<HTMLDivElement | null>(null);
  /**
   * Flag de "primeira aparição do par" — evita setState em drags subsequentes.
   * Resetado quando o par some (selection cleared, modo desligado, etc).
   */
  const firstShowRef = useRef(true);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;

    // Cache do rect do <canvas> na viewport. Invalidado em window resize.
    let cachedCanvasRect: DOMRect = canvas.getElement().getBoundingClientRect();

    // rAF batching — coalesce múltiplas fontes (after:render + object:moving)
    // que disparam no mesmo frame.
    let pendingRaf: number | null = null;

    /**
     * Recalcula posição das 2 caixinhas + texto de distância + linhas Fabric.
     * Chamado em:
     *   - object:moving (durante drag)
     *   - after:render (depois de qualquer requestRenderAll → cobre zoom e pan)
     *   - selection:* (mudança de quem está selecionado)
     *   - window resize
     *
     * Fluxo:
     *   1. lê par de rects via readSelectedPair
     *   2. se modo desligado OU sem par → esconde caixinhas + limpa linhas
     *   3. com par válido → calcula distance, posiciona caixinhas, renderiza
     *      linhas no Fabric via engine.renderMeasurementLines()
     */
    const recompute = (): void => {
      const pair = readSelectedPair(canvas);
      const shouldShow = measurementMode && pair !== null;

      if (!shouldShow) {
        engine.clearMeasurementLines();
        // setHasPair(false) só dispara re-render se já era true (React faz dedup).
        setHasPair(false);
        // Reset: próxima aparição volta a ser "primeira".
        firstShowRef.current = true;
        return;
      }

      const [a, b] = pair;
      const distance = computeDistance(a, b);

      // Linhas Fabric — engine cuida de criar/atualizar idempotente.
      engine.renderMeasurementLines(a, b);

      // Posições das caixinhas no espaço do produto (mm) — meio dos lados do "L":
      //   Caixa H: meio horizontal entre os 2 centros, no Y de A.
      //   Caixa V: na coluna de B, meio vertical entre A e B.
      const cxA = a.left + a.width / 2;
      const cyA = a.top + a.height / 2;
      const cxB = b.left + b.width / 2;
      const cyB = b.top + b.height / 2;

      const hMidMm = { x: (cxA + cxB) / 2, y: cyA };
      const vMidMm = { x: cxB, y: (cyA + cyB) / 2 };

      const hPoint = mmToDomPoint(hMidMm.x, hMidMm.y, canvas, cachedCanvasRect);
      const vPoint = mmToDomPoint(vMidMm.x, vMidMm.y, canvas, cachedCanvasRect);

      // Posicionamento via style.transform direto no DOM — sem setState.
      // -50%, -50% centra a caixinha no ponto.
      if (boxHRef.current) {
        boxHRef.current.style.transform = `translate(${hPoint.x}px, ${hPoint.y}px) translate(-50%, -50%)`;
        boxHRef.current.textContent = `H: ${distance.h.toFixed(1)}mm`;
      }
      if (boxVRef.current) {
        boxVRef.current.style.transform = `translate(${vPoint.x}px, ${vPoint.y}px) translate(-50%, -50%)`;
        boxVRef.current.textContent = `V: ${distance.v.toFixed(1)}mm`;
      }

      // Sincroniza estado React só na primeira aparição do par. Em drags
      // subsequentes, firstShowRef === false → não chamamos setState.
      // textContent já foi setado direto via ref acima — exceto na 1ª render,
      // quando os divs ainda não existem (setHasPair vai montá-los). Por isso
      // initialText carrega texto inicial via JSX. As renders subsequentes
      // sobrescrevem via textContent direto (linha 199, 203).
      if (firstShowRef.current) {
        firstShowRef.current = false;
        setHasPair(true);
        setInitialText({
          v: `V: ${distance.v.toFixed(1)}mm`,
          h: `H: ${distance.h.toFixed(1)}mm`,
        });
        // Após o React montar os divs, dispara mais um recompute pra aplicar
        // transform via ref (que ainda era null nesta passagem). after:render
        // do Fabric também cobre isso indiretamente, mas garantia explícita.
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

    // Roda 1× pra inicializar com o estado atual (caso a seleção já exista
    // quando o componente monta, ou quando o modo é ligado com par presente).
    scheduleRecompute();

    return () => {
      canvas.off('selection:created', scheduleRecompute);
      canvas.off('selection:updated', scheduleRecompute);
      canvas.off('selection:cleared', scheduleRecompute);
      canvas.off('object:moving', scheduleRecompute);
      canvas.off('after:render', scheduleRecompute);
      window.removeEventListener('resize', onResize);
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      // Limpa linhas ao desmontar — protege contra modo persistido entre
      // remontes do componente (HMR em dev, ou unmount real).
      engine.clearMeasurementLines();
    };
    // measurementMode entra na deps pra rebobinar listeners quando muda;
    // hasPair NÃO entra (lido como closure stale, mas só usado em comparações
    // baratas — re-render quando muda já dispara este efeito de novo via deps).
    // engineRef.current pode mudar entre boots, mas o efeito só roda quando
    // o componente é montado/desmontado pelo parent (ready flag) — refs não
    // disparam re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode]);

  if (!hasPair) return null;

  return (
    <>
      <div
        ref={boxHRef}
        data-testid="measurement-h"
        className="pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-ink-900/80 px-1.5 py-1 font-mono text-[11px] text-ink-200 tabular-nums shadow-sm"
      >
        {initialText.h}
      </div>
      <div
        ref={boxVRef}
        data-testid="measurement-v"
        className="pointer-events-none fixed left-0 top-0 z-50 rounded-sm bg-ink-900/80 px-1.5 py-1 font-mono text-[11px] text-ink-200 tabular-nums shadow-sm"
      >
        {initialText.v}
      </div>
    </>
  );
}
