import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import {
  DEV_TEST_PATTERN_ID,
  DEV_TEST_PRODUCT_ID,
  DEV_VIEWPORT,
} from '@/core/canvas/dev-constants';
import { attachCanvasKeybindings } from '@/core/canvas/keybindings';
import { MM_TO_PX } from '@/core/canvas/units';
import { getById as getMaterialById } from '@/data/repositories/materialRepository';
import { resolveAssetUrl } from '@/data/repositories/materialRepository';
import { getPatternById, upsertPatternCanvas } from '@/data/repositories/patternRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';
import { useCanvasStore } from '@/stores/canvas-store';
import { Button } from '@/ui/components/button';
import { LoadPatternDialog } from './canvas-test/LoadPatternDialog';
import { ModeToggle } from './canvas-test/ModeToggle';
import { OperatorInputs } from './canvas-test/OperatorInputs';
import { SaveAsPatternDialog } from './canvas-test/SaveAsPatternDialog';
import { UnifiedRightPanel } from './canvas-test/UnifiedRightPanel';
import { SlotCreatorButtons } from './canvas-test/SlotCreatorButtons';

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
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);

  const { mode, setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind } = useCanvasStore();

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

        // ADR 013: base_svg comes from the DB (seeded from fixture), not a static fetch.
        // p.baseSvg is already returned by productRepository.getProductById().
        if (!p.baseSvg) {
          throw new Error(
            `Product '${DEV_TEST_PRODUCT_ID}' has no base_svg in the database. Re-seed the DB.`
          );
        }
        if (cancelled) {
          engine.dispose();
          return;
        }
        // Parse + validate through all 6 gates before touching the canvas.
        // parseCorelSvg throws user-readable errors for any quality issue —
        // the catch block below surfaces them via toast so the user knows exactly
        // what to fix in Corel before re-exporting.
        const meta = parseCorelSvg(p.baseSvg);
        await engine.loadProductSvgFromMeta(meta);
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
              // Collect materialIds present in layers for pre-loading.
              const layers = existing.canvasJson.capi?.layers ?? [];
              const matEntries: Array<{ id: string; url: string }> = [];

              await engine.deserialize(
                {
                  version: existing.canvasJson.version,
                  objects: existing.canvasJson.objects as Array<Record<string, unknown>>,
                  capi: {
                    productId: p.id,
                    units: 'mm',
                    schemaVersion: existing.canvasJson.capi?.schemaVersion ?? 1,
                    layers,
                  },
                },
                // Re-apply material Patterns from saved materialIds.
                async (materialId) => {
                  const mat = await getMaterialById(materialId);
                  if (!mat) throw new Error(`Material not found: ${materialId}`);
                  const url = await resolveAssetUrl(mat);
                  matEntries.push({ id: materialId, url });
                  return url;
                }
              );

              // Pre-warm the image cache with the materials we already resolved
              // during deserialize — zero additional IPC calls.
              if (matEntries.length > 0) {
                await engine.preloadMaterials(matEntries);
              }
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

        engine.loadSlotsFromCanvas();
        engine.onSlotSelectionChange = setSelectedSlotId;
        engine.onLayerSelectionChange = (id, meta) => {
          setSelectedLayerId(id);
          setSelectedLayerKind(meta?.kind ?? null);
        };
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
    // Zustand setters are stable references — listing them satisfies exhaustive-deps
    // without causing re-runs.
  }, [setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind]);

  // Sync Zustand mode → canvas engine whenever mode changes.
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.setMode(mode);
  }, [mode, ready]);

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
    setSelectedLayerId(null);
    setSelectedLayerKind(null);
  }

  async function handleLoadPattern(patternId: string): Promise<void> {
    const engine = engineRef.current;
    const p = productRef.current;
    if (!engine || !p) return;

    const { getPatternById: loadPattern } = await import('@/data/repositories/patternRepository');
    const pattern = await loadPattern(patternId);
    if (!pattern?.canvasJson) return;

    const layers = pattern.canvasJson.capi?.layers ?? [];
    await engine.deserialize(
      {
        version: pattern.canvasJson.version,
        objects: pattern.canvasJson.objects as Array<Record<string, unknown>>,
        capi: {
          productId: p.id,
          units: 'mm',
          schemaVersion: pattern.canvasJson.capi?.schemaVersion ?? 2,
          layers,
        },
      },
      async (materialId) => {
        const { getById: getMat, resolveAssetUrl: resolveUrl } =
          await import('@/data/repositories/materialRepository');
        const mat = await getMat(materialId);
        if (!mat) throw new Error(`Material not found: ${materialId}`);
        return resolveUrl(mat);
      }
    );
    engine.loadSlotsFromCanvas();
    setSelectedLayerId(null);
    setSelectedLayerKind(null);
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
        <ModeToggle />

        <SlotCreatorButtons engineRef={engineRef} disabled={!ready} />

        <div className="h-4 w-px bg-ink-700" />

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

        <div className="h-4 w-px bg-ink-700" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveAsOpen(true)}
          disabled={!ready}
          className="font-mono text-[11px]"
        >
          Salvar como padrão
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLoadOpen(true)}
          disabled={!ready}
          className="font-mono text-[11px]"
        >
          Abrir padrão
        </Button>
        <span className="ml-auto font-mono text-[11px] text-ink-500">
          Ctrl+S salvar · Ctrl+= zoom · Ctrl+0 reset · Space+drag pan
        </span>
      </div>

      {/* 3-column layout: canvas | UnifiedRightPanel | OperatorInputs */}
      <div className="flex flex-1 overflow-hidden">
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
        {/* UnifiedRightPanel: always visible, 3 tabs (Apliques | Materiais | Camadas) */}
        <UnifiedRightPanel engineRef={engineRef} />
        {/* OperatorInputs: visible only in operator mode */}
        {mode === 'operator' && <OperatorInputs engineRef={engineRef} />}
      </div>

      {/* Dialogs — Onda 8, Checkpoint C */}
      {/* productId uses `product` state (not productRef.current) to avoid
          reading refs during render (react-hooks/refs lint rule).
          getCanvasJson is a stable callback — engineRef.current is read
          inside the callback body (at call time, not at render time). */}
      <SaveAsPatternDialog
        open={saveAsOpen}
        productId={product?.id ?? ''}
        getCanvasJson={() => {
          const engine = engineRef.current;
          const p = productRef.current;
          if (!engine || !p) return '';
          return JSON.stringify(engine.serialize(p.id));
        }}
        onClose={() => setSaveAsOpen(false)}
        onSaved={() => setSaveAsOpen(false)}
      />
      <LoadPatternDialog
        open={loadOpen}
        productId={product?.id ?? DEV_TEST_PRODUCT_ID}
        onClose={() => setLoadOpen(false)}
        onLoad={handleLoadPattern}
      />

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
