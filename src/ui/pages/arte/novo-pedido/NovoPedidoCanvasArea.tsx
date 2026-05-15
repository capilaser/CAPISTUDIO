/**
 * NovoPedidoCanvasArea — área central (canvas) do editor (Onda 12 F4.3+F5).
 *
 * 2 estados:
 *  - selection=null → placeholder "Escolha um produto na sidebar esquerda"
 *  - selection=obj  → instancia useCanvasEngine, carrega base SVG + aplica material
 *
 * engineRef é exposto via prop para que NovoPedidoPage possa passar ao
 * BancoDrawer e ao TextoItem sem prop drilling pelo EngineHost.
 */
import { useEffect, type RefObject } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  resolveAssetUrl,
  getById as getMaterialById,
} from '@/data/repositories/materialRepository';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';

import type { ProductSelection } from './NovoPedidoSidebar';

const VIEWPORT = { widthPx: 900, heightPx: 600 };

interface Props {
  selection: ProductSelection | null;
  /** Ref compartilhada com a página para que BancoDrawer/TextoItem acessem o engine. */
  engineRef: RefObject<CanvasEngine | null>;
}

export function NovoPedidoCanvasArea({ selection, engineRef }: Props) {
  if (selection === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            Escolha um produto na sidebar esquerda
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/70">→</p>
        </div>
      </div>
    );
  }

  return (
    <EngineHost
      key={`${selection.productId}-${selection.materialId}`}
      selection={selection}
      engineRef={engineRef}
    />
  );
}

function EngineHost({
  selection,
  engineRef: externalEngineRef,
}: {
  selection: ProductSelection;
  engineRef: RefObject<CanvasEngine | null>;
}) {
  const {
    canvasRef,
    engineRef: internalEngineRef,
    ready,
    error,
  } = useCanvasEngine({
    productId: selection.productId,
    patternId: undefined,
    viewport: VIEWPORT,
    mode: 'operator',
  });

  // Sincroniza o engineRef interno com o ref externo da página.
  useEffect(() => {
    externalEngineRef.current = internalEngineRef.current;
  });

  useEffect(() => {
    if (!ready) return;
    const engine = internalEngineRef.current;
    if (!engine) return;

    let cancelled = false;
    async function applyMaterial() {
      try {
        const mat = await getMaterialById(selection.materialId);
        if (!mat || cancelled) return;
        const url = await resolveAssetUrl(mat);
        if (cancelled) return;
        await engine!.applyMaterialToBase(mat.id, url);
      } catch (e) {
        console.warn('[NovoPedidoCanvasArea] failed to apply material:', e);
      }
    }
    void applyMaterial();
    return () => {
      cancelled = true;
    };
  }, [ready, internalEngineRef, selection.materialId]);

  return (
    <div className="relative flex flex-1 items-center justify-center bg-background p-6">
      {/* canvas sempre montado — nunca trocar por condicional ou Fabric perde o nó */}
      <canvas
        ref={canvasRef}
        width={VIEWPORT.widthPx}
        height={VIEWPORT.heightPx}
        className="rounded-sm border border-border shadow-md"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <p className="font-mono text-xs text-destructive">Erro: {error}</p>
        </div>
      )}
    </div>
  );
}
