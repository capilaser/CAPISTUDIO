/**
 * MarkingPanel.tsx — Onda 9
 *
 * Lista as marcações do banco e adiciona uma ao canvas como camada visual
 * filha do aplique selecionado (ou solta quando sem seleção). Espelho de
 * EngravingPanel.tsx, com filtro por categoria adicional (scope='marking').
 *
 * Sem UI de cadastro: criação de novas marcações vai pra Onda 10
 * (UI dos bancos). Esta onda é só leitura + adição ao canvas.
 */
import { type RefObject, useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { humanizeError } from '@/core/canvas/corel-svg-errors';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { resolveParentAppliqueId } from '@/core/canvas/resolve-parent-applique';
import { getCategoriesByScope, type Category } from '@/data/repositories/categoryRepository';
import { listByCategory, type Marking } from '@/data/repositories/markingRepository';
import { readMarkingFile } from '@/services/marking-storage';
import { resolveAbsolutePath, resolveDisplayUrl } from '@/services/svg-path-resolver';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';

const CATEGORY_ALL = '__all__';

interface MarkingCardProps {
  marking: Marking;
  adding: boolean;
  onAdd: (marking: Marking) => void;
}

function MarkingCardItem({ marking, adding, onAdd }: MarkingCardProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDisplayUrl(marking.filePath)
      .then((url) => {
        if (!cancelled) setDisplayUrl(url);
      })
      .catch(() => {
        /* thumbnail silently fails — card still clickable */
      });
    return () => {
      cancelled = true;
    };
  }, [marking.id, marking.filePath]);

  const wMm = marking.widthMm?.toFixed(1) ?? '—';
  const hMm = marking.heightMm?.toFixed(1) ?? '—';

  return (
    <button
      onClick={() => onAdd(marking)}
      disabled={adding}
      className={[
        'flex w-full items-center gap-3 rounded border px-2 py-2 text-left transition-colors',
        adding
          ? 'cursor-not-allowed border-ink-700 opacity-50'
          : 'border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900',
      ].join(' ')}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ink-100">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={marking.name}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-ink-200" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-xs font-medium text-ink-100">{marking.name}</p>
        <p className="font-mono tabular-nums text-[10px] text-ink-500">
          {wMm} × {hMm} mm
        </p>
      </div>

      {adding && <span className="font-mono text-[10px] text-ink-500 animate-pulse">…</span>}
    </button>
  );
}

interface MarkingPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function MarkingPanel({ engineRef }: MarkingPanelProps) {
  const [markings, setMarkings] = useState<Marking[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_ALL);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    getCategoriesByScope('marking')
      .then(setCategories)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[MarkingPanel] categories load:', err);
      });
  }, []);

  useEffect(() => {
    const filter = selectedCategory === CATEGORY_ALL ? undefined : selectedCategory;
    listByCategory(filter)
      .then(setMarkings)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[MarkingPanel] list error:', err);
      });
  }, [selectedCategory]);

  async function handleAdd(marking: Marking) {
    const engine = engineRef.current;
    if (!engine || adding) return;

    setAdding(marking.id);
    try {
      const absolutePath = await resolveAbsolutePath(marking.filePath);
      const svgString = await readMarkingFile(absolutePath);
      const meta = parseCorelSvg(svgString);
      const parentLayerId = resolveParentAppliqueId(engine);
      await engine.addMarkingSvg(meta, marking.name, marking.id, parentLayerId);
      toast.success(
        parentLayerId ? `${marking.name} adicionada ao aplique` : `${marking.name} adicionada`
      );
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      setAdding(null);
    }
  }

  if (markings.length === 0 && selectedCategory === CATEGORY_ALL) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
        <Crosshair className="h-8 w-8 opacity-50" />
        <p>Nenhuma marcação cadastrada.</p>
        <p className="text-center text-xs text-ink-500">
          Cadastro virá no Banco de Ativos (Onda 10).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-400">
        Marcações
      </p>

      {categories.length > 0 && (
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="mb-2 h-7 border-ink-700 bg-ink-950 px-2 font-mono text-[11px] text-ink-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_ALL} className="font-mono text-[11px]">
              Todas as categorias
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="font-mono text-[11px]">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {markings.length === 0 ? (
        <p className="py-4 text-center font-mono text-[11px] text-ink-500">
          Nenhuma marcação nesta categoria.
        </p>
      ) : (
        markings.map((mk) => (
          <MarkingCardItem key={mk.id} marking={mk} adding={adding === mk.id} onAdd={handleAdd} />
        ))
      )}
    </div>
  );
}
