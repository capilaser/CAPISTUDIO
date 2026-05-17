/**
 * PadroesPage — Onda 14c
 *
 * Lista patterns existentes (agrupados por produto) + botão pra criar
 * padrão novo. Cada card linka pro editor (/padroes/editar/:id) e tem
 * menu de 3-pontos com Duplicar / Deletar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, MoreVertical, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { renderPatternThumbnailSvg } from '@/core/export/pattern-thumbnail';
import {
  duplicatePattern,
  getAllPatternsForListing,
  softDeletePattern,
  type PatternListEntry,
} from '@/data/repositories/patternRepository';
import { getAllProducts, type Product } from '@/data/repositories/productRepository';
import { sanitizeSvg } from '@/lib/sanitize-svg';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import AppLayout from '@/ui/layout/AppLayout';
import { EmptyState } from '@/ui/components/empty-state';

export default function PadroesPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [patterns, setPatterns] = useState<PatternListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<PatternListEntry | null>(null);

  const reload = useCallback(async () => {
    const summaries = await getAllPatternsForListing();
    setPatterns(summaries);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [prods, summaries] = await Promise.all([
          getAllProducts(),
          getAllPatternsForListing(),
        ]);
        if (cancelled) return;
        setProducts(prods);
        setPatterns(summaries);
      } catch (e) {
        console.warn('[PadroesPage] load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Agrupa patterns por productId.
  const byProduct = new Map<string, PatternListEntry[]>();
  for (const p of patterns) {
    const arr = byProduct.get(p.productId) ?? [];
    arr.push(p);
    byProduct.set(p.productId, arr);
  }

  // Lookup rápido productId → dimensões em mm (alimenta o thumbnail).
  const productDimsById = useMemo(() => {
    const m = new Map<string, { widthMm: number; heightMm: number }>();
    for (const p of products) {
      m.set(p.id, { widthMm: p.canvasMm.width, heightMm: p.canvasMm.height });
    }
    return m;
  }, [products]);

  function handleCreateNew(productId: string) {
    navigate(`/padroes/novo?product=${productId}`);
  }

  function handleEdit(id: string) {
    navigate(`/padroes/editar/${id}`);
  }

  async function handleDuplicate(p: PatternListEntry) {
    try {
      const newId = `pattern-${crypto.randomUUID()}`;
      const newName = `${p.name} (cópia)`;
      await duplicatePattern(p.id, newId, newName);
      toast.success(`Duplicado: "${newName}"`);
      await reload();
    } catch (err) {
      console.error('[PadroesPage] duplicate failed:', err);
      toast.error(`Erro ao duplicar: ${String(err)}`);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      await softDeletePattern(target.id);
      toast.success(`"${target.name}" removido`);
      await reload();
    } catch (err) {
      console.error('[PadroesPage] delete failed:', err);
      toast.error(`Erro ao remover: ${String(err)}`);
    }
  }

  return (
    <AppLayout breadcrumb={[{ label: 'Padrões' }]}>
      <div className="flex h-full flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-lg font-medium text-foreground">Padrões</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Criar novo padrão
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {products.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleCreateNew(p.id)}
                  className="gap-2"
                >
                  <span className="text-xs">{p.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : patterns.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="Nenhum padrão cadastrado"
            description='Crie um padrão pelo botão "Criar novo padrão" acima. Padrões salvos podem ser reaplicados em pedidos futuros.'
          />
        ) : (
          <div className="flex flex-col gap-6">
            {Array.from(byProduct.entries()).map(([productId, list]) => {
              const product = products.find((p) => p.id === productId);
              return (
                <div key={productId} className="flex flex-col gap-2">
                  <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {product?.label ?? productId} ({list.length})
                  </h2>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                    {list.map((p) => (
                      <PatternCard
                        key={p.id}
                        pattern={p}
                        productDims={productDimsById.get(p.productId) ?? null}
                        onEdit={() => handleEdit(p.id)}
                        onDuplicate={() => void handleDuplicate(p)}
                        onDelete={() => setConfirmDelete(p)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmação de delete (Dialog do shadcn — nunca confirm() nativo) */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover padrão?</DialogTitle>
            <DialogDescription>
              "{confirmDelete?.name}" será marcado como deletado e não aparecerá mais nas listagens.
              Pedidos existentes que usaram este padrão continuam intactos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmDelete()}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

interface PatternCardProps {
  pattern: PatternListEntry;
  productDims: { widthMm: number; heightMm: number } | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function PatternCard({ pattern, productDims, onEdit, onDuplicate, onDelete }: PatternCardProps) {
  // Renderiza thumbnail schematic SVG. Memoizado por canvasJson — não re-renderiza
  // se o pattern não mudar (typecase de re-render por hover etc).
  const thumbSvg = useMemo(() => {
    if (!pattern.canvasJson || !productDims) return '';
    return renderPatternThumbnailSvg(pattern.canvasJson, {
      productWidthMm: productDims.widthMm,
      productHeightMm: productDims.heightMm,
      outWidthPx: 200,
    });
  }, [pattern.canvasJson, productDims]);

  return (
    <div className="group relative flex flex-col gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40">
      <button type="button" onClick={onEdit} className="flex flex-col items-start gap-2 text-left">
        <div
          className="flex h-[80px] w-full items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-background/60"
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(thumbSvg) }}
        />
        <span className="line-clamp-1 w-full pr-8 font-body text-xs font-medium text-foreground">
          {pattern.name}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {new Date(pattern.updatedAt * 1000).toLocaleDateString('pt-BR')}
        </span>
        {pattern.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pattern.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-background/40 px-1.5 py-0 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </button>

      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Ações"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
