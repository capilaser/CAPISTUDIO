import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { FolderCog } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { setProjectsRoot } from '@/data/repositories/projectFsRepository';
import { Button } from '@/ui/components/button';

interface ProjectsRootBarProps {
  rootPath: string | null;
  onChange: (path: string) => void;
}

export function ProjectsRootBar({ rootPath, onChange }: ProjectsRootBarProps) {
  const [busy, setBusy] = useState(false);

  async function handlePick() {
    if (busy) return;
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: rootPath ?? undefined,
        title: 'Escolher pasta raiz dos projetos',
      });
      if (!selected || typeof selected !== 'string') return;

      setBusy(true);
      const saved = await setProjectsRoot(selected);
      toast.success('Pasta raiz atualizada.');
      onChange(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao alterar raiz: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-ink-800 bg-ink-925 px-3 py-2 text-xs text-ink-400">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-ink-500">Pasta dos projetos</p>
        <p className="truncate font-mono text-[12px] text-ink-200" title={rootPath ?? ''}>
          {rootPath ?? '—'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={handlePick} disabled={busy}>
        <FolderCog className="mr-1.5 h-3.5 w-3.5" />
        Alterar
      </Button>
    </div>
  );
}
