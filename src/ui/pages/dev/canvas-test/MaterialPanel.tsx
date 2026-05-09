/**
 * MaterialPanel.tsx — Onda 6.5 Fase B
 *
 * Material picker for the active canvas layer.
 * Rendered inside UnifiedRightPanel (aba Materiais).
 *
 * Active when selectedLayerKind === 'visual' OR 'principal'.
 * Shows empty state (Lucide icon) when nothing is selected or
 * when an operation layer is active.
 */
import { type ChangeEvent, type RefObject, useEffect, useState } from 'react';
import { Layers } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { listFamilies } from '@/data/repositories/materialFamilyRepository';
import type { Material } from '@/data/repositories/materialRepository';
import { listByFamily, resolveAssetUrl } from '@/data/repositories/materialRepository';
import { isOperationLayer } from '@/core/canvas/layer-meta';
import { useCanvasStore } from '@/stores/canvas-store';

interface MaterialPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function MaterialPanel({ engineRef }: MaterialPanelProps) {
  const selectedLayerId = useCanvasStore((s) => s.selectedLayerId);
  const selectedLayerKind = useCanvasStore((s) => s.selectedLayerKind);

  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [fetchedFamilyId, setFetchedFamilyId] = useState<string>('');
  const loadingMaterials = !!selectedFamilyId && fetchedFamilyId !== selectedFamilyId;

  useEffect(() => {
    let cancelled = false;
    listFamilies()
      .then((fams) => {
        if (cancelled) return;
        setFamilies(fams);
        if (fams.length > 0) setSelectedFamilyId(fams[0].id);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[MaterialPanel] listFamilies error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingFamilies(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedFamilyId || selectedFamilyId === fetchedFamilyId) return;
    let cancelled = false;
    listByFamily(selectedFamilyId)
      .then((mats) => {
        if (cancelled) return;
        setMaterials(mats);
        setFetchedFamilyId(selectedFamilyId);
      })
      .catch((err) => {
        if (!cancelled) {
          if (import.meta.env.DEV) console.error('[MaterialPanel] listByFamily error:', err);
          setFetchedFamilyId(selectedFamilyId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFamilyId, fetchedFamilyId]);

  useEffect(() => {
    if (!selectedLayerId || !engineRef.current) {
      setSelectedMaterialId('');
      return;
    }
    const meta = engineRef.current.getLayerMeta(selectedLayerId);
    setSelectedMaterialId(meta && !isOperationLayer(meta) ? (meta.materialId ?? '') : '');
  }, [selectedLayerId, engineRef]);

  // Empty state: nothing selected, or operation layer active.
  if (selectedLayerKind !== 'visual' && selectedLayerKind !== 'principal') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-ink-400 text-sm">
        <Layers className="h-8 w-8 opacity-50" />
        <p>Selecione uma camada</p>
        <p className="text-xs">para editar material</p>
      </div>
    );
  }

  async function handleApply(materialId: string) {
    const engine = engineRef.current;
    if (!engine || !selectedLayerId || applying) return;

    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;

    setApplying(true);
    try {
      const url = await resolveAssetUrl(mat);
      await engine.applyMaterialToLayer(selectedLayerId, mat.id, url);
      setSelectedMaterialId(mat.id);
    } catch (err) {
      if (import.meta.env.DEV) console.error('[MaterialPanel] applyMaterialToLayer error:', err);
    } finally {
      setApplying(false);
    }
  }

  function handleRemove() {
    const engine = engineRef.current;
    if (!engine || !selectedLayerId) return;
    engine.removeMaterialFromLayer(selectedLayerId);
    setSelectedMaterialId('');
  }

  function handleFamilyChange(e: ChangeEvent<HTMLSelectElement>) {
    setSelectedFamilyId(e.target.value);
    setSelectedMaterialId('');
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-400">
        Material da Camada
      </p>

      {/* Current material badge */}
      {selectedMaterialId ? (
        <div className="flex items-center justify-between rounded border border-ink-700 bg-ink-950 px-2 py-1.5">
          <div className="flex items-center gap-2">
            {materials.find((m) => m.id === selectedMaterialId) && (
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-ink-600"
                style={{
                  backgroundColor:
                    materials.find((m) => m.id === selectedMaterialId)?.swatch ?? '#8a8e92',
                }}
              />
            )}
            <span className="font-mono text-[11px] text-ink-200">
              {materials.find((m) => m.id === selectedMaterialId)?.label ?? selectedMaterialId}
            </span>
          </div>
          <button
            onClick={handleRemove}
            className="font-mono text-[10px] text-ink-500 transition-colors hover:text-danger"
            title="Remover material"
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-ink-600">Sem material aplicado</p>
      )}

      {/* Family dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[11px] font-medium text-ink-300">Família</label>
        {loadingFamilies ? (
          <p className="animate-pulse font-mono text-[10px] text-ink-600">Carregando…</p>
        ) : (
          <select
            value={selectedFamilyId}
            onChange={handleFamilyChange}
            className="w-full rounded border border-ink-600 bg-ink-950 px-2 py-1.5 font-mono text-[11px] text-ink-200 outline-none transition-colors focus:border-laser focus:ring-1 focus:ring-laser/30"
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Material list */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[11px] font-medium text-ink-300">
          Cor / Variante
          {loadingMaterials && <span className="ml-1 animate-pulse text-ink-600">…</span>}
        </label>

        {!loadingMaterials && materials.length === 0 && (
          <p className="font-mono text-[10px] text-ink-600">Nenhum material nesta família</p>
        )}

        <div className="flex flex-col gap-1">
          {materials.map((m) => {
            const isSelected = m.id === selectedMaterialId;
            return (
              <button
                key={m.id}
                disabled={applying}
                onClick={() => void handleApply(m.id)}
                className={[
                  'flex items-center gap-2 rounded border px-2 py-1.5 text-left font-mono text-[11px] transition-colors',
                  isSelected
                    ? 'border-laser bg-ink-800 text-ink-100'
                    : 'border-ink-700 bg-ink-950 text-ink-300 hover:border-ink-500 hover:text-ink-100',
                  applying ? 'cursor-not-allowed opacity-50' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span
                  className="inline-block shrink-0 rounded-full border border-ink-600"
                  style={{ width: 16, height: 16, backgroundColor: m.swatch }}
                  title={m.swatch}
                />
                <span className="truncate">{m.label}</span>
                {isSelected && <span className="ml-auto text-[10px] text-laser">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Debug footer */}
      <div className="mt-auto border-t border-ink-800 pt-3 font-mono text-[10px] text-ink-600">
        layer: {selectedLayerId?.slice(0, 8)}…{selectedMaterialId && ` · ${selectedMaterialId}`}
      </div>
    </div>
  );
}
