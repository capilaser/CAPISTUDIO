/**
 * RightPanel.tsx — Onda 5, Checkpoint B
 *
 * Layer material picker: appears only when a visual layer is selected on canvas.
 * Shows cascading family → material dropdowns with 16px swatch per material.
 *
 * DEV-only component (rendered from CanvasTest).
 */
import { type ChangeEvent, type RefObject, useEffect, useState } from 'react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { listFamilies } from '@/data/repositories/materialFamilyRepository';
import type { Material } from '@/data/repositories/materialRepository';
import { listByFamily, resolveAssetUrl } from '@/data/repositories/materialRepository';
import { useCanvasStore } from '@/stores/canvas-store';

interface RightPanelProps {
  engineRef: RefObject<CanvasEngine | null>;
}

export function RightPanel({ engineRef }: RightPanelProps) {
  const selectedLayerId = useCanvasStore((s) => s.selectedLayerId);
  const selectedLayerKind = useCanvasStore((s) => s.selectedLayerKind);

  const [families, setFamilies] = useState<MaterialFamily[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [applying, setApplying] = useState(false);
  // Initialize to true — we start loading immediately on mount.
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  // fetchedFamilyId tracks the last successfully-fetched family.
  // loadingMaterials is derived: true whenever selectedFamilyId differs.
  // This avoids calling setState synchronously inside an effect.
  const [fetchedFamilyId, setFetchedFamilyId] = useState<string>('');
  const loadingMaterials = !!selectedFamilyId && fetchedFamilyId !== selectedFamilyId;

  // Load families once on mount.
  // loadingFamilies is initialized to true so no sync setState is needed here.
  useEffect(() => {
    let cancelled = false;
    listFamilies()
      .then((fams) => {
        if (cancelled) return;
        setFamilies(fams);
        if (fams.length > 0) setSelectedFamilyId(fams[0].id);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[RightPanel] listFamilies error:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingFamilies(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load materials whenever family changes.
  // fetchedFamilyId drives the effect; updating it stops the fetch loop.
  // No sync setState in the effect body — loadingMaterials is derived above.
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
          if (import.meta.env.DEV) console.error('[RightPanel] listByFamily error:', err);
          // Mark fetched (even on error) so loading state clears.
          setFetchedFamilyId(selectedFamilyId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFamilyId, fetchedFamilyId]);

  // Sync selectedMaterialId from the layer's current materialId when layer changes.
  useEffect(() => {
    if (!selectedLayerId || !engineRef.current) {
      setSelectedMaterialId('');
      return;
    }
    const meta = engineRef.current.getLayerMeta(selectedLayerId);
    setSelectedMaterialId(meta?.materialId ?? '');
  }, [selectedLayerId, engineRef]);

  // Invisible when no visual layer is selected.
  if (selectedLayerKind !== 'visual' || !selectedLayerId) return null;

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
      if (import.meta.env.DEV) console.error('[RightPanel] applyMaterialToLayer error:', err);
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
    <aside className="flex w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-ink-700 bg-ink-900 p-4">
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
          <p className="font-mono text-[10px] text-ink-600 animate-pulse">Carregando…</p>
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

      {/* Material list — button-per-material with 16px swatch */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[11px] font-medium text-ink-300">
          Cor / Variante
          {loadingMaterials && <span className="ml-1 text-ink-600 animate-pulse">…</span>}
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
                {/* 16px swatch */}
                <span
                  className="inline-block shrink-0 rounded-full border border-ink-600"
                  style={{ width: 16, height: 16, backgroundColor: m.swatch }}
                  title={m.swatch}
                />
                <span className="truncate">{m.label}</span>
                {isSelected && <span className="ml-auto text-laser text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Debug footer */}
      <div className="mt-auto border-t border-ink-800 pt-3 font-mono text-[10px] text-ink-600">
        layer: {selectedLayerId?.slice(0, 8)}…{selectedMaterialId && ` · ${selectedMaterialId}`}
      </div>
    </aside>
  );
}
