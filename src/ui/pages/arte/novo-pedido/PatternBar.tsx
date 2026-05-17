/**
 * PatternBar — Onda 14
 *
 * Barra superior do canvas mostrando padrões compatíveis com o broche ativo.
 * Inspirada na referência fornecida pelo dono:
 *
 *   [chips de filtro] [card 1] [card 2] [card 3] [card 4] [card 5]   [Ver todos →]
 *
 * Filtros sao tags do pattern (com-borda, com-logo, etc). Click no chip
 * inclui/exclui aquela tag do filtro ativo.
 *
 * Os 5 primeiros patterns filtrados aparecem como cards visuais com
 * mini-render schematic (SVG inline gerado de pattern-thumbnail.ts).
 *
 * Click no card aplica o pattern no broche ativo via engine.applyPatternObjects.
 *
 * Sem broche ativo: a barra fica em estado "vazio" (mensagem hint).
 */
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { renderPatternThumbnailSvg } from '@/core/export/pattern-thumbnail';
import {
  getById as getMaterialById,
  resolveAssetUrl,
} from '@/data/repositories/materialRepository';
import { getPatternById, listByProduct } from '@/data/repositories/patternRepository';
import type { Pattern, PatternListItem } from '@/data/repositories/patternRepository';
import { getProductById } from '@/data/repositories/productRepository';
import { cn } from '@/lib/cn';
import { sanitizeSvg } from '@/lib/sanitize-svg';
import { Button } from '@/ui/components/button';
import { Skeleton } from '@/ui/components/skeleton';

import { PatternGalleryDialog } from './PatternGalleryDialog';

/** Quantos cards mostramos na barra antes do "Ver todos". */
const MAX_CARDS = 5;

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /** Produto do broche ativo. Null = nenhum broche. */
  activeProductId: string | null;
  /** ID local do broche ativo (BoardItemDraft.id) — pra montar o appliqueId base. */
  activeItemId: string | null;
  /** Offset do broche ativo na prancha (mm). */
  activeOffsetMm: { leftMm: number; topMm: number };
  /** Pattern atualmente aplicado no broche (destaque). */
  activePatternId?: string | null;
  /** Callback após aplicar pattern. */
  onApplied?: (patternId: string) => void;
}

interface PatternWithMeta extends PatternListItem {
  tags: string[];
  description: string | null;
  canvasJson: Pattern['canvasJson'];
  productWidthMm: number;
  productHeightMm: number;
}

