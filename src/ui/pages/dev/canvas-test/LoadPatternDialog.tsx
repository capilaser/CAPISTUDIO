/**
 * LoadPatternDialog — Onda 8, Checkpoint C
 *
 * Modal shadcn que lista padrões do produto atual e carrega o selecionado no canvas.
 * Filtra por productId — não mostra padrões de outros produtos (ex: broche).
 */
import { useEffect, useState } from 'react';

import type { PatternListItem } from '@/data/repositories/patternRepository';
import { listByProduct } from '@/data/repositories/patternRepository';
import { Button } from '@/ui/components/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';

interface LoadPatternDialogProps {
  open: boolean;
  productId: string;
  onClose: () => void;
  onLoad: (patternId: string) => Promise<void>;
}

export function LoadPatternDialog({ open, productId, onClose, onLoad }: LoadPatternDialogProps) {
  const [patterns, setPatterns] = useState<PatternListItem[]>([]);
  // Start as `open` so the first render shows the loading state immediately
  // without needing a synchronous setState inside an effect.
  const [loading, setLoading] = useState(open);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listByProduct(productId)
      .then((rows) => {
        if (!cancelled) {
          setPatterns(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (import.meta.env.DEV) console.error('[LoadPatternDialog] listByProduct error:', err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  async function handleLoad(id: string) {
    if (loadingId) return;
    setLoadingId(id);
    try {
      await onLoad(id);
      onClose();
    } catch (err) {
      if (import.meta.env.DEV) console.error('[LoadPatternDialog] onLoad error:', err);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-ink-700 bg-ink-900 text-ink-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Abrir padrão
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <p className="animate-pulse py-4 text-center font-mono text-xs text-ink-500">
              Carregando…
            </p>
          ) : patterns.length === 0 ? (
            <p className="py-4 text-center font-mono text-xs text-ink-500">
              Nenhum padrão salvo para este produto.
            </p>
          ) : (
            <div className="flex flex-col gap-1 py-1">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  onClick={() => void handleLoad(p.id)}
                  disabled={loadingId !== null}
                  className={[
                    'flex items-center justify-between rounded border px-3 py-2 text-left transition-colors',
                    loadingId === p.id
                      ? 'cursor-not-allowed border-ink-700 opacity-50'
                      : 'border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900',
                  ].join(' ')}
                >
                  <div>
                    <p className="font-body text-xs font-medium text-ink-100">{p.name}</p>
                    <p className="font-mono text-[10px] text-ink-500">
                      {new Date(p.updatedAt * 1000).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {loadingId === p.id && (
                    <span className="animate-pulse font-mono text-[10px] text-ink-500">…</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-ink-800 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-100"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
