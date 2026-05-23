import { FilePlus, Inbox, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  deleteProject,
  getProjectsRoot,
  listProjects,
  openProjectFolder,
  type ProjectSummary,
} from '@/data/repositories/projectFsRepository';
import { Button } from '@/ui/components/button';
import { EmptyState } from '@/ui/components/empty-state';

import { NewProjectDialog } from './NewProjectDialog';
import { ProjectCard } from './ProjectCard';
import { ProjectsRootBar } from './ProjectsRootBar';

export function HomePage() {
  const navigate = useNavigate();
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [root, list] = await Promise.all([getProjectsRoot(), listProjects()]);
      setRootPath(root);
      setProjects(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao carregar projetos: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [root, list] = await Promise.all([getProjectsRoot(), listProjects()]);
        if (cancelled) return;
        setRootPath(root);
        setProjects(list);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Erro ao carregar projetos: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleOpen(p: ProjectSummary) {
    // Folder name é único dentro da raiz; navegamos por ele e a EditorPage
    // resolve folderPath via listProjects / read_project.
    navigate(`/editor/${encodeURIComponent(p.folderName)}`);
  }

  async function handleReveal(p: ProjectSummary) {
    try {
      await openProjectFolder(p.folderPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao abrir pasta: ${msg}`);
    }
  }

  async function handleDelete(p: ProjectSummary) {
    const ok = window.confirm(
      `Mover "${p.name ?? p.folderName}" para a lixeira?\n\nA pasta vai para _trash/ dentro da raiz dos projetos.`
    );
    if (!ok) return;
    try {
      await deleteProject(p.folderPath);
      toast.success('Projeto movido para lixeira.');
      setLoading(true);
      void refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao mover: ${msg}`);
    }
  }

  return (
    <main className="flex h-full min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex flex-col gap-3 border-b border-ink-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-ink-100">Capi Studio</h1>
          <p className="text-xs text-ink-500">Projetos de produção laser</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <FilePlus className="mr-1.5 h-3.5 w-3.5" />
            Novo projeto
          </Button>
        </div>
      </header>

      <div className="px-6 pb-2 pt-4">
        <ProjectsRootBar
          rootPath={rootPath}
          onChange={(p) => {
            setRootPath(p);
            setLoading(true);
            void refresh();
          }}
        />
      </div>

      <section className="flex-1 px-6 pb-10 pt-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-ink-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando projetos…
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum projeto ainda"
            description="Crie seu primeiro projeto para começar. Ele vai virar uma pasta com toda a estrutura organizada."
            action={
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <FilePlus className="mr-1.5 h-3.5 w-3.5" />
                Novo projeto
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.folderPath}
                project={p}
                onOpen={handleOpen}
                onReveal={handleReveal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(folderPath) => {
          const folderName = folderPath.split(/[\\/]/).pop() ?? '';
          setLoading(true);
          void refresh();
          navigate(`/editor/${encodeURIComponent(folderName)}`);
        }}
      />
    </main>
  );
}