export function PatternBar({
  engineRef,
  activeProductId,
  activeItemId,
  activeOffsetMm,
  activePatternId = null,
  onApplied,
}: Props) {
  const [patterns, setPatterns] = useState<PatternWithMeta[]>([]);
  const [loading, setLoading] = useState(activeProductId !== null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Carrega patterns + tags + canvasJson do produto ativo.
  // listByProduct retorna só (id, name, updatedAt) — precisamos das tags
  // pros filtros e do canvasJson pro thumbnail. Por isso enriquecemos
  // via getPatternById em paralelo.
  useEffect(() => {
    if (!activeProductId) return;
    let cancelled = false;
    // Desloca setLoading pra microtask pra evitar warning react-hooks/set-state-in-effect.
    // Garante reset de loading quando productId muda entre patterns (A → B).
    void Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    // Resolve dims do produto uma vez — todos os patterns deste produto
    // compartilham as mesmas dimensões. Fallback (60x25) se produto não
    // encontrado, evita explodir e mostra patterns mesmo com banco mal seedado.
    Promise.all([listByProduct(activeProductId), getProductById(activeProductId)])
      .then(async ([items, product]) => {
        if (cancelled) return;
        const productWidthMm = product?.canvasMm.width ?? 60;
        const productHeightMm = product?.canvasMm.height ?? 25;
        // Pra MVP, carregamos canvasJson + tags de cada pattern. Patterns
        // são poucos (5-15) — custo é baixo. Se a galeria crescer, depois
        // mover thumbnail rendering pra lazy on-demand.
        const enriched = await Promise.all(
          items.map(async (item) => {
            const full = await getPatternById(item.id);
            if (!full) return null;
            return {
              ...item,
              tags: full.tags,
              description: full.description,
              canvasJson: full.canvasJson,
              productWidthMm,
              productHeightMm,
            } as PatternWithMeta;
          })
        );
        if (cancelled) return;
        setPatterns(enriched.filter((p): p is PatternWithMeta => p !== null));
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[PatternBar] listByProduct error:', err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeProductId]);

  // Aggrega todas as tags presentes nos patterns carregados pra mostrar
  // como chips no topo. Excluí os já filtrados (eles aparecem como ativos).
  // Onda 19.E — agrupa por categoria visual (Bordas, Traços, Nome, Logo).
  const tagGroups = useMemo(() => {
    const present = new Set<string>();
    for (const p of patterns) {
      for (const t of p.tags) present.add(t);
    }
    return groupTags(present);
  }, [patterns]);

  const allTags = useMemo(() => tagGroups.flatMap((g) => g.tags), [tagGroups]);

  // Patterns filtrados pelas tags ativas (intersecção). Sem filtros = mostra tudo.
  const filtered = useMemo(() => {
    if (activeFilters.size === 0) return patterns;
    return patterns.filter((p) => {
      for (const tag of activeFilters) {
        if (!p.tags.includes(tag)) return false;
      }
      return true;
    });
  }, [patterns, activeFilters]);

  const visibleCards = filtered.slice(0, MAX_CARDS);

  function toggleFilter(tag: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  async function handleApply(pattern: PatternWithMeta) {
    if (applyingId) return;
    const engine = engineRef.current;
    if (!engine) {
      toast.error('Canvas não está pronto.');
      return;
    }
    if (!pattern.canvasJson) {
      toast.error('Padrão sem canvas salvo.');
      return;
    }

    setApplyingId(pattern.id);
    try {
      // Onda 14 — remove conteúdo do pattern anterior do broche ativo antes
      // de aplicar o novo (evita acumular slots/decorativos um sobre o outro).
      // Preserva o aplique base do broche (board-item:<itemId>).
      if (activeItemId) {
        engine.removeItemContents(`board-item:${activeItemId}`, activeOffsetMm, {
          widthMm: pattern.productWidthMm,
          heightMm: pattern.productHeightMm,
        });
      }

      // Onda 15 — resolve o layerId do broche ativo via appliqueId,
      // pra parentar os slots do pattern como filhos do broche.
      const parentLayerId = activeItemId
        ? (engine.findPrincipalByAppliqueId(`board-item:${activeItemId}`) ?? undefined)
        : undefined;

      await engine.applyPatternObjects(
        pattern.canvasJson as unknown as Parameters<typeof engine.applyPatternObjects>[0],
        activeOffsetMm,
        async (materialId) => {
          const mat = await getMaterialById(materialId);
          if (!mat) throw new Error(`Material not found: ${materialId}`);
          return resolveAssetUrl(mat);
        },
        parentLayerId,
        // Onda 16 — região do broche-alvo. applyPatternObjects clampa
        // qualquer objeto que extrapole esse retângulo (anti-vazamento).
        {
          leftMm: activeOffsetMm.leftMm,
          topMm: activeOffsetMm.topMm,
          widthMm: pattern.productWidthMm,
          heightMm: pattern.productHeightMm,
        }
      );
      toast.success(`Padrão "${pattern.name}" aplicado`);
      onApplied?.(pattern.id);
    } catch (err) {
      console.error('[PatternBar] apply error:', err);
      toast.error(`Erro ao aplicar padrão: ${String(err)}`);
    } finally {
      setApplyingId(null);
    }
  }

  // ── Estados vazios ─────────────────────────────────────────────────────

  if (!activeProductId) {
    return (
      <div className="flex h-[110px] shrink-0 items-center justify-center border-b border-border bg-card/60 px-4">
        <p className="text-[11px] text-muted-foreground">
          Adicione ou selecione um broche para ver padrões compatíveis.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[110px] shrink-0 items-center gap-2 border-b border-border bg-card/60 px-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[80px] w-[80px] shrink-0 rounded-md" />
        ))}
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="flex h-[110px] shrink-0 flex-col items-center justify-center gap-1 border-b border-border bg-card/60 px-4">
        <p className="text-[11px] text-muted-foreground">
          Sem padrões cadastrados para este produto.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-card/60 px-4 py-2">
        {/* Linha 1 — Chips de filtro */}
        <div className="flex flex-wrap items-center gap-1.5">
          {allTags.length === 0 ? (
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {patterns.length} padrões
            </span>
          ) : (
            tagGroups.map((group, groupIdx) => (
              <div
                key={group.name}
                className={cn(
                  'flex flex-wrap items-center gap-1.5',
                  groupIdx > 0 && 'border-l border-ink-700 pl-2'
                )}
              >
                {group.tags.map((tag) => {
                  const isActive = activeFilters.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleFilter(tag)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors',
                        isActive
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {tag}
                      {isActive && <X className="h-2.5 w-2.5" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {activeFilters.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters(new Set())}
              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
            >
              limpar
            </button>
          )}
        </div>

        {/* Linha 2 — Cards + Ver todos */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5">
            {visibleCards.length === 0 ? (
              <p className="py-3 text-[11px] text-muted-foreground">
                Nenhum padrão bate com os filtros.
              </p>
            ) : (
              visibleCards.map((p) => (
                <PatternCard
                  key={p.id}
                  pattern={p}
                  selected={p.id === activePatternId}
                  applying={applyingId === p.id}
                  onClick={() => void handleApply(p)}
                />
              ))
            )}
          </div>

          {/* Ver todos — só aparece se há mais que o limite */}
          {filtered.length > MAX_CARDS && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-[10px]"
              onClick={() => setGalleryOpen(true)}
            >
              Ver todos ({filtered.length}) →
            </Button>
          )}
        </div>

        {/* Linha 3 — resumo de filtros (debug/feedback discreto) */}
        {activeFilters.size > 0 && (
          <p className="text-[9px] text-muted-foreground/70">
            {filtered.length} {filtered.length === 1 ? 'padrão' : 'padrões'} ·{' '}
            {Array.from(activeFilters).join(' · ')}
          </p>
        )}
      </div>

      <PatternGalleryDialog
        open={galleryOpen}
        patterns={filtered}
        activePatternId={activePatternId}
        applyingId={applyingId}
        onApply={(pattern) => {
          void handleApply(pattern);
          setGalleryOpen(false);
        }}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  );
}

// ── Card individual ────────────────────────────────────────────────────

function PatternCard({
  pattern,
  selected,
  applying,
  onClick,
}: {
  pattern: PatternWithMeta;
  selected: boolean;
  applying: boolean;
  onClick: () => void;
}) {
  const svgString = useMemo(() => {
    if (!pattern.canvasJson) return '';
    return renderPatternThumbnailSvg(pattern.canvasJson, {
      productWidthMm: pattern.productWidthMm,
      productHeightMm: pattern.productHeightMm,
      outWidthPx: 90,
    });
  }, [pattern.canvasJson, pattern.productWidthMm, pattern.productHeightMm]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={applying}
      title={pattern.description ?? pattern.name}
      className={cn(
        'group flex shrink-0 flex-col items-center gap-1 rounded border px-2 py-1.5 transition-colors',
        applying
          ? 'cursor-not-allowed border-border opacity-50'
          : selected
            ? 'border-primary bg-primary/10'
            : 'border-border bg-background/40 hover:border-primary/40 hover:bg-background/60'
      )}
    >
      <div
        className="flex h-[40px] w-[90px] items-center justify-center"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgString) }}
      />
      <span
        className={cn(
          'max-w-[90px] truncate text-[9px] uppercase tracking-wider',
          selected ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {pattern.name}
      </span>
    </button>
  );
}

// ── Agrupamento de tags por categoria visual ───────────────────────────
//
// Onda 19.E — Designer pediu agrupamento das tags de filtro em 4 grupos
// (Bordas, Traços, Nome, Logo) separados por linha vertical sutil.
// Tags fora dos grupos conhecidos caem em "Outros" — defensivo pra
// novas tags adicionadas sem atualizar este map.

interface TagGroup {
  name: string;
  /** Ordem desejada das tags dentro do grupo. Filtra pra incluir só as presentes. */
  tags: string[];
}

const TAG_GROUP_ORDER: { name: string; tags: string[] }[] = [
  { name: 'Bordas', tags: ['com-borda', 'sem-borda'] },
  { name: 'Traços', tags: ['com-traço', 'com-2-traços', 'sem-traço'] },
  { name: 'Nome', tags: ['nome-centro', 'nome-esquerda', 'nome-direita'] },
  { name: 'Logo', tags: ['com-logo', 'sem-logo'] },
];

function groupTags(present: Set<string>): TagGroup[] {
  const groups: TagGroup[] = [];
  const seen = new Set<string>();

  for (const group of TAG_GROUP_ORDER) {
    const filtered = group.tags.filter((t) => present.has(t));
    if (filtered.length > 0) {
      groups.push({ name: group.name, tags: filtered });
      for (const t of filtered) seen.add(t);
    }
  }

  // "Outros" — tags presentes que não caem em nenhum grupo conhecido.
  const outros = Array.from(present)
    .filter((t) => !seen.has(t))
    .sort();
  if (outros.length > 0) {
    groups.push({ name: 'Outros', tags: outros });
  }

  return groups;
}
