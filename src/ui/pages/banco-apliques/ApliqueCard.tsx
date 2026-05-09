import { useEffect, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import type { Applique } from '@/data/repositories/appliqueRepository';
import { resolveDisplayUrl } from '@/services/svg-path-resolver';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';

interface Props {
  applique: Applique;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ApliqueCard({ applique, onRename, onDelete }: Props) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveDisplayUrl(applique.filePath)
      .then((url) => {
        if (!cancelled) {
          console.log('[ApliqueCard] resolved', {
            id: applique.id,
            filePath: applique.filePath,
            displayUrl: url,
          });
          setDisplayUrl(url);
        }
      })
      .catch((err) =>
        console.error('[ApliqueCard] resolveDisplayUrl FAILED', {
          id: applique.id,
          filePath: applique.filePath,
          err,
        })
      );
    return () => {
      cancelled = true;
    };
  }, [applique.id, applique.filePath]);

  const wMm = applique.widthMm?.toFixed(1) ?? '—';
  const hMm = applique.heightMm?.toFixed(1) ?? '—';

  return (
    <div className="group relative flex flex-col rounded-md border border-ink-700 bg-ink-900 transition-all duration-150 ease-out hover:border-ink-600">
      {/* Kebab menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded opacity-0 transition-opacity hover:bg-ink-700 group-hover:opacity-100 focus:opacity-100"
            aria-label="Opções"
          >
            <MoreHorizontal size={14} className="text-ink-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          <DropdownMenuItem onClick={() => onRename(applique.id)} className="gap-2 text-xs">
            <Pencil size={12} />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(applique.id)}
            className="gap-2 text-xs text-danger focus:text-danger"
          >
            <Trash2 size={12} />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Thumbnail area — light bg so dark SVG strokes are visible */}
      <div className="flex h-40 items-center justify-center rounded-t-md bg-ink-100 p-3">
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
      <div className="px-3 py-2">
        <p className="truncate font-body text-xs font-medium text-ink-100">{applique.name}</p>
        <p className="mt-0.5 font-mono tabular-nums text-[10px] text-ink-500">
          {wMm} × {hMm} mm
        </p>
      </div>
    </div>
  );
}
