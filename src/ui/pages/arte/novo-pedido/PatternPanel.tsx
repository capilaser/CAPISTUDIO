/**
 * PatternPanel — Onda 13.9
 *
 * Aba "Padrões" do BancoDrawer no editor multi-broche. Lista padrões
 * compatíveis com o produto do broche ativo. Click aplica o canvasJson do
 * pattern sobre o broche ativo (objetos do pattern entram deslocados pelo
 * offset do broche).
 *
 * Diferença pro LoadPatternDialog (Onda 8, canvas-test):
 *   - LoadPatternDialog substitui o canvas inteiro (single-product).
 *   - PatternPanel ADICIONA os objetos do pattern sobre o broche ativo —
 *     mantém os outros broches da prancha intactos.
 *
 * Usa `engine.applyPatternObjects()` em vez de `engine.deserialize()`.
 */
import { useEffect, useState, type RefObject } from 'react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  getPatternById,
  listByProduct,
  type PatternListItem,
} from '@/data/repositories/patternRepository';
import {
  resolveAssetUrl,
  getById as getMaterialById,
} from '@/data/repositories/materialRepository';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /** Produto do broche ativo. Null = nenhum broche selecionado. */
  activeProductId: string | null;
  /** Offset do broche ativo na prancha (mm). Padrão (0,0) = broche único na origem. */
  activeOffsetMm: { leftMm: number; topMm: number };
  /** Pattern atualmente aplicado no broche (mostrado destacado). */
  activePatternId?: string | null;
  /** Callback chamado após aplicar o pattern. */
  onApplied?: (patternId: string) => void;
  /** Variante compacta pra caber na sidebar de 260px. Default false. */
  compact?: boolean;
}

export function PatternPanel({
  engineRef,
  activeProductId,
  activeOffsetMm,
  activePatternId = null,
  onApplied,
  compact = false,
}: Props) {
  const [patterns, setPatterns] = useState<PatternListItem[]>([]);
  // loading começa true só quando há produto pra buscar.
  const [loading, setLoading] = useState(activeProductId !== null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProductId) return;
    let cancelled = false;
    listByProduct(activeProductId)
      .then((rows) => {
        if (!cancelled) {
          setPatterns(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[PatternPanel] listByProduct error:', err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProductId]);

  async function handleApply(patternId: string) {
    if (applyingId) return;
    const engine = engineRef.current;
    if (!engine) {
      toast.error('Canvas não está pronto.');
      return;
    }
    setApplyingId(patternId);
    try {
      const pattern = await getPatternById(patternId);
      if (!pattern) {
        toast.error('Padrão não encontrado.');
        return;
      }
      if (!pattern.canvasJson) {
        toast.error('Padrão sem canvas salvo.');
        return;
      }
      await engine.applyPatternObjects(
        pattern.canvasJson as unknown as Parameters<typeof engine.applyPatternObjects>[0],
        activeOffsetMm,
        async (materialId) => {
          const mat = await getMaterialById(materialId);
          if (!mat) throw new Error(`Material not found: ${materialId}`);
          return resolveAssetUrl(mat);
        }
      );
      toast.success(`Padrão "${pattern.name}" aplicado`);
      onApplied?.(patternId);
    } catch (err) {
      console.error('[PatternPanel] apply error:', err);
      toast.error(`Erro ao aplicar padrão: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  }

  const padding = compact ? 'p-0' : 'p-3';
  const emptyPadding = compact ? 'p-3' : 'p-8';

  if (!activeProductId) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 ${emptyPadding} text-center`}
      >
        <p className="text-xs text-muted-foreground">Selecione um broche pra ver padrões.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${emptyPadding}`}>
        <p className="animate-pulse text-xs text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 ${emptyPadding} text-center`}
      >
        <p className="text-[11px] text-muted-foreground">
          Sem padrões cadastrados para este produto.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 ${padding}`}>
      {patterns.map((p) => {
        const isActive = p.id === activePatternId;
        const isApplying = applyingId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => void handleApply(p.id)}
            disabled={applyingId !== null}
            className={[
              'flex items-center justify-between rounded border px-2 py-1.5 text-left transition-colors',
              isApplying
                ? 'cursor-not-allowed border-border opacity-50'
                : isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background/40 hover:border-primary/40 hover:bg-background/60',
            ].join(' ')}
          >
            <div className="min-w-0 flex-1">
              <p
                className={[
                  'truncate font-body text-xs',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {p.name}
              </p>
              {!compact && (
                <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {new Date(p.updatedAt * 1000).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            {isApplying && (
              <span className="animate-pulse text-[10px] text-muted-foreground">…</span>
            )}
            {isActive && !isApplying && (
              <span className="text-[9px] uppercase tracking-wider text-primary">aplicado</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
