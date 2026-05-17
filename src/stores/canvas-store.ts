import { create } from 'zustand';

import type { OrderFields } from '@/data/schema';

export type CanvasMode = 'designer' | 'operator';

/**
 * Onda 13 — item da prancha em memória (ainda não persistido).
 *
 * - `id` local da sessão (uuid v4) — não é o `OrderItem.id` do banco
 * - `position` é o índice na prancha (0-based, 0..4 = coluna 1, 5..9 = coluna 2)
 * - `familyId` é só pra UI (família de material escolhida no cascata) — não vai pro banco
 * - `canvasJson` é cache do canvas serializado do item. Atualizado quando o
 *   operador troca de item ativo (NovoPedidoPage serializa o engine antes de
 *   trocar). Default '{}' = canvas ainda nunca foi montado pra esse item.
 *
 * Quando o pedido for salvo, cada BoardItemDraft vira um OrderItem em
 * `order_items` via `orderRepository.saveRevision({ items })`.
 */
export interface BoardItemDraft {
  id: string;
  position: number;
  productId: string;
  familyId: string;
  materialId: string;
  patternId: string | null;
  fields: OrderFields;
  /** JSON serializado de FabricCanvasJson do broche. '{}' = ainda não montado. */
  canvasJson: string;
}

interface CanvasStore {
  mode: CanvasMode;
  selectedSlotId: string | null;
  selectedFontFamily: string;
  /** capi id of the currently selected canvas object (null = nothing selected). */
  selectedLayerId: string | null;
  /** kind of the selected layer — drives RightPanel visibility (ADR 010 §1, Fase C). */
  selectedLayerKind: 'principal' | 'operation' | 'visual' | null;
  /**
   * Onda 7b Fase E — modo medição. Quando true e exatamente 2 objetos estão
   * selecionados, o MeasurementOverlay mostra distâncias V/H entre os centros.
   * Estado de UI puro, NÃO persiste em canvasJson.
   */
  measurementMode: boolean;
  /**
   * Onda 7b Fase F — visibilidade dos pontinhos da grade de 1mm. Snap em
   * grade continua sempre ativo (invariante do sistema, ADR 014). Default
   * false ao abrir o app. Estado de UI puro, NÃO persiste em canvasJson.
   */
  gridVisible: boolean;
  /**
   * Onda 26 — HUD numérico flutuante durante drag/resize. Mostra x/y/Δx/Δy
   * em mm enquanto o operador move um objeto, e w/h enquanto redimensiona.
   * Default true (ligado por padrão — ferramenta de produção). Estado de UI
   * puro, NÃO persiste em canvasJson. Operador pode desligar se incomodar.
   */
  liveMetricsEnabled: boolean;

  // ── Onda 13 — multi-broche ──────────────────────────────────────────────
  /** Items da prancha (broches) em memória. Vazio = nenhum broche ainda. */
  boardItems: BoardItemDraft[];
  /** Índice do item ativo. -1 quando boardItems está vazio. */
  selectedOrderItemIndex: number;

  setMode: (mode: CanvasMode) => void;
  setSelectedSlotId: (id: string | null) => void;
  setSelectedFontFamily: (family: string) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerKind: (kind: 'principal' | 'operation' | 'visual' | null) => void;
  toggleMeasurementMode: () => void;
  toggleGridVisible: () => void;
  toggleLiveMetrics: () => void;

  /**
   * Adiciona um broche novo no fim da prancha. Retorna o índice do item criado.
   * `canvasJson` é opcional — default '{}' quando o item nasce sem conteúdo.
   */
  addBoardItem: (
    item: Omit<BoardItemDraft, 'id' | 'position' | 'canvasJson'> & { canvasJson?: string }
  ) => number;
  /** Remove o item do índice e re-numera positions. Se removeu o ativo, ativa o anterior. */
  removeBoardItem: (index: number) => void;
  /** Troca o item ativo. -1 = nenhum. */
  setSelectedOrderItemIndex: (index: number) => void;
  /** Atualiza campos parciais de um item (productId, material, patternId, fields). */
  updateBoardItem: (index: number, patch: Partial<Omit<BoardItemDraft, 'id' | 'position'>>) => void;
  /**
   * Onda 16 — duplica o item do índice (mantém produto/material/pattern/fields,
   * gera id novo, append no fim, vira o ativo). Retorna o índice criado.
   */
  duplicateBoardItem: (index: number) => number;
  /**
   * Onda 16 — adiciona N broches iguais ao template (modo lote).
   * Gera N ids novos com mesmo produto/material/pattern/fields.
   * Retorna o índice do primeiro item criado (último vira o ativo).
   */
  addBoardItemsBulk: (
    template: Omit<BoardItemDraft, 'id' | 'position' | 'canvasJson'> & { canvasJson?: string },
    count: number
  ) => number;
  /** Limpa a prancha. Usar ao trocar de pedido ou cancelar. */
  resetBoard: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  mode: 'designer',
  selectedSlotId: null,
  selectedFontFamily: 'Montserrat',
  selectedLayerId: null,
  selectedLayerKind: null,
  measurementMode: false,
  gridVisible: false,
  liveMetricsEnabled: true,
  boardItems: [],
  selectedOrderItemIndex: -1,

