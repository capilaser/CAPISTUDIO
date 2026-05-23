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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { LayerPanel } from '@/ui/canvas/LayerPanel';
import AppLayout from '@/ui/layout/AppLayout';

import { labelFromPatternRole } from './label-from-pattern-role';
import { ObjectPropertiesPanel, type ObjectGeometry } from './ObjectPropertiesPanel';
import {
  PatternClassificationPanel,
  type PatternClassificationState,
} from './PatternClassificationPanel';
import { PatternValidationDialog } from './PatternValidationDialog';
import {
  summarizeLayerValidation,
  validatePattern,
  type PatternIssue,
} from '@/core/patterns/validate-pattern';
import { cn } from '@/lib/cn';
import type { LayerLocks, MachineCode, PatternRole, ProcessType } from '@/data/schema';

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
  // Onda 32 — confirmação forte exigida pelo CLAUDE.md para "Atualizar padrão mestre".
  // Só abre quando isEditMode = true. Modo CRIAR salva direto.
  const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
  // Onda 36 — pre-check de validação no save. Modo 'block' lista errors;
  // 'confirm-save' lista warnings com botão "Salvar mesmo assim".
  const [validation, setValidation] = useState<{
    open: boolean;
    mode: 'block' | 'confirm-save';
    errors: PatternIssue[];
    warnings: PatternIssue[];
  }>({ open: false, mode: 'block', errors: [], warnings: [] });
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
  //
  // Onda 37 Fix-1: prioriza patternRole (Onda 33) na hora de escolher label.
  // Antes, qualquer placeholder de AREA classificada saía como "Forma" — o
  // operador não conseguia distinguir uma área inteligente de um retângulo
  // decorativo só pelo painel. Ordem:
  //   1. Slot tradicional (legado capiSlot) → "Slot · Nome/Profissão/..."
  //   2. patternRole presente → label de classificação (Área · Texto, etc)
  //   3. Fallback → "Forma"
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
    const meta = engine.getLayerMeta(id);
    const label = slot
      ? `Slot · ${slot.type === 'profissao' ? 'Profissão' : slot.type === 'nome' ? 'Nome' : slot.type === 'logo' ? 'Logo' : 'Custom'}`
      : labelFromPatternRole(meta?.patternRole);
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

  /**
   * Onda 37 (ajuste de conceito) — "Área de Texto" e "Área de Logo" são
   * placeholders inteligentes da spec de templates (Onda 33). Substituem
   * o conceito antigo de slots fixos ('nome' / 'profissao' / 'logo'), que
   * acoplava o template ao conteúdo do pedido.
   *
   * Fluxo: criar Rect centralizado com dimensões padrão → converter em AREA
   * via `convertToArea` (preserva bounds em mm, troca o vetor por placeholder
   * tracejado, anota patternRole + boundsMm em LayerMeta).
   *
   * Decisão de tamanho default:
   *  - TEXT_AREA: 50% × 15% do produto (largo e baixo — formato típico de
   *    linha de texto).
   *  - LOGO_AREA: 30% × 30% (quadrado pequeno — formato típico de logo).
   * Ambos centralizados; operador ajusta depois via Properties Panel.
   */
  function handleAddTextArea() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const w = product.canvasMm.width * 0.5;
    const h = product.canvasMm.height * 0.15;
    const x = (product.canvasMm.width - w) / 2;
    const y = (product.canvasMm.height - h) / 2;
    const rect = engine.addRectangle(x, y, w, h);
    const id = (rect as unknown as { id?: string }).id;
    if (id) {
      engine.convertToArea(id, 'TEXT_AREA');
      refreshSelected(id);
      bumpClassification();
    }
    recalcSlotCount();
  }

  function handleAddLogoArea() {
    const engine = engineRef.current;
    if (!engine || !product) return;
    const w = product.canvasMm.width * 0.3;
    const h = product.canvasMm.height * 0.3;
    const x = (product.canvasMm.width - w) / 2;
    const y = (product.canvasMm.height - h) / 2;
    const rect = engine.addRectangle(x, y, w, h);
    const id = (rect as unknown as { id?: string }).id;
    if (id) {
      engine.convertToArea(id, 'LOGO_AREA');
      refreshSelected(id);
      bumpClassification();
    }
    recalcSlotCount();
  }

  function handleObjectPatch(patch: Partial<Pick<ObjectGeometry, 'x' | 'y' | 'width' | 'height'>>) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setObjectGeometryMm(selectedObject.id, patch);
    refreshSelected(selectedObject.id);
  }

  // ── Onda 33 — Classificação da camada selecionada ────────────────────────
  // Tick incremento força re-render do PatternClassificationPanel após cada
  // setPatternRole/setProcessRouting/setLayerLocks. Sem ele, o painel
  // não refletiria a mudança porque o engine muta layerMeta in-place.
  const [classificationTick, setClassificationTick] = useState(0);
  const bumpClassification = useCallback(() => setClassificationTick((t) => t + 1), []);

  // State derivado: snapshot dos 6 campos opcionais do LayerMeta selecionado.
  // Recomputado quando selectedObject ou classificationTick mudam.
  const classificationState: PatternClassificationState = (() => {
    void classificationTick; // depend on tick — sinal explícito de re-leitura
    const engine = engineRef.current;
    const layerId = selectedObject?.id ?? null;
    if (!engine || !layerId) {
      return {
        layerId: null,
        patternRole: undefined,
        processType: undefined,
        machineTargets: [],
        locks: {},
        hasChildren: false,
      };
    }
    const meta = engine.getLayerMeta(layerId);
    return {
      layerId,
      patternRole: meta?.patternRole,
      processType: meta?.processType,
      machineTargets: meta?.machineTargets ?? [],
      locks: meta?.lockGranular ?? {},
      hasChildren: engine.hasChildren(layerId),
    };
  })();

  // Onda 37 Fix-2 — status resumido pra mostrar no topo do PatternClassificationPanel.
  // Reusa validatePattern via summarizeLayerValidation (mesma source of truth do
  // bloqueio de save da Onda 36). Custo trivial (1 layer).
  const classificationValidationStatus = (() => {
    void classificationTick; // depende do tick — re-leitura quando engine muta
    const engine = engineRef.current;
    const layerId = selectedObject?.id ?? null;
    if (!engine || !layerId) return undefined;
    const meta = engine.getLayerMeta(layerId);
    return summarizeLayerValidation(meta, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });
  })();

  // Onda 37 Fix-5 — contador global discreto no header. Roda validatePattern
  // sobre TODAS as layers e resume "Tudo válido" / "⚠ N problemas" para o
  // operador bater o olho antes de salvar. Reusa source-of-truth do bloqueio
  // de save (Onda 36); aqui só é leitura visual.
  const headerValidationSummary = (() => {
    void classificationTick; // mesma dependência
    const engine = engineRef.current;
    if (!engine) return null;
    const layers = Array.from(engine.getAllLayerMetas().values());
    // Conta só layers classificadas — patterns antigos sem patternRole nunca
    // geram issue (retrocompat). Se nenhuma layer classificada, retornamos
    // null pra não poluir o header.
    const classifiedCount = layers.filter((l) => l.patternRole !== undefined).length;
    if (classifiedCount === 0) return null;
    const { errors, warnings } = validatePattern(layers, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });
    const total = errors.length + warnings.length;
    return { errors: errors.length, warnings: warnings.length, total };
  })();

  function handleSetPatternRole(role: PatternRole | undefined) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setPatternRole(selectedObject.id, role);
    bumpClassification();
  }

  function handleSetProcess(process: ProcessType | undefined) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setProcessRouting(selectedObject.id, process, classificationState.machineTargets);
    bumpClassification();
  }

  function handleSetMachines(machines: MachineCode[]) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setProcessRouting(selectedObject.id, classificationState.processType, machines);
    bumpClassification();
  }

  function handleSetLock(key: keyof LayerLocks, value: boolean) {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    engine.setLayerLocks(selectedObject.id, { [key]: value });
    bumpClassification();
  }

  function handleConvertToArea(role: 'TEXT_AREA' | 'LOGO_AREA') {
    const engine = engineRef.current;
    if (!engine || !selectedObject) return;
    const ok = engine.convertToArea(selectedObject.id, role);
    if (!ok) {
      toast.error('Não foi possível converter esta camada em área.');
      return;
    }
    // ID preservado — selectedObject ainda aponta pro mesmo lugar.
    // refreshSelected captura a nova geometria do placeholder (igual à do
    // vetor original).
    refreshSelected(selectedObject.id);
    bumpClassification();
    toast.success(`Convertido em ${role}.`);
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

  /**
   * Onda 32 — `handleSave` agora valida o nome e, em modo EDIT, abre o dialog
   * de confirmação forte (CLAUDE.md regra crítica: "padrão mestre é IMUTÁVEL
   * no fluxo normal; só Atualizar com confirmação forte"). Modo CRIAR salva
   * direto. A persistência real fica em `doSave`.
   */
  function handleSave() {
    if (saving) return;
    const engine = engineRef.current;
    if (!engine || !product) return;
    const name = patternName.trim();
    if (name.length < 2) {
      toast.error('Dê um nome ao padrão (mínimo 2 caracteres).');
      return;
    }

    // Onda 36 — validação estrutural antes do save. Errors bloqueiam;
    // warnings exigem confirmação explícita via dialog.
    const layers = Array.from(engine.getAllLayerMetas().values());
    const { errors, warnings } = validatePattern(layers, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });
    if (errors.length > 0) {
      setValidation({ open: true, mode: 'block', errors, warnings });
      return;
    }
    if (warnings.length > 0) {
      setValidation({ open: true, mode: 'confirm-save', errors: [], warnings });
      return;
    }

    if (isEditMode) {
      setConfirmUpdateOpen(true);
      return;
    }
    void doSave();
  }

  /**
   * Onda 36 — chamado quando o usuário confirma "Salvar mesmo assim" no
   * dialog de warnings. Pula a re-validação (já validamos no handleSave)
   * e segue pra confirmação forte de edit ou salva direto em modo create.
   */
  function handleConfirmSaveWithWarnings() {
    setValidation((v) => ({ ...v, open: false }));
    if (isEditMode) {
      setConfirmUpdateOpen(true);
      return;
    }
    void doSave();
  }

  async function doSave() {
    if (saving) return;
    const engine = engineRef.current;
    if (!engine || !product) return;
    const name = patternName.trim();
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
      setConfirmUpdateOpen(false);
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
          {/* Onda 37 Fix-5 — contador global discreto. Aparece só quando o
              pattern tem layers classificadas. Verde = tudo válido, âmbar =
              avisos, vermelho = erros (bloqueia save). */}
          {headerValidationSummary && (
            <div
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-wider',
                headerValidationSummary.errors > 0
                  ? 'border border-danger/30 bg-danger/5 text-danger'
                  : headerValidationSummary.warnings > 0
                    ? 'border border-warn/30 bg-warn/5 text-warn'
                    : 'border border-ok/30 bg-ok/5 text-ok'
              )}
              title={
                headerValidationSummary.errors > 0
                  ? `${headerValidationSummary.errors} erro(s) bloqueia(m) o save`
                  : headerValidationSummary.warnings > 0
                    ? `${headerValidationSummary.warnings} aviso(s) — save pede confirmação`
                    : 'Padrão pronto para salvar'
              }
            >
              {headerValidationSummary.errors > 0 ? (
                <>
                  ⚠ {headerValidationSummary.errors} erro
                  {headerValidationSummary.errors === 1 ? '' : 's'}
                </>
              ) : headerValidationSummary.warnings > 0 ? (
                <>
                  ⚠ {headerValidationSummary.warnings} aviso
                  {headerValidationSummary.warnings === 1 ? '' : 's'}
                </>
              ) : (
                <>✓ Tudo válido</>
              )}
            </div>
          )}
          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={saving || !ready}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : isEditMode ? 'Atualizar padrão' : 'Salvar padrão'}
          </Button>
        </div>

        {/* Onda 32 — Dialog de confirmação forte pra atualizar padrão mestre.
            CLAUDE.md exige confirmação explícita: padrão mestre é a fonte de
            verdade pra todos os pedidos novos. Mudar afeta exibição da galeria
            mas NÃO afeta pedidos antigos (snapshot por revisão isola). */}
        <Dialog open={confirmUpdateOpen} onOpenChange={setConfirmUpdateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Atualizar padrão mestre?</DialogTitle>
              <DialogDescription className="space-y-2 pt-2 text-xs">
                <span className="block">
                  Você vai sobrescrever o padrão <b>"{patternName.trim()}"</b>. Esta ação não pode
                  ser desfeita.
                </span>
                <span className="block text-muted-foreground">
                  Pedidos antigos que usaram este padrão <b>não serão afetados</b> — eles têm
                  snapshot próprio. Mas pedidos novos vão herdar o padrão atualizado.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmUpdateOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button variant="default" size="sm" onClick={() => void doSave()} disabled={saving}>
                {saving ? 'Atualizando…' : 'Atualizar padrão'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Onda 36 — dialog de validação estrutural. Errors bloqueiam save;
            warnings pedem confirmação explícita. Layers legadas (sem
            patternRole) não geram issue, então este dialog só aparece
            quando o operador classificou camadas com Onda 33. */}
        <PatternValidationDialog
          open={validation.open}
          mode={validation.mode}
          errors={validation.errors}
          warnings={validation.warnings}
          onCancel={() => setValidation((v) => ({ ...v, open: false }))}
          onConfirm={handleConfirmSaveWithWarnings}
          busy={saving}
        />

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
                {/* Onda 37 (ajuste de conceito) — campos inteligentes da spec
                    de templates. Substituem "Campo de Nome/Profissão/Logo"
                    do modelo antigo, que acoplava o template ao conteúdo do
                    pedido. Agora: Área de Texto/Logo são genéricas; nome,
                    profissão, cargo, etc são apenas TEXTO digitado pelo
                    operador depois. */}
                <DropdownMenuItem onClick={handleAddTextArea} className="gap-2">
                  <Type className="h-4 w-4" />
                  Área de Texto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddLogoArea} className="gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Área de Logo
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

            {/* Onda 33 — Classificação semântica da camada (spec templates).
                Onda 37 Fix-2: também recebe status resumido pra mostrar de
                relance se a layer está OK ou incompleta. */}
            <PatternClassificationPanel
              state={classificationState}
              validationStatus={classificationValidationStatus}
              onSetPatternRole={handleSetPatternRole}
              onSetProcess={handleSetProcess}
              onSetMachines={handleSetMachines}
              onSetLock={handleSetLock}
              onConvertToArea={handleConvertToArea}
            />

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
