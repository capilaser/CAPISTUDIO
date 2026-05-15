/**
 * NovoPedidoCanvasArea — área central (canvas) do editor (Onda 12 F4.3).
 *
 * 2 estados:
 *  - selection=null → placeholder "Escolha um produto na sidebar esquerda"
 *  - selection=obj  → instancia useCanvasEngine, carrega base SVG + aplica material
 *
 * Engine vive aqui (encapsulado) porque é um detalhe interno desta área.
 * Quando produto muda (Estado B → editar → Estado A → confirma de novo), o
 * EngineHost desmonta e re-monta — engine.dispose() roda limpo.
 */
import { useEffect } from 'react';

import {
  resolveAssetUrl,
  getById as getMaterialById,
} from '@/data/repositories/materialRepository';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';

import type { ProductSelection } from './NovoPedidoSidebar';

const VIEWPORT = { widthPx: 900, heightPx: 600 };

interface Props {
  selection: ProductSelection | null;
}

export function NovoPedidoCanvasArea({ selection }: Props) {
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

  // Re-monta com key=productId+materialId pra forçar dispose+remount quando
  // troca de produto (mais simples que tentar trocar engine in-place).
  return (
    <EngineHost key={`${selection.productId}-${selection.materialId}`} selection={selection} />
  );
}

function EngineHost({ selection }: { selection: ProductSelection }) {
  const { canvasRef, engineRef, ready, error } = useCanvasEngine({
    productId: selection.productId,
    // patternId undefined = canvas vazio (sem padrão pré-carregado).
    // Pedido nasce do zero; o usuário adiciona camadas via "+ Adicionar".
    patternId: undefined,
    viewport: VIEWPORT,
    mode: 'operator',
  });

  // Quando engine fica pronto, aplica material na base.
  useEffect(() => {
    if (!ready) return;
    const engine = engineRef.current;
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
  }, [ready, engineRef, selection.materialId]);

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
