/**
 * PatternGalleryDialog — Onda 14
 *
 * Modal grande aberto via botão "Ver todos" da PatternBar. Mostra a lista
 * completa de patterns filtrados em grid de cards (thumbnail + nome +
 * descrição). Click no card aplica o pattern e fecha o modal.
 *
 * Recebe os patterns já filtrados pela PatternBar — não refaz a query nem
 * o filtro.
 */
import { useMemo } from 'react';

import { renderPatternThumbnailSvg } from '@/core/export/pattern-thumbnail';
import type { Pattern, PatternListItem } from '@/data/repositories/patternRepository';
import { cn } from '@/lib/cn';
import { sanitizeSvg } from '@/lib/sanitize-svg';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';

interface PatternWithMeta extends PatternListItem {
  tags: string[];
  description: string | null;
  canvasJson: Pattern['canvasJson'];
  productWidthMm: number;
  productHeightMm: number;
}

interface Props {
  open: boolean;
  patterns: PatternWithMeta[];
  activePatternId?: string | null;
  applyingId?: string | null;
  onApply: (pattern: PatternWithMeta) => void;
  onClose: () => void;
}

export function PatternGalleryDialog({
  open,
  patterns,
  activePatternId = null,
  applyingId = null,
  onApply,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto border-ink-700 bg-ink-900 text-ink-100">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Todos os padrões ({patterns.length})
          </DialogTitle>
        </DialogHeader>

        {patterns.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-500">Nenhum padrão pra mostrar.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {patterns.map((p) => (
              <GalleryCard
                key={p.id}
                pattern={p}
                selected={p.id === activePatternId}
                applying={applyingId === p.id}
                onClick={() => onApply(p)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GalleryCard({
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
      outWidthPx: 180,
    });
  }, [pattern.canvasJson, pattern.productWidthMm, pattern.productHeightMm]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={applying}
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors',
        applying
          ? 'cursor-not-allowed border-ink-700 opacity-50'
          : selected
            ? 'border-primary bg-primary/10'
            : 'border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900'
      )}
    >
      <div
        className="flex h-[80px] w-full items-center justify-center"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgString) }}
      />
      <div className="flex w-full flex-col gap-0.5">
        <p
          className={cn(
            'truncate font-body text-xs font-medium',
            selected ? 'text-primary' : 'text-ink-100'
          )}
        >
          {pattern.name}
        </p>
        {pattern.description && (
          <p className="line-clamp-2 text-[10px] text-ink-500">{pattern.description}</p>
        )}
        {pattern.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {pattern.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-ink-800 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-ink-400"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
