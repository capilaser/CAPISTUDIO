import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  DEV_TEST_PATTERN_ID,
  DEV_TEST_PRODUCT_ID,
  DEV_VIEWPORT,
} from '@/core/canvas/dev-constants';
import { attachCanvasKeybindings } from '@/core/canvas/keybindings';
import { parseViewBox } from '@/core/canvas/svg-utils';
import { MM_TO_PX } from '@/core/canvas/units';
import { Button } from '@/ui/components/button';
import { getPatternById, upsertPatternCanvas } from '@/data/repositories/patternRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';

const TEST_RECT_MM = { width: 20, height: 10 };

export default function CanvasTest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const productRef = useRef<Product | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function handleSave() {
    const engine = engineRef.current;
    const p = productRef.current;
    if (!engine || !p || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const data = engine.serialize(p.id);
      await upsertPatternCanvas(
        DEV_TEST_PATTERN_ID,
        p.id,
        JSON.stringify(data),
        'Dev Test Pattern'
      );
      toast.success('Salvo');
    } catch (e) {
      console.error('[canvas-test] save failed:', e);
      toast.error('Erro ao salvar');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let detachKeys: (() => void) | null = null;

    async function boot() {
      try {
        const p = await getProductById(DEV_TEST_PRODUCT_ID);
        if (!p) {
          setError(`Product '${DEV_TEST_PRODUCT_ID}' not found in database.`);
          return;
        }
        if (cancelled || !canvasRef.current) return;
        productRef.current = p;
        setProduct(p);

        const engine = new CanvasEngine(canvasRef.current, {
          productWidthMm: p.canvasMm.width,
          productHeightMm: p.canvasMm.height,
          viewportWidthPx: DEV_VIEWPORT.widthPx,
          viewportHeightPx: DEV_VIEWPORT.heightPx,
        });

        const svgRes = await fetch(`/products/${DEV_TEST_PRODUCT_ID}.svg`);
        if (!svgRes.ok) {
          throw new Error(`Failed to load product SVG: ${svgRes.status}`);
        }
        const svgString = await svgRes.text();
        if (cancelled) {
          engine.dispose();
          return;
        }
        await engine.loadProductSvg(svgString, parseViewBox(p.viewBox));
        if (cancelled) {
          engine.dispose();
          return;
        }

        // Restore prior state if present.
        const existing = await getPatternById(DEV_TEST_PATTERN_ID);
        if (cancelled) {
          engine.dispose();
          return;
        }
        if (existing?.canvasJson) {
          if ((existing.canvasJson.objects?.length ?? 0) > 0) {
            try {
              await engine.deserialize({
                version: existing.canvasJson.version,
                objects: existing.canvasJson.objects as Array<Record<string, unknown>>,
                capi: {
                  productId: p.id,
                  units: 'mm',
                  layers: [],
                },
              });
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn('[canvas-test] deserialize failed, opening empty:', e);
              }
            }
          }
        } else if (existing === null && import.meta.env.DEV) {
          console.info(
            `[canvas-test] no pattern '${DEV_TEST_PATTERN_ID}' yet — will be created on first save.`
          );
        }

        engineRef.current = engine;
        detachKeys = attachCanvasKeybindings({
          onZoomIn: () => engine.zoomBy(1.1),
          onZoomOut: () => engine.zoomBy(1 / 1.1),
          onZoomReset: () => engine.resetView(),
          onPanStart: () => engine.setPanMode(true),
          onPanEnd: () => engine.setPanMode(false),
          onSave: () => void handleSave(),
        });
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    void boot();

    return () => {
      cancelled = true;
      detachKeys?.();
      engineRef.current?.dispose();
      engineRef.current = null;
      productRef.current = null;
    };
  }, []);

  function handleAddRectangle() {
    const engine = engineRef.current;
    const p = productRef.current;
    if (!engine || !p) return;
    const baseX = (p.canvasMm.width - TEST_RECT_MM.width) / 2;
    const baseY = (p.canvasMm.height - TEST_RECT_MM.height) / 2;
    const jitterX = (Math.random() - 0.5) * 6;
    const jitterY = (Math.random() - 0.5) * 4;
    engine.addRectangle(
      Math.max(1, baseX + jitterX),
      Math.max(1, baseY + jitterY),
      TEST_RECT_MM.width,
      TEST_RECT_MM.height
    );
  }

  function handleClear() {
    engineRef.current?.clearUserObjects();
  }

  return (
    <main className="flex min-h-full flex-col bg-ink-950 text-ink-100">
      <header className="sticky top-0 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-2 font-mono text-xs">
        <span className="text-laser font-medium text-sm">DEV — canvas-test</span>
        <Link to="/" className="text-ink-400 hover:text-ink-200 transition-colors">
          ← home
        </Link>
      </header>

      <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-900/50 px-4 py-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddRectangle}
          disabled={!ready}
          className="font-mono text-[11px]"
        >
          Adicionar retângulo
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={!ready}
          className="font-mono text-[11px]"
        >
          Limpar canvas
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => void handleSave()}
          disabled={!ready || saving}
          className="font-mono text-[11px]"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
        <span className="ml-auto font-mono text-[11px] text-ink-500">
          Ctrl+S salvar · Ctrl+= zoom · Ctrl+0 reset · Space+drag pan
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        {error ? (
          <p className="font-mono text-xs text-danger">error: {error}</p>
        ) : (
          <canvas
            ref={canvasRef}
            width={DEV_VIEWPORT.widthPx}
            height={DEV_VIEWPORT.heightPx}
            className="rounded-sm border border-ink-700 shadow-md"
          />
        )}
      </div>

      <footer className="border-t border-ink-800 bg-ink-900/60 px-4 py-2 font-mono text-[11px] text-ink-400">
        {product ? (
          <span>
            Produto: {product.label} ({product.canvasMm.width}×{product.canvasMm.height}mm) | DPI:{' '}
            {MM_TO_PX}px/mm | Pattern: {DEV_TEST_PATTERN_ID}
          </span>
        ) : (
          <span className="text-ink-600">loading…</span>
        )}
      </footer>
    </main>
  );
}
