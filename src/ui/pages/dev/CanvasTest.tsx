import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  DEV_TEST_PATTERN_ID,
  DEV_TEST_PRODUCT_ID,
  DEV_VIEWPORT,
} from '@/core/canvas/dev-constants';
import { MM_TO_PX } from '@/core/canvas/units';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import { useCanvasStore } from '@/stores/canvas-store';
import { ExportPngDialog } from '@/ui/canvas/ExportPngDialog';
import { CanvasToolbar } from './canvas-test/CanvasToolbar';
import { CanvasWorkspace } from './canvas-test/CanvasWorkspace';
import { LoadPatternDialog } from './canvas-test/LoadPatternDialog';
import { SaveAsPatternDialog } from './canvas-test/SaveAsPatternDialog';

const TEST_RECT_MM = { width: 20, height: 10 };

export default function CanvasTest() {
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [exportPngOpen, setExportPngOpen] = useState(false);

  const { mode } = useCanvasStore();

  const { canvasRef, engineRef, product, ready, error, saving, save, clear, loadPattern } =
    useCanvasEngine({
      productId: DEV_TEST_PRODUCT_ID,
      patternId: DEV_TEST_PATTERN_ID,
      viewport: DEV_VIEWPORT,
      patternLabel: 'Dev Test Pattern',
      mode,
    });

  async function handleSave() {
    try {
      await save();
      toast.success('Salvo');
    } catch (e) {
      console.error('[canvas-test] save failed:', e);
      toast.error('Erro ao salvar');
    }
  }

  function handleAddRectangle() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const baseX = (product.canvasMm.width - TEST_RECT_MM.width) / 2;
    const baseY = (product.canvasMm.height - TEST_RECT_MM.height) / 2;
    const jitterX = (Math.random() - 0.5) * 6;
    const jitterY = (Math.random() - 0.5) * 4;
    engine.addRectangle(
      Math.max(1, baseX + jitterX),
      Math.max(1, baseY + jitterY),
      TEST_RECT_MM.width,
      TEST_RECT_MM.height
    );
  }

  return (
    <main className="flex min-h-full flex-col bg-ink-950 text-ink-100">
      <header className="sticky top-0 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-2 font-mono text-xs">
        <span className="text-laser font-medium text-sm">DEV — canvas-test</span>
        <Link to="/" className="text-ink-400 hover:text-ink-200 transition-colors">
          ← home
        </Link>
      </header>

      <CanvasToolbar
        engineRef={engineRef}
        ready={ready}
        saving={saving}
        onSave={() => void handleSave()}
        onClear={clear}
        onSaveAs={() => setSaveAsOpen(true)}
        onLoad={() => setLoadOpen(true)}
        onExportPng={() => setExportPngOpen(true)}
        onAddRectangle={handleAddRectangle}
      />

      <CanvasWorkspace
        canvasRef={canvasRef}
        engineRef={engineRef}
        ready={ready}
        error={error}
        viewport={DEV_VIEWPORT}
        showOperatorInputs={mode === 'operator'}
      />

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
          if (!engine || !product) return '';
          // Onda 13: serialize agora recebe items[]. SaveAsPattern = 1 item base.
          return JSON.stringify(
            engine.serialize([{ productId: product.id, offsetX: 0, offsetY: 0 }])
          );
        }}
        onClose={() => setSaveAsOpen(false)}
        onSaved={() => setSaveAsOpen(false)}
      />
      <LoadPatternDialog
        open={loadOpen}
        productId={product?.id ?? DEV_TEST_PRODUCT_ID}
        onClose={() => setLoadOpen(false)}
        onLoad={loadPattern}
      />
      <ExportPngDialog
        open={exportPngOpen}
        getEngine={() => engineRef.current}
        onClose={() => setExportPngOpen(false)}
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
