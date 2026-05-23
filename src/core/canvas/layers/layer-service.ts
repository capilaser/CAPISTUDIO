/**
 * LayerService — gerência pura (sem Fabric, sem DOM) da lista de camadas
 * de um projeto. Mantém ordem (zIndex), invariantes e dispara callbacks
 * quando algo muda.
 *
 * Os objetos do canvas referenciam camadas por `layerId`. Apagar uma camada
 * exige que o caller cuide dos objetos pertencentes a ela (não-cascade aqui
 * — é decisão do nível acima).
 */

import { newLayerId } from '@/core/canvas/capi-id';
import type { Layer, LayerColorLabel } from '@/core/project/project-file';
import type { MachineCode, ProcessType } from '@/data/schema';

export interface LayerServiceListener {
  (snapshot: Layer[]): void;
}

/**
 * Defaults aplicados ao criar uma camada. Operação null = ainda não
 * classificada; export para PNG ligado (mockup), SVG/DXF desligados até
 * o usuário classificar.
 */
export function defaultLayer(name: string, zIndex: number): Layer {
  return {
    id: newLayerId(),
    name,
    zIndex,
    visible: true,
    locked: false,
    operation: null,
    machines: [],
    exportTo: { png: true, svg: false, dxf: false },
    colorLabel: 'none',
  };
}

/**
 * Cria a camada inicial "Base" — travada, contém a geometria base do
 * produto (broche 60×25 etc.). Já vem classificada como corte/DL por
 * convenção do MVP (o usuário pode mudar).
 */
export function makeBaseLayer(): Layer {
  return {
    id: newLayerId(),
    name: 'Base',
    zIndex: 0,
    visible: true,
    locked: true,
    operation: 'corte',
    machines: ['M3'], // DL — laser de corte (P2 do PROJECT_VISION mapeia futuro)
    exportTo: { png: true, svg: true, dxf: true },
    colorLabel: 'gray',
  };
}

export class LayerService {
  private layers: Layer[] = [];
  private listeners = new Set<LayerServiceListener>();

  constructor(initial: Layer[] = []) {
    this.layers = sortByZ(initial);
  }

  // ── Leitura ────────────────────────────────────────────────────────────
  list(): Layer[] {
    return this.layers.slice();
  }

  get(id: string): Layer | null {
    return this.layers.find((l) => l.id === id) ?? null;
  }

  topVisibleEditable(): Layer | null {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (l.visible && !l.locked) return l;
    }
    return null;
  }

  // ── Mutação ────────────────────────────────────────────────────────────
  /** Cria uma camada nova no topo da lista. Retorna o ID criado. */
  create(name?: string): string {
    const next = defaultLayer(name ?? this.nextDefaultName(), this.nextZ());
    this.layers = sortByZ([...this.layers, next]);
    this.emit();
    return next.id;
  }

  /** Insere uma camada já construída (usado pra Base inicial). */
  insert(layer: Layer): void {
    this.layers = sortByZ([...this.layers, layer]);
    this.emit();
  }

  /** Atualiza campos arbitrários. Faz validação fraca via TypeScript. */
  update(id: string, patch: Partial<Omit<Layer, 'id'>>): void {
    let changed = false;
    this.layers = this.layers.map((l) => {
      if (l.id !== id) return l;
      changed = true;
      return { ...l, ...patch, id: l.id };
    });
    if (changed) {
      this.layers = sortByZ(this.layers);
      this.emit();
    }
  }

  /** Remove. O caller é responsável por mover/apagar objetos da camada. */
  remove(id: string): void {
    const before = this.layers.length;
    this.layers = this.layers.filter((l) => l.id !== id);
    if (this.layers.length !== before) this.emit();
  }

  /** Move uma camada para um zIndex específico, reordenando o resto. */
  moveTo(id: string, targetIndex: number): void {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const clamped = Math.max(0, Math.min(targetIndex, this.layers.length - 1));
    if (clamped === idx) return;
    const next = this.layers.slice();
    const [moved] = next.splice(idx, 1);
    next.splice(clamped, 0, moved);
    this.layers = next.map((l, i) => ({ ...l, zIndex: i }));
    this.emit();
  }

  setVisibility(id: string, visible: boolean): void {
    this.update(id, { visible });
  }

  setLocked(id: string, locked: boolean): void {
    this.update(id, { locked });
  }

  setOperation(id: string, operation: ProcessType | null): void {
    this.update(id, { operation });
  }

  setMachines(id: string, machines: MachineCode[]): void {
    // Garante 0..3 sem duplicatas (cardinalidade da spec).
    const dedup = Array.from(new Set(machines)).slice(0, 3) as MachineCode[];
    this.update(id, { machines: dedup });
  }

  setColorLabel(id: string, colorLabel: LayerColorLabel): void {
    this.update(id, { colorLabel });
  }

  setExportTo(id: string, exportTo: Partial<Layer['exportTo']>): void {
    const current = this.get(id);
    if (!current) return;
    this.update(id, { exportTo: { ...current.exportTo, ...exportTo } });
  }

  rename(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.update(id, { name: trimmed });
  }

  // ── Observabilidade ────────────────────────────────────────────────────
  subscribe(fn: LayerServiceListener): () => void {
    this.listeners.add(fn);
    fn(this.list());
    return () => {
      this.listeners.delete(fn);
    };
  }

  // ── Helpers privados ───────────────────────────────────────────────────
  private nextZ(): number {
    return this.layers.length;
  }

  private nextDefaultName(): string {
    const used = new Set(this.layers.map((l) => l.name));
    let n = this.layers.length + 1;
    while (used.has(`Camada ${n}`)) n++;
    return `Camada ${n}`;
  }

  private emit(): void {
    const snap = this.list();
    for (const l of this.listeners) l(snap);
  }
}

function sortByZ(list: Layer[]): Layer[] {
  return list
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((l, i) => (l.zIndex === i ? l : { ...l, zIndex: i }));
}
