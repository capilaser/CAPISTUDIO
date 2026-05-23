import { create } from 'zustand';

export type CanvasMode = 'designer' | 'operator';

interface CanvasStore {
  mode: CanvasMode;
  selectedLayerId: string | null;
  selectedFontFamily: string;
  measurementMode: boolean;
  gridVisible: boolean;
  liveMetricsEnabled: boolean;

  setMode: (mode: CanvasMode) => void;
  setSelectedLayerId: (id: string | null) => void;
  setSelectedFontFamily: (family: string) => void;
  toggleMeasurementMode: () => void;
  toggleGridVisible: () => void;
  toggleLiveMetrics: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  mode: 'designer',
  selectedLayerId: null,
  selectedFontFamily: 'Montserrat',
  measurementMode: false,
  gridVisible: false,
  liveMetricsEnabled: true,

  setMode: (mode) => set({ mode }),
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setSelectedFontFamily: (family) => set({ selectedFontFamily: family }),
  toggleMeasurementMode: () => set((s) => ({ measurementMode: !s.measurementMode })),
  toggleGridVisible: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleLiveMetrics: () => set((s) => ({ liveMetricsEnabled: !s.liveMetricsEnabled })),
}));
