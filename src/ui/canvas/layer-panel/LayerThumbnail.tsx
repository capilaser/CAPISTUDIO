/**
 * LayerThumbnail — Onda 26.
 *
 * Mini-preview 32x32 (CSS) / 64x64 (raster) da camada, gerado via
 * `fabricObj.toDataURL({ multiplier })`. Estilo Photoshop/Figma.
 *
 * Estratégia:
 *  - Resolve o fabric obj via `engine.getObjectById(layerId)`.
 *  - Computa multiplier = 64 / maxDim(obj) — render em 64px no maior lado.
 *  - Re-renderiza quando `revision` muda (controlado pelo LayerPanel:
 *    incrementa em layer-meta-changed, object:modified, object:added).
 *  - Debounce embutido (150ms) pra não pesar em moves rápidos.
 *  - Cache local por id+revision (1 entrada). Se id ou rev mudar, re-render.
 *
 * Fallback: quadrado vazio com ícone genérico quando obj não encontrado
 * (ainda carregando, ou layer-só-meta sem fabric counterpart).
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Square } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  layerId: string;
  /** Incrementa pra forçar re-render. Controlado pelo LayerPanel. */
  revision: number;
  /** Tamanho CSS em px (default 32). */
  size?: number;
}

export function LayerThumbnail({
  engineRef,
  layerId,
  revision,
  size = 32,
}: Props): React.ReactElement {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    // Debounce: muitas mudanças seguidas (drag, scale) só geram 1 thumb.
    timerRef.current = window.setTimeout(() => {
      const engine = engineRef.current;
      if (!engine) {
        setDataUrl(null);
        return;
      }
      const obj = engine.getObjectById(layerId);
      if (!obj) {
        setDataUrl(null);
        return;
      }

      // Dimensão real do objeto pós-scale.
      const w = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const h = (obj.height ?? 0) * (obj.scaleY ?? 1);
      const maxDim = Math.max(w, h);
      if (maxDim <= 0) {
        setDataUrl(null);
        return;
      }

      // Render 2x o size CSS pra HiDPI (32 CSS → 64 raster).
      const targetPx = size * 2;
      const multiplier = targetPx / maxDim;

      try {
        const url = obj.toDataURL({
          multiplier,
          format: 'png',
          enableRetinaScaling: false,
        });
        setDataUrl(url);
      } catch {
        // toDataURL pode falhar em objetos com pattern/clipPath corrompido.
        // Fallback silencioso — UI mostra placeholder.
        setDataUrl(null);
      }
    }, 150);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [engineRef, layerId, revision, size]);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-ink-700 bg-ink-900"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          className="max-h-full max-w-full object-contain"
          style={{
            imageRendering: 'crisp-edges',
          }}
        />
      ) : (
        <Square className="h-3.5 w-3.5 text-ink-600" />
      )}
    </div>
  );
}
