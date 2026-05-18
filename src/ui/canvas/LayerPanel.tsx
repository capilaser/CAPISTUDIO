/**
 * LayerPanel.tsx (Onda 7) — painel hierárquico de camadas estilo Photoshop.
 *
 * Renderiza a lista retornada por `engine.getLayersHierarchy()` agrupando
 * apliques principais e seus filhos (slots/visuais), com órfãos no fim.
 *
 * Reage a:
 *   - selection:created/updated/cleared do canvas → atualiza linha destacada
 *   - object:added/object:removed → reconstrói a hierarquia
 *   - layer-meta-changed (custom, disparado pelo engine) → idem
 *
 * Clicar numa linha seleciona o objeto no canvas. Os botões de ação
 * chamam métodos do engine que disparam `layer-meta-changed` → o painel
 * se reconstrói via o mesmo listener. Loop completo, zero estado
 * duplicado no React.
 */
import { forwardRef, useEffect, useImperativeHandle, useState, type RefObject } from 'react';
import * as fabric from 'fabric';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { CanvasEngine, isBaseObject, type LayerNode } from '@/core/canvas/canvas-engine';
import { getCapiId } from '@/core/canvas/capi-id';
import type { LayerBlendMode, LayerColorLabel } from '@/data/schema';
import { DeleteLayerDialog } from './layer-panel/DeleteLayerDialog';
import { LayerContextMenu } from './layer-panel/LayerContextMenu';
import { PanelHeader } from './layer-panel/PanelHeader';
import { PanelFooter } from './layer-panel/PanelFooter';
import { PanelSearchBar } from './layer-panel/PanelSearchBar';
import { SortableLayerRow } from './layer-panel/SortableLayerRow';

/**
 * Onda 20.C — handle imperativo exposto via forwardRef. NovoPedidoPage
 * mantém um ref pro LayerPanel pra que a tecla Delete (atalho global do
 * canvas) consiga disparar o mesmo dialog de confirmação que o painel
 * usa internamente.
 */
export interface LayerPanelHandle {
  /**
   * Abre o dialog de confirmação pro id passado. Resolve o node na
   * hierarquia atual; se não achar (id inválido, layer sumiu), faz no-op
   * silencioso — não trava UI.
   */
  requestDeleteByCanvasId: (id: string) => void;
}

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /**
   * Onda 15 — sinal de que o engine ficou pronto. Quando este boolean
   * transita false→true, o painel re-anexa listeners (caso tenha sido
   * montado ANTES do engine existir).
   *
   * Onda 15.fix — quando o engine é TROCADO (não só "ficou pronto" — outra
   * instância), `engineReady` pode permanecer true entre as duas, e o
   * useEffect do painel não re-roda. Resultado: listeners atados ao canvas
   * antigo (já disposed). Pra resolver, callers que recriam engine devem
   * passar `engineVersion: number` que incrementa a cada novo engine. O
   * painel usa esse número como dep do useEffect.
   *
   * Default true: pra callers que já têm o engine pronto no mount
   * (ex: /dev/canvas-test).
   */
  engineReady?: boolean;
  /**
   * Onda 15.fix — incrementado a cada novo engine. Quando muda, força
   * re-anexação dos listeners do canvas (cleanup do anterior + setup no novo).
   * Default 0 — pra callers single-engine (ex: /dev/canvas-test).
   */
  engineVersion?: number;
  /**
   * Onda 15 — quando o componente é embutido em uma sidebar que já tem
   * header próprio (NovoPedidoLayerSidebar, PadraoEditorPage), passamos
   * false pra evitar duplicar "Camadas" na tela. Default true.
   */
  showTitle?: boolean;
}

interface DeleteTarget {
  id: string;
  name: string;
  cascadeChildren: string[];
}

