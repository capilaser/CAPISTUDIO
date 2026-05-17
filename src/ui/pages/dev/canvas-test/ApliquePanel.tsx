/**
 * ApliquePanel.tsx — Onda 6.5 Fase C
 *
 * Lists appliques from the local database and lets the user add one to the
 * canvas as a new principal layer (kind: 'principal', appliqueId set).
 *
 * Rendered inside UnifiedRightPanel > aba Apliques.
 * Reads SVG content via IPC (read_applique_file) — NOT fetch() over asset URL,
 * which has no precedent in this project and may fail silently in the Tauri WebView.
 */
import { type RefObject, useEffect, useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';

import { svgErrorToToastArgs } from '@/core/canvas/corel-svg-errors';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { list, type Applique } from '@/data/repositories/appliqueRepository';
import { readAppliqueFile } from '@/services/applique-storage';
import { resolveAbsolutePath, resolveDisplayUrl } from '@/services/svg-path-resolver';

interface ApliqueCardProps {
  applique: Applique;
  adding: boolean;
  onAdd: (applique: Applique) => void;
}

function ApliqueCardItem({ applique, adding, onAdd }: ApliqueCardProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDisplayUrl(applique.filePath)
      .then((url) => {
        if (!cancelled) setDisplayUrl(url);
      })
      .catch(() => {
        /* thumbnail silently fails — card still clickable */
      });
    return () => {
      cancelled = true;
    };
  }, [applique.id, applique.filePath]);

  const wMm = applique.widthMm?.toFixed(1) ?? '—';
  const hMm = applique.heightMm?.toFixed(1) ?? '—';

  return (
    <button
      onClick={() => onAdd(applique)}
      disabled={adding}
      className={[
        'flex w-full items-center gap-3 rounded border px-2 py-2 text-left transition-colors',
        adding
          ? 'cursor-not-allowed border-ink-700 opacity-50'
          : 'border-ink-700 bg-ink-950 hover:border-ink-500 hover:bg-ink-900',
      ].join(' ')}
    >
      {/* Thumbnail — small fixed square */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-ink-100">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={applique.name}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-ink-200" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-xs font-medium text-ink-100">{applique.name}</p>
        <p className="font-mono tabular-nums text-[10px] text-ink-500">
          {wMm} × {hMm} mm
        </p>
      </div>

      {/* Loading indicator */}
      {adding && <span className="font-mono text-[10px] text-ink-500 animate-pulse">…</span>}
    </button>
  );
}

interface ApliquesPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function ApliquePanel({ engineRef }: ApliquesPanelProps) {
  const [apliques, setApliques] = useState<Applique[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    list()
      .then(setApliques)
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[ApliquePanel] list() error:', err);
      });
  }, []);

  async function handleAdd(applique: Applique) {
    const engine = engineRef.current;
    if (!engine || adding) return;

    setAdding(applique.id);
    try {
      const absolutePath = await resolveAbsolutePath(applique.filePath);
      const svgString = await readAppliqueFile(absolutePath);
      const meta = parseCorelSvg(svgString);
      await engine.addAppliqueSvg(meta, applique.name, applique.id);
      toast.success(`${applique.name} adicionado`);
    } catch (err) {
      const { title, options } = svgErrorToToastArgs(err);
      toast.error(title, options);
    } finally {
      setAdding(null);
    }
  }

  if (apliques.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
        <BookmarkPlus className="h-8 w-8 opacity-50" />
        <p>Nenhum aplique cadastrado.</p>
        <p className="text-center text-xs text-ink-500">Acesse o Banco de Ativos para adicionar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="mb-1 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-400">
        Apliques
      </p>
      {apliques.map((ap) => (
        <ApliqueCardItem key={ap.id} applique={ap} adding={adding === ap.id} onAdd={handleAdd} />
      ))}
    </div>
  );
}
