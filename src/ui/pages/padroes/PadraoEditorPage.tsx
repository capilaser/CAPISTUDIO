/**
 * PadraoEditorPage — Onda 14c
 *
 * Editor de padrão master. Funciona em 2 modos:
 *
 *   • CRIAR  — /padroes/novo?product=X — canvas inicia com a base do produto,
 *              sem slots. Usuário adiciona slots e salva (insertPattern).
 *
 *   • EDITAR — /padroes/editar/:id — carrega pattern existente em cima da
 *              base do produto e atualiza (updatePattern). Tags do pattern
 *              são editáveis na topbar como chips.
 *
 * O componente decide o modo via presença do param `:id` na rota.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Save,
  Type,
  ImagePlus,
  Briefcase,
  X as XIcon,
  Square,
  Minus,
  RectangleHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import {
  getById as getMaterialById,
  resolveAssetUrl,
} from '@/data/repositories/materialRepository';
import {
  getPatternById,
  insertPattern,
  updatePattern,
} from '@/data/repositories/patternRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';
import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { LayerPanel } from '@/ui/canvas/LayerPanel';
import AppLayout from '@/ui/layout/AppLayout';

import { ObjectPropertiesPanel, type ObjectGeometry } from './ObjectPropertiesPanel';

const VIEWPORT = { widthPx: 900, heightPx: 600 };

export default function PadraoEditorPage() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const editingId = params.id ?? null;
  const isEditMode = editingId !== null;
  const productIdParam = searchParams.get('product') ?? '';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [patternName, setPatternName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Conta nó de slot pra UI da sidebar. Em modo edit, hidrata após deserialize.
  const [slotCount, setSlotCount] = useState(0);
  // Objeto atualmente selecionado no canvas (slot OU rect decorativo).
  const [selectedObject, setSelectedObject] = useState<ObjectGeometry | null>(null);

  const recalcSlotCount = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setSlotCount(engine.listAllSlots().length);
  }, []);

  // Helper: monta ObjectGeometry para o id selecionado (slot OU rect comum).
  const refreshSelected = useCallback((id: string | null) => {
    const engine = engineRef.current;
    if (!engine || !id) {
      setSelectedObject(null);
      return;
    }
    const geom = engine.getObjectGeometryMm(id);
    if (!geom) {
      setSelectedObject(null);
      return;
    }
    const slot = engine.getSlot(id);
    const label = slot
      ? `Slot · ${slot.type === 'profissao' ? 'Profissão' : slot.type === 'nome' ? 'Nome' : slot.type === 'logo' ? 'Logo' : 'Custom'}`
      : 'Forma';
    setSelectedObject({ id, label, ...geom });
  }, []);

  // Boot do editor — diverge por modo.
  useEffect(() => {
    let cancelled = false;
    let engine: CanvasEngine | null = null;

    async function boot() {
      try {
        // Resolve productId + nome iniciais conforme modo.
        let pid: string;
        let initialCanvasJson: unknown | null = null;
        let initialName = '';
        let initialTags: string[] = [];

        if (isEditMode) {
          const pattern = await getPatternById(editingId);
          if (cancelled) return;
          if (!pattern) {
            setError(`Padrão '${editingId}' não encontrado.`);
            return;
          }
          pid = pattern.productId;
          initialCanvasJson = pattern.canvasJson;
          initialName = pattern.name;
          initialTags = pattern.tags;
        } else {
          if (!productIdParam) {
            setError('Parâmetro `product` ausente. Use /padroes/novo?product=X.');
            return;
          }
          pid = productIdParam;
        }

        const p = await getProductById(pid);
        if (cancelled) return;
        if (!p) {
          setError(`Produto '${pid}' não encontrado.`);
          return;
        }
        if (!p.baseSvg) {
          setError(`Produto '${pid}' sem base_svg.`);
          return;
        }
        setProduct(p);
        setPatternName(initialName);
        setTags(initialTags);

        if (!canvasRef.current || cancelled) return;

        engine = new CanvasEngine(canvasRef.current, {
          productWidthMm: p.canvasMm.width,
          productHeightMm: p.canvasMm.height,
          viewportWidthPx: VIEWPORT.widthPx,
          viewportHeightPx: VIEWPORT.heightPx,
        });
        // Selection: cobre slot E objetos genéricos via onLayerSelectionChange.
        // (onSlotSelectionChange dispararia duplicado pra slots.)
        engine.onLayerSelectionChange = (id) => refreshSelected(id);
        engine.onSlotModified = (id) => refreshSelected(id);
        engine.onObjectModified = (id) => refreshSelected(id);
        const meta = parseCorelSvg(p.baseSvg);
        await engine.loadProductSvgFromMeta(meta);
        if (cancelled) {
          engine.dispose();
          return;
        }

        // Em modo edit, carrega o pattern em cima da base (deserialize preserva
        // a base do produto via clearUserObjects + isBaseObject).
        if (initialCanvasJson && typeof initialCanvasJson === 'object') {
          try {
            await engine.deserialize(
              initialCanvasJson as Parameters<typeof engine.deserialize>[0],
              async (materialId) => {
                const mat = await getMaterialById(materialId);
                if (!mat) throw new Error(`Material not found: ${materialId}`);
                return resolveAssetUrl(mat);
              }
            );
          } catch (err) {
            console.error('[PadraoEditorPage] deserialize failed:', err);
            toast.error(`Erro ao carregar padrão: ${String(err)}`);
          }
        }

        engineRef.current = engine;
        recalcSlotCount();
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    void boot();

    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [isEditMode, editingId, productIdParam, recalcSlotCount, refreshSelected]);

  function handleAddSlot(type: 'nome' | 'profissao' | 'logo') {
    const engine = engineRef.current;
    if (!engine) return;
    engine.createSlot(type);
    recalcSlotCount();
  }

  function handleObjectPatch(patch: Partial<Pick<ObjectGeometry, 'x' | 'y' | 'width' | 'height'>>) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setObjectGeometryMm(selectedObject.id, patch);
    refreshSelected(selectedObject.id);
  }

  // ── Adicionadores de formas decorativas ───────────────────────────────────
  // Cada um cria um retângulo via engine.addRectangle() (que setou fill +
  // stroke padrão) e ajusta o estilo para a função semântica desejada.
  // O painel de propriedades funciona depois pra ajuste fino.

  /** Borda decorativa: contorno INTERNO ao produto, com margem padrão de 1mm. */
  function handleAddBorda() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const margin = 1; // mm
    const w = product.canvasMm.width - 2 * margin;
    const h = product.canvasMm.height - 2 * margin;
    if (w <= 0 || h <= 0) return;
    const rect = engine.addRectangle(margin, margin, w, h);
    // Sem preenchimento, só stroke — é uma borda decorativa.
    rect.set({ fill: 'transparent', stroke: '#c0caf5', strokeWidth: 0.4 });
    rect.canvas?.requestRenderAll();
  }

  /** Traço horizontal fino centralizado verticalmente, margem 1mm lateral. */
  function handleAddTracoH() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const margin = 1;
    const thickness = 0.4; // mm
    const w = product.canvasMm.width - 2 * margin;
    const y = (product.canvasMm.height - thickness) / 2;
    if (w <= 0) return;
    const rect = engine.addRectangle(margin, y, w, thickness);
    rect.set({ fill: '#c0caf5', stroke: '#c0caf5', strokeWidth: 0 });
    rect.canvas?.requestRenderAll();
  }

  /** Traço vertical fino centralizado horizontalmente, margem 1mm topo/base. */
  function handleAddTracoV() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const margin = 1;
    const thickness = 0.4;
    const h = product.canvasMm.height - 2 * margin;
    const x = (product.canvasMm.width - thickness) / 2;
    if (h <= 0) return;
    const rect = engine.addRectangle(x, margin, thickness, h);
    rect.set({ fill: '#c0caf5', stroke: '#c0caf5', strokeWidth: 0 });
    rect.canvas?.requestRenderAll();
  }

  /** Retângulo livre: começa centralizado, dimensões aproximadas a 1/3 do produto. */
  function handleAddRetangulo() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const w = product.canvasMm.width / 3;
    const h = product.canvasMm.height / 3;
    const x = (product.canvasMm.width - w) / 2;
    const y = (product.canvasMm.height - h) / 2;
    engine.addRectangle(x, y, w, h);
    // Mantém o fill default — operador customiza visualmente arrastando.
  }

  function handleAddTag() {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, '-');
    if (t.length === 0) return;
    if (tags.includes(t)) {
      setTagDraft('');
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagDraft('');
  }

  function handleRemoveTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSave() {
    if (saving) return;
    const engine = engineRef.current;
    if (!engine || !product) return;
    const name = patternName.trim();
    if (name.length < 2) {
      toast.error('Dê um nome ao padrão (mínimo 2 caracteres).');
      return;
    }
    setSaving(true);
    try {
      const data = engine.serialize([{ productId: product.id, offsetX: 0, offsetY: 0 }]);
      const canvasJsonStr = JSON.stringify(data);

      if (isEditMode && editingId) {
        await updatePattern(editingId, { name, canvasJson: canvasJsonStr, tags });
        toast.success(`Padrão "${name}" atualizado`);
      } else {
        const id = `pattern-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        await insertPattern(id, product.id, name, canvasJsonStr, tags);
        toast.success(`Padrão "${name}" salvo`);
      }
      navigate('/padroes');
    } catch (err) {
      console.error('[PadraoEditorPage] save failed:', err);
      toast.error(`Erro ao salvar: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <AppLayout breadcrumb={[{ label: 'Padrões', href: '/padroes' }, { label: 'Editor' }]}>
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumb={[{ label: 'Padrões', href: '/padroes' }, { label: 'Editor' }]}>
      <div className="flex h-full flex-col">
        {/* Topbar */}
        <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-2">
          <div className="flex flex-1 items-center gap-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isEditMode ? 'Editar padrão' : 'Padrão'}
            </span>
            <input
              type="text"
              value={patternName}
              onChange={(e) => setPatternName(e.target.value)}
              placeholder="Nome do padrão"
              className="h-7 min-w-[240px] rounded-md border border-transparent bg-transparent px-2 text-xs text-foreground transition-colors placeholder:text-muted-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {product && (
              <span className="text-[10px] text-muted-foreground">· {product.label}</span>
            )}

            {/* Tags */}
            <div className="ml-2 flex flex-wrap items-center gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-full border border-border bg-background/40 py-0 pl-2 pr-1 text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="rounded-full p-0.5 hover:bg-background/80 hover:text-foreground"
                    aria-label={`Remover tag ${t}`}
                  >
                    <XIcon className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  } else if (e.key === 'Backspace' && tagDraft === '' && tags.length > 0) {
                    handleRemoveTag(tags[tags.length - 1]);
                  }
                }}
                onBlur={handleAddTag}
                placeholder="+ tag"
                className="h-6 w-20 rounded-md border border-transparent bg-transparent px-1.5 text-[10px] uppercase tracking-wider text-foreground transition-colors placeholder:text-muted-foreground/60 hover:border-border focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleSave()}
            disabled={saving || !ready}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : isEditMode ? 'Atualizar padrão' : 'Salvar padrão'}
          </Button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Estrutura
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {slotCount} {slotCount === 1 ? 'campo' : 'campos'}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="w-full gap-2" disabled={!ready}>
                  <Plus className="h-4 w-4" />
                  Adicionar campo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-56">
                <DropdownMenuItem onClick={() => handleAddSlot('nome')} className="gap-2">
                  <Type className="h-4 w-4" />
                  Campo de Nome
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddSlot('profissao')} className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  Campo de Profissão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddSlot('logo')} className="gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Campo de Logo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddBorda} className="gap-2">
                  <Square className="h-4 w-4" />
                  Borda (contorno interno)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddTracoH} className="gap-2">
                  <Minus className="h-4 w-4" />
                  Traço horizontal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddTracoV} className="gap-2">
                  <Minus className="h-4 w-4 rotate-90" />
                  Traço vertical
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddRetangulo} className="gap-2">
                  <RectangleHorizontal className="h-4 w-4" />
                  Retângulo livre
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <p className="text-[10px] text-muted-foreground/70">
              Posicione os campos no canvas arrastando. Salve quando estiver pronto.
            </p>

            {selectedObject && product && (
              <ObjectPropertiesPanel
                object={selectedObject}
                productBoundsMm={{
                  widthMm: product.canvasMm.width,
                  heightMm: product.canvasMm.height,
                }}
                onChange={handleObjectPatch}
              />
            )}

            {/* Onda 15 — painel de camadas no editor de padrão. */}
            <div className="-mx-4 mt-2 border-t border-border pt-2">
              <LayerPanel engineRef={engineRef} engineReady={ready} />
            </div>
          </aside>

          {/* Canvas central */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background p-6">
            <canvas
              ref={canvasRef}
              width={VIEWPORT.widthPx}
              height={VIEWPORT.heightPx}
              className="rounded-sm border border-border shadow-md"
            />
            {!ready && (
              <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-muted-foreground/70">
                carregando…
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
