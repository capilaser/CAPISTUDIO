import { FolderOpen, Layers, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { ProjectSummary } from '@/data/repositories/projectFsRepository';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';

interface ProjectCardProps {
  project: ProjectSummary;
  onOpen: (project: ProjectSummary) => void;
  onReveal: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}

export function ProjectCard({ project, onOpen, onReveal, onDelete }: ProjectCardProps) {
  const [imageError, setImageError] = useState(false);
  const displayName = project.name ?? project.folderName;
  const updated = project.updatedAt ? safeFormat(project.updatedAt) : 'Sem data';

  // No Tauri, o thumbnail vem como path absoluto. Convertemos para asset URL
  // se o componente IPC do app expor isso; por enquanto renderiza vazio se
  // não houver thumbnail acessível (Onda 2D pode adicionar convertFileSrc).
  const thumbnailSrc = project.thumbnailPath && !imageError ? null : null;

  return (
    <Card className="group flex flex-col overflow-hidden border-ink-800 bg-ink-950 transition-colors hover:border-ink-700">
      <button
        type="button"
        className="relative flex aspect-[3/2] w-full items-center justify-center overflow-hidden border-b border-ink-800 bg-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-laser/40"
        onClick={() => onOpen(project)}
        title="Abrir projeto"
      >
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={displayName}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Layers className="h-10 w-10 text-ink-700" strokeWidth={1.25} />
        )}
      </button>

      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-100" title={displayName}>
            {displayName}
          </p>
          <p className="text-[11px] text-ink-500">
            {project.productId ?? 'sem produto'} · {updated}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-ink-500 hover:text-ink-200"
              aria-label="Ações do projeto"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(project)}>
              <Layers className="mr-2 h-4 w-4" /> Abrir
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onReveal(project)}>
              <FolderOpen className="mr-2 h-4 w-4" /> Abrir pasta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-danger focus:text-danger"
              onSelect={() => onDelete(project)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Mover para lixeira
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

const DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function safeFormat(iso: string): string {
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}
