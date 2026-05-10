import { create } from 'zustand';

export type CanvasMode = 'designer' | 'operator';

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
  setMode: (mode: CanvasMode) => void;
  setSelectedSlotId: (id: string | null) => void;
  setSelectedFontFamily: (family: string) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedLayerKind: (kind: 'principal' | 'operation' | 'visual' | null) => void;
  toggleMeasurementMode: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  mode: 'designer',
  selectedSlotId: null,
  selectedFontFamily: 'Montserrat',
  selectedLayerId: null,
  selectedLayerKind: null,
  measurementMode: false,
  setMode: (mode) => set({ mode }),
  setSelectedSlotId: (id) => set({ selectedSlotId: id }),
  setSelectedFontFamily: (family) => set({ selectedFontFamily: family }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setSelectedLayerKind: (kind) => set({ selectedLayerKind: kind }),
  toggleMeasurementMode: () => set((s) => ({ measurementMode: !s.measurementMode })),
}));
