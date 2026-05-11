/**
 * EngravingPanel.tsx — Onda 8.5
 *
 * Lista as gravações do banco e adiciona uma ao canvas como camada visual
 * filha do aplique selecionado (ou solta quando sem seleção). Espelho de
 * ApliquePanel.tsx, com filtro por categoria adicional (scope='engraving').
 *
 * Sem UI de cadastro: criação de novas gravações vai pra Onda 10
 * (UI dos bancos). Esta onda é só leitura + adição ao canvas.
 */
import { type RefObject, useEffect, useState } from 'react';
import { Stamp } from 'lucide-react';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { humanizeError } from '@/core/canvas/corel-svg-errors';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { resolveParentAppliqueId } from '@/core/canvas/resolve-parent-applique';
import { listByCategory, type Engraving } from '@/data/repositories/engravingRepository';
import { getCategoriesByScope, type Category } from '@/data/repositories/categoryRepository';
import { readEngravingFile } from '@/services/engraving-storage';
import { resolveAbsolutePath, resolveDisplayUrl } from '@/services/svg-path-resolver';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/select';

const CATEGORY_ALL = '__all__';

interface EngravingCardProps {
  engraving: Engraving;
  adding: boolean;
  onAdd: (engraving: Engraving) => void;
}

function EngravingCardItem({ engraving, adding, onAdd }: EngravingCardProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDisplayUrl(engraving.filePath)
      .then((url) => {
        if (!cancelled) setDisplayUrl(url);
      })
      .catch(() => {
        /* thumbnail silently fails — card still clickable */
      });
    return () => {
      cancelled = true;
    };
  }, [engraving.id, engraving.filePath]);

  const wMm = engraving.widthMm?.toFixed(1) ?? '—';
  const hMm = engraving.heightMm?.toFixed(1) ?? '—';

  return (
    <button
      onClick={() => onAdd(engraving)}
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
            alt={engraving.name}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-ink-200" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-xs font-medium text-ink-100">{engraving.name}</p>
        <p className="font-mono tabular-nums text-[10px] text-ink-500">
          {wMm} × {hMm} mm
        </p>
      </div>

      {adding && <span className="font-mono text-[10px] text-ink-500 animate-pulse">…</span>}
    </button>
  );
}

interface EngravingPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function EngravingPanel({ engineRef }: EngravingPanelProps) {
  const [engravings, setEngravings] = useState<Engraving[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORY_ALL);
  const [adding, setAdding] = useState<string | null>(null);

  // Carrega categorias de scope 'engraving' uma vez.
  useEffect(() => {
    getCategoriesByScope('engraving')
      .then(setCategories)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[EngravingPanel] categories load:', err);
      });
  }, []);

  // Recarrega lista quando filtro muda.
  useEffect(() => {
    const filter = selectedCategory === CATEGORY_ALL ? undefined : selectedCategory;
    listByCategory(filter)
      .then(setEngravings)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[EngravingPanel] list error:', err);
      });
  }, [selectedCategory]);

  async function handleAdd(engraving: Engraving) {
    const engine = engineRef.current;
    if (!engine || adding) return;

    setAdding(engraving.id);
    try {
      const absolutePath = await resolveAbsolutePath(engraving.filePath);
      const svgString = await readEngravingFile(absolutePath);
      const meta = parseCorelSvg(svgString);
      const parentLayerId = resolveParentAppliqueId(engine);
      await engine.addEngravingSvg(meta, engraving.name, engraving.id, parentLayerId);
      toast.success(
        parentLayerId ? `${engraving.name} adicionada ao aplique` : `${engraving.name} adicionada`
      );
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      setAdding(null);
    }
  }

  if (engravings.length === 0 && selectedCategory === CATEGORY_ALL) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
        <Stamp className="h-8 w-8 opacity-50" />
        <p>Nenhuma gravação cadastrada.</p>
        <p className="text-center text-xs text-ink-500">
          Cadastro virá no Banco de Ativos (Onda 10).
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-400">
        Gravações
      </p>

      {/* Filtro por categoria */}
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

      {engravings.length === 0 ? (
        <p className="py-4 text-center font-mono text-[11px] text-ink-500">
          Nenhuma gravação nesta categoria.
        </p>
      ) : (
        engravings.map((eng) => (
          <EngravingCardItem
            key={eng.id}
            engraving={eng}
            adding={adding === eng.id}
            onAdd={handleAdd}
          />
        ))
      )}
    </div>
  );
}