  setMode: (mode) => set({ mode }),
  setSelectedSlotId: (id) => set({ selectedSlotId: id }),
  setSelectedFontFamily: (family) => set({ selectedFontFamily: family }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setSelectedLayerKind: (kind) => set({ selectedLayerKind: kind }),
  toggleMeasurementMode: () => set((s) => ({ measurementMode: !s.measurementMode })),
  toggleGridVisible: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleLiveMetrics: () => set((s) => ({ liveMetricsEnabled: !s.liveMetricsEnabled })),

  addBoardItem: (item) => {
    let newIndex = -1;
    set((s) => {
      const position = s.boardItems.length;
      newIndex = position;
      const newItem: BoardItemDraft = {
        ...item,
        canvasJson: item.canvasJson ?? '{}',
        id: crypto.randomUUID(),
        position,
      };
      return {
        boardItems: [...s.boardItems, newItem],
        selectedOrderItemIndex: position,
      };
    });
    return newIndex;
  },

  removeBoardItem: (index) =>
    set((s) => {
      if (index < 0 || index >= s.boardItems.length) return s;
      const next = s.boardItems
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, position: i }));
      // Se removeu o ativo, ativa o anterior (ou -1 se prancha ficou vazia).
      let nextSelected = s.selectedOrderItemIndex;
      if (next.length === 0) {
        nextSelected = -1;
      } else if (index === s.selectedOrderItemIndex) {
        nextSelected = Math.max(0, index - 1);
      } else if (index < s.selectedOrderItemIndex) {
        nextSelected = s.selectedOrderItemIndex - 1;
      }
      return { boardItems: next, selectedOrderItemIndex: nextSelected };
    }),

  setSelectedOrderItemIndex: (index) => set({ selectedOrderItemIndex: index }),

  updateBoardItem: (index, patch) =>
    set((s) => {
      if (index < 0 || index >= s.boardItems.length) return s;
      const next = s.boardItems.map((item, i) => (i === index ? { ...item, ...patch } : item));
      return { boardItems: next };
    }),

  // Onda 16 — duplica mantendo produto/material/pattern/fields, novo id.
  // canvasJson volta pra '{}' (canvas do broche novo é remontado limpo).
  duplicateBoardItem: (index) => {
    let newIndex = -1;
    set((s) => {
      if (index < 0 || index >= s.boardItems.length) return s;
      const source = s.boardItems[index];
      const position = s.boardItems.length;
      newIndex = position;
      const copy: BoardItemDraft = {
        id: crypto.randomUUID(),
        position,
        productId: source.productId,
        familyId: source.familyId,
        materialId: source.materialId,
        patternId: source.patternId,
        // fields: shallow copy — operador edita textos depois, não compartilha referência.
        fields: { ...source.fields },
        canvasJson: '{}',
      };
      return {
        boardItems: [...s.boardItems, copy],
        selectedOrderItemIndex: position,
      };
    });
    return newIndex;
  },

  // Onda 16 — bulk add. Cria N items iguais ao template.
  // Útil pra lote (escola: 30 broches mesma cor/pattern, nomes diferentes).
  addBoardItemsBulk: (template, count) => {
    let firstIndex = -1;
    if (count <= 0) return firstIndex;
    set((s) => {
      const start = s.boardItems.length;
      firstIndex = start;
      const newItems: BoardItemDraft[] = [];
      for (let i = 0; i < count; i++) {
        newItems.push({
          ...template,
          canvasJson: template.canvasJson ?? '{}',
          id: crypto.randomUUID(),
          position: start + i,
          // fields novo objeto pra cada item (evita aliasing de referência).
          fields: { ...(template.fields ?? {}) },
        });
      }
      return {
        boardItems: [...s.boardItems, ...newItems],
        // Ativa o último adicionado.
        selectedOrderItemIndex: start + count - 1,
      };
    });
    return firstIndex;
  },

  resetBoard: () => set({ boardItems: [], selectedOrderItemIndex: -1 }),
}));
