import { ArrowLeft, FolderOpen, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import type { ProjectFile } from '@/core/project/project-file';
import {
  listProjects,
  openProjectFolder,
  readProject,
} from '@/data/repositories/projectFsRepository';
import { Button } from '@/ui/components/button';

/**
 * Placeholder da EditorPage — Onda 2C entrega só a navegação + leitura.
 * Onda 2D (canvas vivo) e 2E (camadas) recheiam o miolo.
 */
export function EditorPage() {
  const params = useParams<{ folderName: string }>();
  const navigate = useNavigate();
  const folderName = decodeURIComponent(params.folderName ?? '');

  const [project, setProject] = useState<ProjectFile | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await listProjects();
        if (cancelled) return;
        const match = all.find((p) => p.folderName === folderName);
        if (!match) {
          setError(`Projeto "${folderName}" não encontrado na pasta raiz.`);
          setLoading(false);
          return;
        }
        const file = await readProject(match.folderPath);
        if (cancelled) return;
        setProject(file);
        setFolderPath(match.folderPath);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderName]);

  async function handleReveal() {
    if (!folderPath) return;
    try {
      await openProjectFolder(folderPath);
    } catch (err) {
      toast.error(`Erro ao abrir pasta: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <main className="flex h-full min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-ink-100">
              {project?.meta.name ?? folderName}
            </h1>
            <p className="text-[11px] text-ink-500">
              {project?.meta.productId ?? '—'} · {project?.viewport.widthMm ?? '?'}×
              {project?.viewport.heightMm ?? '?'} mm
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReveal} disabled={!folderPath}>
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Abrir pasta
          </Button>
        </div>
      </header>

      <section className="flex flex-1 items-center justify-center px-6 py-8">
        {loading ? (
          <div className="flex items-center text-ink-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando projeto…
          </div>
        ) : error ? (
          <div className="max-w-md rounded-md border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger">
            {error}
          </div>
        ) : project ? (
          <div className="w-full max-w-2xl rounded-md border border-ink-800 bg-ink-925 p-4 font-mono text-xs text-ink-300">
            <p className="mb-2 text-ink-200">Editor — placeholder (Onda 2D recheia)</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-[11px] text-ink-400">
              {JSON.stringify(project, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>
    </main>
  );
}
