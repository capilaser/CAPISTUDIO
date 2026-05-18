/**
 * NovoPedidoPage — editor de pedido (Onda 13.6).
 *
 * Onda 13.6: canvas ÚNICO mostra todos os broches empilhados. selectedIndex
 * ainda existe no store (sidebar destaca o broche ativo + textos vão pra
 * lista do ativo), mas o canvas não troca de conteúdo ao mudar o ativo —
 * mostra a prancha inteira sempre.
 *
 * Persistência (Onda 13.5):
 *   - Boot: lê ?id=X da URL. Se presente, carrega via getById e hidrata
 *     boardItems. Senão, auto-incrementa label de "Novo Pedido N".
 *   - Salvar: monta items[] do store. ?id= presente → saveRevision;
 *     senão createWithItems + navigate(?id=novoId).
 *   - canvasJson por item: persistido no banco mas atualmente NÃO usado
 *     pelo engine (engine recria os apliques do baseSvg + material a cada
 *     mudança de boardItems). Cache de canvasJson da Onda 13.5 fica
 *     dormente — vai voltar quando "salvar fine-tuning do broche" for
 *     repensado pra canvas único.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { svgErrorToToastArgs } from '@/core/canvas/corel-svg-errors';
import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  countAll,
  createWithItems,
  getById as getOrderById,
  saveRevision,
  type OrderItemInput,
} from '@/data/repositories/orderRepository';
import {
  getById as getMaterialById,
  resolveAssetUrl,
} from '@/data/repositories/materialRepository';
import { approveLatestRevision } from '@/data/repositories/revisionRepository';
import { useCanvasStore } from '@/stores/canvas-store';
import { getProductById } from '@/data/repositories/productRepository';
import { computeChapas } from '@/hooks/useBoardEngine';
import { buildChapaExportInfos } from '@/core/export/chapa-export-info';
import { useOrderShortcuts } from '@/hooks/useOrderShortcuts';
import { useCanvasShortcuts } from '@/hooks/useCanvasShortcuts';
import AppLayout from '@/ui/layout/AppLayout';

import { ExportPngDialog } from '@/ui/canvas/ExportPngDialog';
import { ExportSvgDialog } from '@/ui/canvas/ExportSvgDialog';
import type { LayerPanelHandle } from '@/ui/canvas/LayerPanel';

import { NovoPedidoCanvasArea } from './novo-pedido/NovoPedidoCanvasArea';
import { NovoPedidoLayerSidebar } from './novo-pedido/NovoPedidoLayerSidebar';
import { NovoPedidoSidebar, type ProductSelection } from './novo-pedido/NovoPedidoSidebar';
import { NovoPedidoTopbar } from './novo-pedido/NovoPedidoTopbar';
import { BancoDrawer } from './novo-pedido/BancoDrawer';
import { RevisionsDialog } from './novo-pedido/RevisionsDialog';
import type { TextoItemData } from './novo-pedido/TextoItem';

export default function NovoPedidoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderIdFromUrl = searchParams.get('id');

  const [pedidoLabel, setPedidoLabel] = useState('');
  // Onda 15 — sinal de prontidão do engine. Vira true depois que o
  // useBoardEngine montou o engine real. LayerSidebar usa pra re-anexar
  // listeners depois do mount (LayerPanel monta antes do engine existir).
  const [engineReady, setEngineReady] = useState(false);
  // Onda 15.fix — versão do engine. Incrementa a cada novo engine
  // instanciado (boardKey mudou). LayerPanel re-anexa listeners.
  const [engineVersion, setEngineVersion] = useState(0);
  // Onda 14b-schema — snapshot do canvas da prancha pra reabertura.
  // Hidratado do `orders.boardCanvasJson` ao boot e usado pelo
  // NovoPedidoCanvasArea pra restaurar o estado visual.
  const [boardCanvasSnapshot, setBoardCanvasSnapshot] = useState<string | undefined>(undefined);
  const [textosByItem, setTextosByItem] = useState<Record<string, TextoItemData[]>>({});
  const [bancoOpen, setBancoOpen] = useState(false);
  const [svgDialogOpen, setSvgDialogOpen] = useState(false);
  const [pngDialogOpen, setPngDialogOpen] = useState(false);
  const [revisionsDialogOpen, setRevisionsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boardDims, setBoardDims] = useState<{ widthMm: number; heightMm: number } | null>(null);
  // Onda 14 — tick incrementado a cada pattern aplicado. TextoItem usa pra
  // re-preencher slots novos (preserva o texto quando troca de padrão).
  const [slotVersion, setSlotVersion] = useState(0);
  const engineRef = useRef<CanvasEngine | null>(null);
  const svgInputRef = useRef<HTMLInputElement | null>(null);
  // Onda 20.C — ref pro LayerPanel pra atalho Delete reusar o dialog (cascade).
  const layerPanelRef = useRef<LayerPanelHandle | null>(null);

  const boardItems = useCanvasStore((s) => s.boardItems);
  const selectedIndex = useCanvasStore((s) => s.selectedOrderItemIndex);
  const addBoardItem = useCanvasStore((s) => s.addBoardItem);
  const removeBoardItem = useCanvasStore((s) => s.removeBoardItem);
  const setSelectedIndex = useCanvasStore((s) => s.setSelectedOrderItemIndex);
  const updateBoardItem = useCanvasStore((s) => s.updateBoardItem);
  const duplicateBoardItem = useCanvasStore((s) => s.duplicateBoardItem);
  const addBoardItemsBulk = useCanvasStore((s) => s.addBoardItemsBulk);
  const resetBoard = useCanvasStore((s) => s.resetBoard);

  const activeItem = selectedIndex >= 0 ? (boardItems[selectedIndex] ?? null) : null;
  const textosForActive = useMemo(
    () => (activeItem ? (textosByItem[activeItem.id] ?? []) : []),
    [activeItem, textosByItem]
  );

  // Onda 14 — cache de dims dos produtos pra calcular offset do broche ativo.
  const [productDims, setProductDims] = useState<
    Record<string, { widthMm: number; heightMm: number; label: string }>
  >({});
  useEffect(() => {
    let cancelled = false;
    async function loadDims() {
      const missing = boardItems.filter((it) => it.productId && !productDims[it.productId]);
      if (missing.length === 0) return;
      const fresh: Record<string, { widthMm: number; heightMm: number; label: string }> = {};
      for (const it of missing) {
        try {
          const p = await getProductById(it.productId);
          if (cancelled) return;
          if (p) {
            fresh[it.productId] = {
              widthMm: p.canvasMm.width,
              heightMm: p.canvasMm.height,
              label: p.label || p.id,
            };
          }
        } catch {
          /* ignora — offset cai pra (0,0) */
        }
      }
      if (!cancelled && Object.keys(fresh).length > 0) {
        setProductDims((prev) => ({ ...prev, ...fresh }));
      }
    }
    void loadDims();
    return () => {
      cancelled = true;
    };
  }, [boardItems, productDims]);

  const activeOffsetMm = useMemo(() => {
    if (!activeItem) return { leftMm: 0, topMm: 0 };
    // Onda 26e — usa computeChapas: respeita offset de chapa pra produtos
    // mistos (broche + placa). Pra prancha single-product retorna o mesmo
    // que computeItemPositions retornava antes.
    const itemsForChapas = boardItems.map((it) => {
      const d = productDims[it.productId];
      return {
        productId: it.productId,
        widthMm: d?.widthMm ?? 60,
        heightMm: d?.heightMm ?? 25,
      };
    });
    const layout = computeChapas(itemsForChapas);
    const pos = layout.positions[selectedIndex];
    return pos ?? { leftMm: 0, topMm: 0 };
  }, [activeItem, boardItems, productDims, selectedIndex]);

  // Onda 17 — bbox dos broches em px do canvas pra recortar mockup PNG.
  // Onda 26e — usa computeChapas pra cobrir chapas separadas (produto misto):
  // o bbox vira a união das chapas, com gaps entre.
  const boardBoundsPx = useMemo(() => {
    if (boardItems.length === 0) return null;
    // Aguarda dims reais — sem isso, prancha de produtos não-60×25 fica errada.
    const allDimsReady = boardItems.every((it) => productDims[it.productId]);
    if (!allDimsReady) return null;
    const itemsForChapas = boardItems.map((it) => {
      const d = productDims[it.productId]!;
      return { productId: it.productId, widthMm: d.widthMm, heightMm: d.heightMm };
    });
    const layout = computeChapas(itemsForChapas);
    let minLeftMm = Infinity;
    let minTopMm = Infinity;
    let maxRightMm = -Infinity;
    let maxBottomMm = -Infinity;
    for (let i = 0; i < boardItems.length; i++) {
      const pos = layout.positions[i];
      const w = itemsForChapas[i].widthMm;
      const h = itemsForChapas[i].heightMm;
      minLeftMm = Math.min(minLeftMm, pos.leftMm);
      minTopMm = Math.min(minTopMm, pos.topMm);
      maxRightMm = Math.max(maxRightMm, pos.leftMm + w);
      maxBottomMm = Math.max(maxBottomMm, pos.topMm + h);
    }
    const MM_TO_PX = 4;
    return {
      leftPx: minLeftMm * MM_TO_PX,
      topPx: minTopMm * MM_TO_PX,
      rightPx: maxRightMm * MM_TO_PX,
      bottomPx: maxBottomMm * MM_TO_PX,
    };
  }, [boardItems, productDims]);

  // Onda 27 (Fase C) — descritores de export por chapa. Quando 2+ chapas,
  // os dialogs de export iteram e geram 1 arquivo por chapa.
  // Quando 1 chapa, infos.length === 1 — dialog detecta como single-chapa e
  // mantém comportamento legado (1 arquivo, sem token de chapa no filename).
  const chapaInfos = useMemo(() => {
    if (boardItems.length === 0) return [];
    const allDimsReady = boardItems.every((it) => productDims[it.productId]);
    if (!allDimsReady) return [];
    const itemsForChapas = boardItems.map((it) => {
      const d = productDims[it.productId]!;
      return { productId: it.productId, widthMm: d.widthMm, heightMm: d.heightMm };
    });
    const layout = computeChapas(itemsForChapas);
    const labelMap = new Map<string, string>();
    for (const [pid, d] of Object.entries(productDims)) {
      labelMap.set(pid, d.label);
    }
    return buildChapaExportInfos(layout, labelMap);
  }, [boardItems, productDims]);

  // Sidebar esquerda → broche ativo. Onda 26c: o aplique-base do broche é
  // travado (selectable: false), então não selecionamos nada no canvas
  // ao trocar de broche ativo — só limpamos seleção residual de qualquer
  // filho que estivesse selecionado no broche anterior. O destaque visual
  // do broche ativo fica na sidebar + painel de camadas.
  //
  // Onda 27 (abas por chapa) — quando há 2+ chapas, ao trocar de broche
  // ativo enquadramos a chapa correspondente no viewport. Tipo "abas do
  // Chrome": o canvas continua único com todo o conteúdo, só muda o
  // recorte visual. Single-chapa mantém fit da prancha inteira.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engineReady) return;
    // Limpa overlay azul antigo (Onda 16) e qualquer seleção residual.
    engine.setActiveBoardHighlight(null);
    engine.clearSelection();

    if (chapaInfos.length >= 2 && activeItem) {
      const chapa = chapaInfos.find((c) => c.productId === activeItem.productId);
      if (chapa) engine.fitRegionToViewport(chapa.bboxMm);
    } else {
      engine.fitBoardToViewport();
    }
  }, [activeItem, engineReady, engineVersion, chapaInfos]);

  // ── Boot: pedido novo ou reabertura ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        if (orderIdFromUrl) {
          const order = await getOrderById(orderIdFromUrl);
          if (cancelled) return;
          if (!order) {
            toast.error('Pedido não encontrado.');
            return;
          }
          setPedidoLabel(order.label);
          // Hidrata snapshot da prancha pro NovoPedidoCanvasArea/useBoardEngine.
          // Onda 14b-schema (v12) — fonte de verdade migrada de items[0].canvasJson
          // pra orders.boardCanvasJson. '{}' = sem snapshot (pedido criado pelo
          // Kanban e nunca aberto pra salvar).
          setBoardCanvasSnapshot(
            order.boardCanvasJson && order.boardCanvasJson !== '{}'
              ? order.boardCanvasJson
              : undefined
          );
          resetBoard();
          for (const item of order.items) {
            let familyId = '';
            if (item.materialId) {
              const mat = await getMaterialById(item.materialId);
              if (cancelled) return;
              familyId = mat?.familyId ?? '';
            }
            addBoardItem({
              productId: item.productId ?? '',
              familyId,
              materialId: item.materialId ?? '',
              patternId: item.patternId,
              fields: item.fields,
              canvasJson: item.canvasJson,
            });
          }
        } else {
          const n = await countAll();
          if (cancelled) return;
          const next = n + 1;
          const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
          setPedidoLabel(`Novo Pedido ${padded}`);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[NovoPedidoPage] boot failed:', err);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [orderIdFromUrl, addBoardItem, resetBoard]);

  // Reset board on unmount — evita resíduo entre pedidos no store global.
  useEffect(() => {
    return () => {
      resetBoard();
    };
  }, [resetBoard]);

  // Onda 13.7 — reconstrói textosByItem UMA VEZ ao reabrir pedido.
  // Os slots do tipo 'nome'/'profissao'/'custom' já foram restaurados no
  // canvas via snapshot deserialize. A sidebar precisa de uma TextoItemData
  // por slot pra mostrar a lista visual.
  //
  // CRÍTICO: depende só de `orderIdFromUrl` — NÃO `boardItems`. Adicionar
  // `boardItems` aqui dispara o effect a cada updateBoardItem(patternId),
  // re-cria TextoItemData com uuid novos e remontaria os <TextoItem> via
  // key={t.id}, perdendo o state local (texto digitado).
  //
  // Hidratação é "best effort": espera engine ficar pronto via rAF e o
  // primeiro item existir. Se em algum momento boardItems[0] não está
  // disponível (race rápido), o tick re-agenda.
  useEffect(() => {
    if (!orderIdFromUrl) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 120; // ~2 segundos a 60fps — desiste se snapshot não veio

    const tick = () => {
      if (cancelled) return;
      const engine = engineRef.current;
      const currentBoardItems = useCanvasStore.getState().boardItems;
      attempts++;

      // Engine ou items não prontos — tenta de novo.
      if (!engine || currentBoardItems.length === 0) {
        if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
        return;
      }

      const slots = [
        ...engine.getSlotsByType('nome'),
        ...engine.getSlotsByType('profissao'),
        ...engine.getSlotsByType('custom'),
      ];

      // Snapshot deserialize pode ainda não ter finalizado — slots aparecem
      // assíncronos. Continua tentando até achar ou estourar limite.
      if (slots.length === 0) {
        if (attempts < MAX_ATTEMPTS) requestAnimationFrame(tick);
        return;
      }

      const firstItemId = currentBoardItems[0].id;
      const restored: TextoItemData[] = slots.map((slot, i) => ({
        id: crypto.randomUUID(),
        slotId: slot.id,
        label: i === 0 ? 'Texto' : `Texto ${i + 1}`,
      }));
      setTextosByItem({ [firstItemId]: restored });
    };
    requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  }, [orderIdFromUrl]);

  function handleAddBoardItem(data: ProductSelection) {
    addBoardItem({
      productId: data.productId,
      familyId: data.familyId,
      materialId: data.materialId,
      patternId: null,
      fields: {},
      canvasJson: '{}',
    });
    setBancoOpen(false);
  }

  // Onda 14b — troca material do broche ativo sem refazer o engine.
  // Localiza o aplique base do broche pelo appliqueId = `board-item:<id>`
  // e chama applyMaterialToLayer. Persiste familyId + materialId no store.
  async function handleChangeMaterial(familyId: string, materialId: string) {
    if (!activeItem) return;
    const engine = engineRef.current;
    if (!engine) {
      toast.error('Canvas não está pronto.');
      return;
    }
    try {
      const mat = await getMaterialById(materialId);
      if (!mat) {
        toast.error('Material não encontrado.');
        return;
      }
      const url = await resolveAssetUrl(mat);
      // Encontra layerId do aplique base do broche ativo.
      const layers = engine.getAllLayerMetas();
      const targetEntry = Array.from(layers.entries()).find(
        ([, meta]) => meta.kind === 'principal' && meta.appliqueId === `board-item:${activeItem.id}`
      );
      if (!targetEntry) {
        toast.error('Camada base do broche não encontrada.');
        return;
      }
      const [layerId] = targetEntry;
      await engine.applyMaterialToLayer(layerId, materialId, url);
      // Persiste no store.
      updateBoardItem(selectedIndex, { familyId, materialId });
    } catch (err) {
      console.error('[NovoPedidoPage] failed to change material:', err);
      toast.error(`Erro ao trocar material: ${String(err)}`);
    }
  }

  function handleRemoveBoardItem(index: number) {
    const removed = boardItems[index];
    if (removed) {
      setTextosByItem((prev) => {
        const { [removed.id]: _drop, ...rest } = prev;
        void _drop;
        return rest;
      });
    }
    removeBoardItem(index);
  }

  // Onda 16 — duplicar e bulk.
  function handleDuplicateBoardItem(index: number) {
    const newIndex = duplicateBoardItem(index);
    if (newIndex >= 0) {
      const src = boardItems[index];
      toast.success(`Broche ${index + 1} duplicado`, {
        description: src?.materialId ? `Broche ${newIndex + 1} criado` : undefined,
      });
    }
  }

  function handleBulkFromActive(count: number) {
    if (!activeItem) {
      toast.error('Selecione um broche pra usar como modelo.');
      return;
    }
    if (count <= 0) return;
    addBoardItemsBulk(
      {
        productId: activeItem.productId,
        familyId: activeItem.familyId,
        materialId: activeItem.materialId,
        patternId: activeItem.patternId,
        fields: { ...activeItem.fields },
      },
      count
    );
    toast.success(`${count} broches adicionados ao lote`);
  }

  function handleAddItem(type: 'svg' | 'texto' | 'banco') {
    if (!activeItem) return;
    if (type === 'texto') {
      const current = textosByItem[activeItem.id] ?? [];
      const count = current.length + 1;
      const label = count === 1 ? 'Texto' : `Texto ${count}`;
      const newItem: TextoItemData = {
        id: crypto.randomUUID(),
        slotId: crypto.randomUUID(),
        label,
      };
      engineRef.current?.createSlot('nome');
      setTextosByItem((prev) => ({
        ...prev,
        [activeItem.id]: [...current, newItem],
      }));
      return;
    }
    if (type === 'banco') {
      setBancoOpen(true);
      return;
    }
    if (type === 'svg') {
      svgInputRef.current?.click();
      return;
    }
  }

  function handleRemoveTexto(textoId: string) {
    if (!activeItem) return;
    setTextosByItem((prev) => {
      const current = prev[activeItem.id] ?? [];
      return {
        ...prev,
        [activeItem.id]: current.filter((t) => t.id !== textoId),
      };
    });
  }

  async function handleSvgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.svg')) {
      toast.error('Apenas arquivos SVG são aceitos.');
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const meta = parseCorelSvg(text);
      await engineRef.current?.addAppliqueSvg(
        meta,
        file.name.replace('.svg', ''),
        crypto.randomUUID()
      );
      toast.success(`${file.name} adicionado`);
    } catch (err) {
      const { title, options } = svgErrorToToastArgs(err);
      toast.error(title, options);
    } finally {
      e.target.value = '';
    }
  }

  // ── Aprovar — marca última revisão como aprovada ─────────────────────────
  // Salvar+aprovar é atômico do ponto de vista do operador: 1 clique faz as
  // 2 ações. Se o pedido nunca foi salvo, salva primeiro (createWithItems)
  // e usa o id recém-criado. Se salvar falhar, não aprova.
  async function handleApprove() {
    if (boardItems.length === 0) {
      toast.error('Adicione pelo menos um broche antes de aprovar.');
      return;
    }
    let orderId = orderIdFromUrl;
    if (!orderId) {
      await handleSave();
      // handleSave navega pra ?id= no sucesso. Releitura via URL.
      orderId = new URLSearchParams(window.location.search).get('id');
      if (!orderId) return; // save falhou — toast já foi mostrado
    }
    try {
      await approveLatestRevision(orderId);
      toast.success('Revisão aprovada', { description: pedidoLabel || 'Sem nome' });
    } catch (err) {
      toast.error('Falha ao aprovar', { description: String(err) });
    }
  }

  // ── Salvar — createWithItems (novo) ou saveRevision (existente) ──────────
  async function handleSave() {
    if (saving) return;
    if (boardItems.length === 0) {
      toast.error('Adicione pelo menos um broche antes de salvar.');
      return;
    }

    // Onda 14b-schema (v12) — serializa canvas único e grava em
    // orders.boardCanvasJson. items[i].canvasJson fica '{}' pra todos
    // (refator de salvar canvas por item fica pra futuro).
    let boardSnapshotJson = '{}';
    if (engineRef.current) {
      try {
        const items = boardItems.map((it) => ({
          productId: it.productId,
          offsetX: 0,
          offsetY: 0,
        }));
        const json = engineRef.current.serialize(items);
        boardSnapshotJson = JSON.stringify(json);
      } catch (e) {
        console.warn('[NovoPedidoPage] failed to serialize board canvas on save:', e);
      }
    }

    const itemsPayload: OrderItemInput[] = boardItems.map((it) => ({
      position: it.position,
      productId: it.productId || null,
      patternId: it.patternId,
      materialId: it.materialId || null,
      fields: it.fields,
      canvasJson: '{}',
    }));

    setSaving(true);
    try {
      if (orderIdFromUrl) {
        await saveRevision({
          orderId: orderIdFromUrl,
          items: itemsPayload,
          boardCanvasJson: boardSnapshotJson,
        });
        toast.success('Pedido salvo', { description: pedidoLabel || 'Sem nome' });
      } else {
        const newId = crypto.randomUUID();
        await createWithItems({
          id: newId,
          label: pedidoLabel || 'Sem nome',
          customerName: pedidoLabel || null,
          items: itemsPayload,
          boardCanvasJson: boardSnapshotJson,
        });
        toast.success('Pedido criado', { description: pedidoLabel || 'Sem nome' });
        navigate(`/arte/novo?id=${newId}`, { replace: true });
      }
    } catch (err) {
      toast.error('Falha ao salvar pedido', { description: String(err) });
    } finally {
      setSaving(false);
    }
  }

  // Onda 20.B — atalhos globais do editor.
  useOrderShortcuts({
    onSave: () => void handleSave(),
    onExportSvg: () => setSvgDialogOpen(true),
    onExportPng: () => setPngDialogOpen(true),
    onDuplicateActive: () => {
      if (selectedIndex >= 0) handleDuplicateBoardItem(selectedIndex);
      else toast.info('Selecione um broche pra duplicar.');
    },
    onToggleBanco: () => {
      if (!activeItem) {
        toast.info('Selecione um broche antes de abrir o Banco.');
        return;
      }
      setBancoOpen((v) => !v);
    },
    enabled: !saving,
  });

  // Onda 20.C — atalhos de canvas (Delete/Esc/Tab/Setas).
  useCanvasShortcuts({
    engineRef,
    layerPanelRef,
    activeBoardItemId: activeItem ? `board-item:${activeItem.id}` : null,
    enabled: !saving,
  });

  return (
    <AppLayout breadcrumb={[{ label: 'Arte', href: '/arte' }, { label: 'Novo Pedido' }]}>
      <div className="flex h-full flex-col">
        <NovoPedidoTopbar
          pedidoLabel={pedidoLabel}
          onLabelChange={setPedidoLabel}
          onSave={handleSave}
          saving={saving}
          onSvg={() => setSvgDialogOpen(true)}
          onPng={() => setPngDialogOpen(true)}
          onApprove={handleApprove}
          onRevisions={() => setRevisionsDialogOpen(true)}
        />
        <div className="relative flex flex-1 overflow-hidden">
          <NovoPedidoSidebar
            boardItems={boardItems}
            selectedIndex={selectedIndex}
            onAddBoardItem={handleAddBoardItem}
            onSelectIndex={setSelectedIndex}
            onRemoveBoardItem={handleRemoveBoardItem}
            onDuplicateBoardItem={handleDuplicateBoardItem}
            onBulkFromActive={handleBulkFromActive}
            onAddItem={handleAddItem}
            textos={textosForActive}
            engineRef={engineRef}
            onRemoveTexto={handleRemoveTexto}
            slotVersion={slotVersion}
            onChangeMaterial={(famId, matId) => void handleChangeMaterial(famId, matId)}
          />
          <NovoPedidoCanvasArea
            boardItems={boardItems}
            activeItem={activeItem}
            activeOffsetMm={activeOffsetMm}
            onPatternApplied={(patternId) => {
              if (selectedIndex >= 0) {
                updateBoardItem(selectedIndex, { patternId });
              }
              // Força TextoItem a re-preencher slots do novo padrão.
              setSlotVersion((v) => v + 1);

              // Onda 14 — popular sidebar com slots do pattern aplicado.
              // Preserva textos digitados que ainda batem com slots do tipo
              // do pattern novo (TextoItem usa state local, sobrevive se
              // key/id mantiver).
              const engine = engineRef.current;
              if (!engine || !activeItem) return;
              const nomeSlots = engine.getSlotsByType('nome');
              const profissaoSlots = engine.getSlotsByType('profissao');
              const logoSlots = engine.getSlotsByType('logo');
              const customSlots = engine.getSlotsByType('custom');

              const itemId = activeItem.id;
              setTextosByItem((prev) => {
                const previous = prev[itemId] ?? [];
                // Preserva entries existentes por slotType (na ordem) pra
                // manter key={t.id} estável e não re-mountar TextoItem.
                const byType: Record<string, TextoItemData[]> = {
                  nome: previous.filter((t) => t.slotType === 'nome'),
                  profissao: previous.filter((t) => t.slotType === 'profissao'),
                  custom: previous.filter((t) => t.slotType === 'custom'),
                  logo: previous.filter((t) => t.slotType === 'logo'),
                };

                function makeEntry(
                  slotType: TextoItemData['slotType'],
                  slotId: string,
                  index: number
                ): TextoItemData {
                  const pool = byType[slotType ?? 'nome'] ?? [];
                  const reused = pool[index];
                  if (reused) {
                    return { ...reused, slotId, slotType };
                  }
                  const label =
                    slotType === 'logo'
                      ? 'Logo'
                      : slotType === 'profissao'
                        ? 'Profissão'
                        : slotType === 'nome'
                          ? 'Nome'
                          : 'Texto';
                  return {
                    id: crypto.randomUUID(),
                    slotId,
                    slotType,
                    label,
                  };
                }

                const next: TextoItemData[] = [];
                logoSlots.forEach((s, i) => next.push(makeEntry('logo', s.id, i)));
                nomeSlots.forEach((s, i) => next.push(makeEntry('nome', s.id, i)));
                profissaoSlots.forEach((s, i) => next.push(makeEntry('profissao', s.id, i)));
                customSlots.forEach((s, i) => next.push(makeEntry('custom', s.id, i)));

                return { ...prev, [itemId]: next };
              });
            }}
            engineRef={engineRef}
            onBoardDimsChange={setBoardDims}
            onEngineReadyChange={setEngineReady}
            onEngineVersionChange={setEngineVersion}
            snapshotCanvasJson={boardCanvasSnapshot}
          />
          <NovoPedidoLayerSidebar
            engineRef={engineRef}
            engineReady={engineReady}
            engineVersion={engineVersion}
            panelRef={layerPanelRef}
          />

          {bancoOpen && <BancoDrawer engineRef={engineRef} onClose={() => setBancoOpen(false)} />}
        </div>
      </div>

      <ExportSvgDialog
        open={svgDialogOpen}
        getEngine={() => engineRef.current}
        boardDims={boardDims}
        defaultStem={pedidoLabel}
        chapaInfos={chapaInfos}
        onClose={() => setSvgDialogOpen(false)}
      />

      <ExportPngDialog
        open={pngDialogOpen}
        getEngine={() => engineRef.current}
        boardBounds={boardBoundsPx}
        boardItemCount={boardItems.length}
        chapaInfos={chapaInfos}
        onClose={() => setPngDialogOpen(false)}
      />

      <RevisionsDialog
        open={revisionsDialogOpen}
        orderId={orderIdFromUrl}
        onClose={() => setRevisionsDialogOpen(false)}
      />

      {/* Input oculto para upar SVG */}
      <input
        ref={svgInputRef}
        type="file"
        accept=".svg"
        className="hidden"
        onChange={handleSvgFile}
      />
    </AppLayout>
  );
}
