import { ArrowLeft, FolderOpen, Loader2, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { LayerService, makeBaseLayer } from '@/core/canvas/layers/layer-service';
import type { Layer, ProjectFile } from '@/core/project/project-file';
import {
  getProductBaseSvg,
  listProjects,
  openProjectFolder,
  readProject,
  writeProject,
} from '@/data/repositories/projectFsRepository';
import { useCanvasEngine } from '@/hooks/useCanvasEngine';
import { Button } from '@/ui/components/button';

import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { Toolbar, type ToolId } from './Toolbar';

interface SaveTargets {
  engine: ReturnType<typeof useCanvasEngine>['engine'];
  project: ProjectFile | null;
  folderPath: string | null;
  layerService: LayerService | null;
}

export function EditorPage() {
  const params = useParams<{ folderName: string }>();
  const navigate = useNavigate();
  const folderName = decodeURIComponent(params.folderName ?? '');

  const [project, setProject] = useState<ProjectFile | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [tool, setTool] = useState<ToolId>('select');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [layerService, setLayerService] = useState<LayerService | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);

  const viewport = useMemo(() => project?.viewport ?? null, [project]);

  const { canvasRef, engine, selectedIds } = useCanvasEngine({
    viewport: viewport ?? { widthMm: 60, heightMm: 25, viewBox: '0 0 60 25' },
    onDirty: () => setDirty(true),
  });

  // ── Carregamento do projeto ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const all = await listProjects();
        if (cancelled) return;
        const match = all.find((p) => p.folderName === folderName);
        if (!match) {
          setError(`Projeto "${folderName}" não encontrado na pasta raiz.`);
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderName]);

  // ── Setup do canvas: cria LayerService + base SVG quando engine pronto ──
  useEffect(() => {
    if (!engine || !project) return;
    let active = true;

    const svc = new LayerService();
    const unsub = svc.subscribe((snap) => {
      if (active) setLayers(snap);
    });
    // Criação do recurso é responsabilidade legítima deste effect; a regra
    // react-hooks/set-state-in-effect não distingue criação de recurso
    // de cascata de renders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayerService(svc);

    void (async () => {
      try {
        if (project.layers.length === 0 && project.objects.length === 0) {
          const base = makeBaseLayer();
          svc.insert(base);
          try {
            const svg = await getProductBaseSvg(project.meta.productId);
            if (active) {
              await engine.loadBaseSvg(svg, base.id);
              if (active) setDirty(false);
            }
          } catch (err) {
            console.warn('Não foi possível carregar a base do produto:', err);
          }
        } else {
          for (const l of project.layers) svc.insert(l);
          await engine.loadFromProject(project);
          if (active) setDirty(false);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Erro montando canvas: ${msg}`);
      }
    })();

    return () => {
      active = false;
      unsub();
      setLayerService(null);
    };
  }, [engine, project]);

  // ── Save (via ref para ler valores atuais dentro de async handlers) ────
  // O pattern "ref atualizada durante render" é necessário porque o
  // handler de keydown é registrado uma vez e precisa ler valores atuais
  // sem ser recriado a cada mudança de state.
  const saveTargetsRef = useRef<SaveTargets>({
    engine,
    project,
    folderPath,
    layerService,
  });
  // eslint-disable-next-line react-hooks/refs
  saveTargetsRef.current = { engine, project, folderPath, layerService };

  const savingRef = useRef(false);
  // eslint-disable-next-line react-hooks/refs
  savingRef.current = saving;

  async function handleSave(): Promise<void> {
    const { engine: e, project: p, folderPath: fp, layerService: ls } = saveTargetsRef.current;
    if (!e || !p || !fp || !ls) return;
    if (savingRef.current) return;
    setSaving(true);
    try {
      const updated: ProjectFile = {
        ...p,
        layers: ls.list(),
        objects: e.serializeObjects(),
      };
      await writeProject(fp, updated);
      setProject(updated);
      setDirty(false);
      toast.success('Projeto salvo.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // ── Atalhos: Delete, Esc, Ctrl+S, V/R/O/L/T ────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const editing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (editing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (engine && engine.removeSelected() > 0) {
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape') {
        engine?.discardSelection();
        setTool('select');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
        return;
      }
      if (e.key.toLowerCase() === 'v') setTool('select');
      if (e.key.toLowerCase() === 'r') setTool('rect');
      if (e.key.toLowerCase() === 'o') setTool('circle');
      if (e.key.toLowerCase() === 'l') setTool('line');
      if (e.key.toLowerCase() === 't') setTool('text');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  // ── Tool switch: dispara inserção da forma. ────────────────────────────
  // Roda como evento de seleção de ferramenta — reset do tool é feito
  // via cancellation flag (não há setState dentro do effect quando entra).
  useEffect(() => {
    if (!engine || !layerService) return;
    if (tool === 'select') return;
    const editable = layerService.topVisibleEditable();
    const targetLayerId = editable ? editable.id : layerService.create();
    switch (tool) {
      case 'rect':
        engine.addRectangle({ layerId: targetLayerId });
        break;
      case 'circle':
        engine.addCircle({ layerId: targetLayerId });
        break;
      case 'line':
        engine.addLine({ layerId: targetLayerId });
        break;
      case 'text':
        engine.addText({ layerId: targetLayerId });
        break;
    }
    // Volta para select numa microtask para escapar do corpo do effect.
    queueMicrotask(() => setTool('select'));
  }, [tool, engine, layerService]);

  async function handleReveal() {
    if (!folderPath) return;
    try {
      await openProjectFolder(folderPath);
    } catch (err) {
      toast.error(`Erro ao abrir pasta: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <main className="flex h-full min-h-screen flex-col bg-ink-950 text-ink-100">
        <header className="flex items-center gap-3 border-b border-ink-800 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-semibold">Erro</h1>
        </header>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-md rounded-md border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-sm text-danger">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="flex h-full min-h-screen items-center justify-center bg-ink-950 font-mono text-sm text-ink-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando projeto…
      </main>
    );
  }

  const selectedId = selectedIds[0] ?? null;

  return (
    <main className="flex h-full min-h-screen flex-col bg-ink-950 text-ink-100">
      <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Voltar"
            onClick={() => navigate('/')}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold text-ink-100">{project.meta.name}</h1>
            <p className="font-mono text-[10px] text-ink-500">
              {project.meta.productId} · {project.viewport.widthMm}×{project.viewport.heightMm} mm
              {dirty && <span className="ml-1 text-laser">●</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReveal}
            disabled={!folderPath}
            className="h-8"
          >
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            Pasta
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
            className="h-8"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Toolbar activeTool={tool} onToolChange={setTool} disabled={layers.length === 0} />

        <section className="relative flex flex-1 items-center justify-center overflow-auto bg-ink-975 p-6">
          <div className="rounded-sm border border-ink-800 shadow-lg">
            <canvas ref={canvasRef} className="block" />
          </div>
        </section>

        <aside className="flex w-72 flex-col border-l border-ink-800 bg-ink-925">
          <PropertiesPanel engine={engine} selectedId={selectedId} />
          <div className="flex-1 border-t border-ink-800">
            <LayersPanel layers={layers} layerService={layerService} engine={engine} />
          </div>
        </aside>
      </div>
    </main>
  );
}