export const LayerPanel = forwardRef<LayerPanelHandle, Props>(function LayerPanel(
  { engineRef, engineReady = true, engineVersion = 0, showTitle = true },
  ref
): React.ReactElement {
  const [hierarchy, setHierarchy] = useState<LayerNode[]>([]);
  /**
   * Onda 26 Fase 4 — multi-seleção. Fonte de verdade no painel; sincronia
   * com Fabric ActiveSelection feita no handleSelect e no listener.
   * `primarySelectedId` é o último item clicado — vira o anchor pro
   * próximo Shift+click (range).
   */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  /**
   * Onda 26 — incrementa a cada object:modified / added / removed /
   * layer-meta-changed pra invalidar thumbnails. LayerThumbnail recebe
   * como prop e re-renderiza no useEffect.
   */
  const [thumbRevision, setThumbRevision] = useState<number>(0);
  /**
   * Onda 26 Fase 5 — busca incremental por nome. Esconde rows sem match,
   * mas mantém principais visíveis se algum filho deu match (contexto).
   */
  const [searchQuery, setSearchQuery] = useState<string>('');
  /**
   * Onda 26 Fase 5 — ids de principais colapsadas. Filhos escondem.
   * Estado local — não persiste; cada reload começa expandido.
   */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  /**
   * Map id → { idx, canMoveUp, canMoveDown } pré-calculado dentro dos
   * listeners (NÃO durante render — ESLint react-hooks/refs proíbe ler
   * refs durante render). Updated junto com hierarchy.
   */
  const [zOrder, setZOrder] = useState<Map<string, { canMoveUp: boolean; canMoveDown: boolean }>>(
    new Map()
  );

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;

    // Recalcula tudo: hierarchy + selectedIds + zOrder. Centralizado aqui
    // pra evitar leitura de ref durante render do componente.
    const refresh = (): void => {
      setHierarchy(engine.getLayersHierarchy());

      // Onda 26 Fase 4 — lê seleção do Fabric, podendo ser ActiveSelection
      // (múltiplos objetos). Popula selectedIds e elege primary = último.
      const active = canvas.getActiveObject();
      const ids = new Set<string>();
      if (active && !isBaseObject(active)) {
        // ActiveSelection do Fabric 6 tem _objects (multi-seleção). Tipo
        // não exporta direto; cast pra ler.
        const inner = (active as unknown as { _objects?: fabric.FabricObject[] })._objects;
        if (inner && inner.length > 0) {
          for (const o of inner) {
            if (isBaseObject(o)) continue;
            const id = getCapiId(o as unknown as Record<string, unknown>);
            if (id) ids.add(id);
          }
        } else {
          const id = getCapiId(active as unknown as Record<string, unknown>);
          if (id) ids.add(id);
        }
      }
      setSelectedIds(ids);
      // Primary = só atualiza se mudou (preserva o último click manual).
      setPrimarySelectedId((prev) => {
        if (prev !== null && ids.has(prev)) return prev;
        // Pega qualquer um do set (último iterando se houver).
        let last: string | null = null;
        for (const id of ids) last = id;
        return last;
      });

      // Z-order: descobre topo/fundo entre USER objects e popula mapa.
      const objs = canvas.getObjects();
      const userIdxs = objs.filter((o) => !isBaseObject(o)).map((o) => objs.indexOf(o));
      const minUserIdx = userIdxs.length > 0 ? Math.min(...userIdxs) : -1;
      const maxUserIdx = userIdxs.length > 0 ? Math.max(...userIdxs) : -1;
      const map = new Map<string, { canMoveUp: boolean; canMoveDown: boolean }>();
      for (const obj of objs) {
        if (isBaseObject(obj)) continue;
        const id = getCapiId(obj as unknown as Record<string, unknown>);
        if (!id) continue;
        const idx = objs.indexOf(obj);
        map.set(id, { canMoveUp: idx < maxUserIdx, canMoveDown: idx > minUserIdx });
      }
      setZOrder(map);
    };

    const handler = (): void => refresh();

    // Onda 26 — bump dedicado pros thumbs: object:modified (drag/scale)
    // só precisa invalidar imagem, não reconstruir a árvore.
    const bumpThumbs = (): void => setThumbRevision((r) => r + 1);

    // Onda 26 — layer-meta-changed precisa fazer AMBOS: refresh (mudou
    // visible/locked/opacity/nome) + bumpThumbs (opacity afeta visual).
    const handlerWithBump = (): void => {
      refresh();
      bumpThumbs();
    };

    canvas.on('selection:created', handler);
    canvas.on('selection:updated', handler);
    canvas.on('selection:cleared', handler);
    canvas.on('object:added', handler);
    canvas.on('object:removed', handler);
    canvas.on('object:modified', bumpThumbs);
    // Evento custom — Fabric 6 não tem no tipo. Cast no on().
    (canvas as unknown as { on: (n: string, h: () => void) => void }).on(
      'layer-meta-changed',
      handlerWithBump
    );

    // Render inicial — caso já existam camadas quando o painel monta.
    refresh();

    return () => {
      canvas.off('selection:created', handler);
      canvas.off('selection:updated', handler);
      canvas.off('selection:cleared', handler);
      canvas.off('object:added', handler);
      canvas.off('object:removed', handler);
      canvas.off('object:modified', bumpThumbs);
      (canvas as unknown as { off: (n: string, h: () => void) => void }).off(
        'layer-meta-changed',
        handlerWithBump
      );
    };
    // engineRef é estável. engineReady + engineVersion são os sinais pra
    // re-anexar quando o engine fica pronto ou é trocado (ver JSDoc das props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, engineVersion]);

  // Reparent options: lista de apliques + opção "Solto" — recalculada
  // a partir da hierarchy atual. Sem useMemo: cálculo é O(N principais).
  const reparentOptions: Array<{ id: string | null; name: string }> = [
    { id: null, name: 'Solto (sem aplique pai)' },
    ...hierarchy
      .filter((n): n is Extract<LayerNode, { kind: 'principal' }> => n.kind === 'principal')
      .map((n) => ({ id: n.id, name: n.name })),
  ];

  // Achata a árvore em uma lista pra renderização linear com indentação.
  // Onda 26 Fase 5:
  //   - filtro por busca: rows sem match no nome somem; principais
  //     permanecem se algum filho deu match (preserva contexto).
  //   - collapsed: principais colapsadas escondem seus filhos. Busca
  //     ativa força expansão (override) — UX clássico Photoshop/Figma.
  type FlatNode = { node: LayerNode; indentPx: number };
  const flat: FlatNode[] = [];
  const q = searchQuery.trim().toLowerCase();
  const matches = (n: LayerNode): boolean => q.length === 0 || n.name.toLowerCase().includes(q);

  for (const top of hierarchy) {
    if (top.kind === 'principal') {
      const childrenMatched = top.children.filter(matches);
      const principalMatched = matches(top);
      // Inclui principal se ela mesma matchou OU se algum filho matchou.
      if (!principalMatched && childrenMatched.length === 0) continue;
      flat.push({ node: top, indentPx: 0 });
      const isCollapsed = collapsedIds.has(top.id);
      // Busca ativa expande automaticamente (mostra os matches).
      if (!isCollapsed || q.length > 0) {
        for (const child of childrenMatched.length > 0 ? top.children : []) {
          if (q.length > 0 && !matches(child)) continue;
          flat.push({ node: child, indentPx: 16 });
        }
      }
    } else {
      // Órfão (leaf top-level). Filtra por busca direta.
      if (matches(top)) flat.push({ node: top, indentPx: 0 });
    }
  }

  // ─── Handlers que disparam ações no engine ───────────────────────────────

  /**
   * Onda 26 Fase 4 — seleção com suporte a multi:
   *   click             → seleção única (substitui)
   *   Shift+click       → range do primary até o clicado (lista achatada)
   *   Ctrl/Cmd+click    → toggle individual no Set
   *
   * Sincroniza com Fabric: 0=discardActive, 1=setActiveObject, 2+=ActiveSelection.
   * O listener do canvas dispara refresh, que repopula selectedIds — então
   * NÃO chamamos setSelectedIds aqui (single source of truth: Fabric).
   */
  function handleSelect(id: string, e: React.MouseEvent): void {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;
    const objs = canvas.getObjects();

    const findObj = (capiId: string): fabric.FabricObject | undefined =>
      objs.find((o) => getCapiId(o as unknown as Record<string, unknown>) === capiId);

    const isShift = e.shiftKey;
    const isToggle = e.ctrlKey || e.metaKey;

    let nextIds: string[];
    if (isShift && primarySelectedId && primarySelectedId !== id) {
      // Range: pega tudo entre primary e id na lista achatada (inclusive).
      const flatIds = flat.map((f) => f.node.id);
      const iA = flatIds.indexOf(primarySelectedId);
      const iB = flatIds.indexOf(id);
      if (iA < 0 || iB < 0) {
        nextIds = [id];
      } else {
        const [lo, hi] = iA < iB ? [iA, iB] : [iB, iA];
        nextIds = flatIds.slice(lo, hi + 1);
      }
    } else if (isToggle) {
      const cur = new Set(selectedIds);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      nextIds = [...cur];
      setPrimarySelectedId(id);
    } else {
      nextIds = [id];
      setPrimarySelectedId(id);
    }

    if (nextIds.length === 0) {
      canvas.discardActiveObject();
    } else if (nextIds.length === 1) {
      const obj = findObj(nextIds[0]);
      if (obj) canvas.setActiveObject(obj);
    } else {
      const sel = nextIds.map(findObj).filter((o): o is fabric.FabricObject => !!o);
      if (sel.length === 1) {
        canvas.setActiveObject(sel[0]);
      } else if (sel.length > 1) {
        // ActiveSelection: ctor (Fabric 6) aceita array + opts com canvas.
        const ActiveSel = (
          fabric as unknown as {
            ActiveSelection: new (
              objs: fabric.FabricObject[],
              opts: { canvas: fabric.Canvas }
            ) => fabric.FabricObject;
          }
        ).ActiveSelection;
        const activeSel = new ActiveSel(sel, { canvas });
        canvas.setActiveObject(activeSel);
      }
    }
    canvas.requestRenderAll();
    // Listener 'selection:created/updated' refresca selectedIds — sem set aqui.
  }

  /**
   * Onda 26 Fase 4 — toggle visibility/lock respeita multi-seleção:
   * se o node clicado faz parte de selectedIds (>1), aplica em todos
   * (batch op). Se não faz parte, aplica só nele (intenção single
   * sobrescreve seleção atual).
   */
  function handleToggleVisible(node: LayerNode): void {
    const engine = engineRef.current;
    if (!engine) return;
    if (selectedIds.size > 1 && selectedIds.has(node.id)) {
      engine.setMultipleVisibility([...selectedIds], !node.visible);
    } else {
      engine.setLayerVisibility(node.id, !node.visible);
    }
  }

  function handleToggleLocked(node: LayerNode): void {
    const engine = engineRef.current;
    if (!engine) return;
    if (selectedIds.size > 1 && selectedIds.has(node.id)) {
      engine.setMultipleLocked([...selectedIds], !node.locked);
    } else {
      engine.setLayerLocked(node.id, !node.locked);
    }
  }

  function handleStartRename(id: string): void {
    setRenamingId(id);
  }

  function handleCommitRename(id: string, newName: string): void {
    engineRef.current?.renameLayer(id, newName);
    setRenamingId(null);
  }

  function handleCancelRename(): void {
    setRenamingId(null);
  }

  function handleDeleteRequest(node: LayerNode): void {
    if (node.kind === 'principal') {
      // Lista filhos pra mostrar no dialog.
      const children = node.children.map((c) => c.name);
      setDeleteTarget({ id: node.id, name: node.name, cascadeChildren: children });
    } else {
      setDeleteTarget({ id: node.id, name: node.name, cascadeChildren: [] });
    }
  }

  function handleDeleteConfirm(): void {
    if (!deleteTarget) return;
    const engine = engineRef.current;
    if (!engine) return;
    // Multi-seleção: se o alvo está dentro do set selecionado E há mais
    // de um, deleta todos. Caso contrário, single delete.
    let result: { deletedIds: string[] } | undefined;
    if (selectedIds.size > 1 && selectedIds.has(deleteTarget.id)) {
      result = engine.deleteMultipleLayers([...selectedIds]);
    } else {
      result = engine.deleteLayer(deleteTarget.id);
    }
    if (result) {
      const count = result.deletedIds.length;
      toast.success(count === 1 ? 'Camada excluída' : `${count} camadas excluídas`);
    }
    setDeleteTarget(null);
  }

  function handleDeleteCancel(): void {
    setDeleteTarget(null);
  }

  function handleMoveUp(id: string): void {
    engineRef.current?.moveLayer(id, 'up');
  }

  function handleMoveDown(id: string): void {
    engineRef.current?.moveLayer(id, 'down');
  }

  function handleReparent(id: string, newParentId: string | null): void {
    engineRef.current?.reparentLayer(id, newParentId);
  }

  function handleOpacityChange(id: string, next: number): void {
    const engine = engineRef.current;
    if (!engine) return;
    if (selectedIds.size > 1 && selectedIds.has(id)) {
      engine.setMultipleOpacity([...selectedIds], next);
    } else {
      engine.setLayerOpacity(id, next);
    }
  }

  /** Onda 26 Fase 5 — color label (propaga pra todos selecionados se multi). */
  function handleColorLabelChange(id: string, label: LayerColorLabel): void {
    const engine = engineRef.current;
    if (!engine) return;
    if (selectedIds.size > 1 && selectedIds.has(id)) {
      for (const sid of selectedIds) engine.setLayerColorLabel(sid, label);
    } else {
      engine.setLayerColorLabel(id, label);
    }
  }

  /** Onda 26 Fase 5 — blend mode (propaga pra todos selecionados se multi). */
  function handleBlendModeChange(id: string, mode: LayerBlendMode): void {
    const engine = engineRef.current;
    if (!engine) return;
    if (selectedIds.size > 1 && selectedIds.has(id)) {
      for (const sid of selectedIds) engine.setLayerBlendMode(sid, mode);
    } else {
      engine.setLayerBlendMode(id, mode);
    }
  }

  /** Onda 26 Fase 5 — toggle collapsed pra um principal. */
  function handleToggleCollapsed(id: string): void {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Fase 3: ações do context menu ──────────────────────────────────────

  async function handleDuplicate(id: string): Promise<void> {
    const newId = await engineRef.current?.duplicateLayer(id);
    if (newId) {
      toast.success('Camada duplicada');
    }
  }

  function handleSolo(id: string): void {
    engineRef.current?.soloLayer(id);
    toast.success('Camada isolada — clique no header pra restaurar');
  }

  function handleHideOthers(id: string): void {
    const engine = engineRef.current;
    if (!engine) return;
    // Esconde tudo exceto a alvo, sem mexer no estado da alvo.
    for (const meta of engine.getAllLayerMetas().values()) {
      if (meta.id === id) continue;
      if (meta.visible) engine.setLayerVisibility(meta.id, false);
    }
  }

  function handleMoveToTop(id: string): void {
    const engine = engineRef.current;
    if (!engine) return;
    const total = engine.canvas.getObjects().length;
    engine.moveLayerToIndex(id, total - 1);
  }

  function handleMoveToBottom(id: string): void {
    engineRef.current?.moveLayerToIndex(id, 0);
  }

  /**
   * Atalhos quando o painel tem foco (tabIndex=0 no container raiz):
   *   F2     → renomear inline
   *   Del    → abrir delete dialog
   *   Ctrl+D → duplicar
   *
   * Ignora quando o foco está num input/textarea/contenteditable —
   * F2/Del/Ctrl+D conflitariam com edição de texto.
   */
  function handlePanelKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
    // Onda 26 Fase 4 — usa primary como referência pros atalhos.
    if (!primarySelectedId) return;

    function findNode(nodes: LayerNode[]): LayerNode | null {
      for (const n of nodes) {
        if (n.id === primarySelectedId) return n;
        if (n.kind === 'principal') {
          const inner = findNode(n.children);
          if (inner) return inner;
        }
      }
      return null;
    }
    const node = findNode(hierarchy);
    if (!node) return;

    if (e.key === 'F2') {
      e.preventDefault();
      handleStartRename(node.id);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDeleteRequest(node);
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      if (node.kind !== 'principal') {
        e.preventDefault();
        void handleDuplicate(node.id);
      }
    }
  }

  // ─── Drag-and-drop (Fase 2) ──────────────────────────────────────────────
  //
  // Sensor com distance: 4 pra não capturar cliques curtos no handle (que
  // ainda funcionam como botões/atalhos). Distância pequena dá feedback
  // imediato no drag real.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  /**
   * Onda 26 Fase 4 — drag-end com 2 comportamentos:
   *
   * 1. Drop em row leaf  → reordena z-stack (moveLayerToIndex no canvas idx do over)
   * 2. Drop em row principal (e active é leaf) → REPARENT pra esse principal,
   *    e move pro topo do agrupamento (idx do principal alvo +1, clampeado).
   *
   * Active principal NUNCA é reparentado (invariante ADR 010 §1). Caso o
   * active seja principal, só reordena.
   *
   * Drop em si mesmo é no-op.
   */
  function handleDragEnd(e: DragEndEvent): void {
    const engine = engineRef.current;
    if (!engine) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeMeta = engine.getLayerMeta(activeId);
    const overMeta = engine.getLayerMeta(overId);
    if (!activeMeta || !overMeta) return;

    const objs = engine.canvas.getObjects();
    let activeIdx = -1;
    let overIdx = -1;
    for (let i = 0; i < objs.length; i += 1) {
      const id = getCapiId(objs[i] as unknown as Record<string, unknown>);
      if (id === activeId) activeIdx = i;
      else if (id === overId) overIdx = i;
    }
    if (activeIdx < 0 || overIdx < 0) return;

    // Caso reparent: active é leaf, over é principal, e o pai atual é diferente.
    const wantsReparent =
      activeMeta.kind !== 'principal' &&
      overMeta.kind === 'principal' &&
      activeMeta.parentLayerId !== overId;

    if (wantsReparent) {
      engine.reparentLayer(activeId, overId);
      // Move pra logo acima do principal-alvo no canvas (vira "primeiro
      // filho" visualmente). Clampeado por moveLayerToIndex.
      engine.moveLayerToIndex(activeId, overIdx + 1);
      toast.success(`Movido pra "${overMeta.name}"`);
    } else {
      engine.moveLayerToIndex(activeId, overIdx);
    }
  }

  // Onda 20.C — expõe entrada externa pro atalho Delete global. O caller
  // (NovoPedidoPage) segura um ref pro LayerPanel e chama
  // requestDeleteByCanvasId(id) quando a tecla Delete é pressionada com
  // um objeto ativo no canvas.
  useImperativeHandle(ref, () => ({
    requestDeleteByCanvasId(id: string) {
      function findInTree(nodes: LayerNode[]): LayerNode | null {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.kind === 'principal') {
            const inner = findInTree(n.children);
            if (inner) return inner;
          }
        }
        return null;
      }
      const node = findInTree(hierarchy);
      if (!node) return;
      handleDeleteRequest(node);
    },
  }));

  // ─── Render ──────────────────────────────────────────────────────────────

  // Conta total de camadas (todos os nós da árvore achatada).
  const totalLayers = flat.length;
  const selectedCount = selectedIds.size;

  // Onda 26 Fase 4 — selectedNode = primary (pra ações single como
  // delete via footer, F2 rename). Ações em lote usam selectedIds.
  const selectedNode = primarySelectedId
    ? (flat.find((f) => f.node.id === primarySelectedId)?.node ?? null)
    : null;

  // Estado vazio: pode ser "0 camadas reais" OU "busca filtrou tudo".
  if (flat.length === 0) {
    const isSearchEmpty = searchQuery.trim().length > 0 && hierarchy.length > 0;
    return (
      <div className="flex h-full flex-col">
        {showTitle && <PanelHeader total={hierarchy.length} selected={0} />}
        {showTitle && hierarchy.length > 0 && (
          <PanelSearchBar value={searchQuery} onChange={setSearchQuery} />
        )}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
          <Layers className="h-8 w-8 opacity-50" />
          {isSearchEmpty ? (
            <>
              <p>Nada encontrado.</p>
              <p className="text-center text-xs text-ink-500">
                Tente outro termo ou limpe a busca.
              </p>
            </>
          ) : (
            <>
              <p>Nenhuma camada ainda.</p>
              <p className="text-center text-xs text-ink-500">
                Adicione um aplique ou crie um slot pra começar.
              </p>
            </>
          )}
        </div>
        {showTitle && <PanelFooter hasSelection={false} onDelete={undefined} />}
      </div>
    );
  }

  return (
    <>
      <div
        className="flex h-full flex-col outline-none"
        data-testid="layer-panel"
        tabIndex={0}
        onKeyDown={handlePanelKeyDown}
      >
        {showTitle && (
          <div
            role="button"
            title="Clique pra restaurar a visibilidade de todas as camadas (desfaz Soloar)"
            onClick={() => engineRef.current?.soloLayer(null)}
            className="cursor-pointer"
          >
            <PanelHeader total={totalLayers} selected={selectedCount} />
          </div>
        )}
        {showTitle && <PanelSearchBar value={searchQuery} onChange={setSearchQuery} />}

        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flat.map((f) => f.node.id)}
              strategy={verticalListSortingStrategy}
            >
              {flat.map(({ node, indentPx }) => {
                const zo = zOrder.get(node.id);
                const canMoveUp = zo?.canMoveUp ?? false;
                const canMoveDown = zo?.canMoveDown ?? false;
                const opts = node.kind === 'principal' ? undefined : reparentOptions;

                return (
                  <LayerContextMenu
                    key={node.id}
                    node={node}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onRename={() => handleStartRename(node.id)}
                    onDuplicate={() => void handleDuplicate(node.id)}
                    onSolo={() => handleSolo(node.id)}
                    onHideOthers={() => handleHideOthers(node.id)}
                    onMoveToTop={() => handleMoveToTop(node.id)}
                    onMoveToBottom={() => handleMoveToBottom(node.id)}
                    onDelete={() => handleDeleteRequest(node)}
                    onColorLabelChange={(label) => handleColorLabelChange(node.id, label)}
                  >
                    <div>
                      <SortableLayerRow
                        node={node}
                        engineRef={engineRef}
                        thumbRevision={thumbRevision}
                        rowProps={{
                          selected: selectedIds.has(node.id),
                          renaming: renamingId === node.id,
                          indentPx,
                          reparentOptions: opts,
                          canMoveUp,
                          canMoveDown,
                          collapsed:
                            node.kind === 'principal' ? collapsedIds.has(node.id) : undefined,
                          onToggleCollapsed:
                            node.kind === 'principal'
                              ? () => handleToggleCollapsed(node.id)
                              : undefined,
                          onSelect: (e) => handleSelect(node.id, e),
                          onStartRename: () => handleStartRename(node.id),
                          onCommitRename: (name) => handleCommitRename(node.id, name),
                          onCancelRename: handleCancelRename,
                          onToggleVisible: () => handleToggleVisible(node),
                          onToggleLocked: () => handleToggleLocked(node),
                          onDelete: () => handleDeleteRequest(node),
                          onMoveUp: () => handleMoveUp(node.id),
                          onMoveDown: () => handleMoveDown(node.id),
                          onReparent: (newParentId) => handleReparent(node.id, newParentId),
                          onOpacityChange: (next) => handleOpacityChange(node.id, next),
                          onBlendModeChange: (mode) => handleBlendModeChange(node.id, mode),
                        }}
                      />
                    </div>
                  </LayerContextMenu>
                );
              })}
            </SortableContext>
          </DndContext>
        </div>

        {showTitle && (
          <PanelFooter
            hasSelection={selectedNode !== null}
            onDuplicate={
              selectedNode && selectedNode.kind !== 'principal'
                ? () => void handleDuplicate(selectedNode.id)
                : undefined
            }
            onDelete={selectedNode ? () => handleDeleteRequest(selectedNode) : undefined}
          />
        )}
      </div>

      <DeleteLayerDialog
        open={deleteTarget !== null}
        layerName={deleteTarget?.name ?? ''}
        cascadeChildren={deleteTarget?.cascadeChildren ?? []}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
});
LayerPanel.displayName = 'LayerPanel';
