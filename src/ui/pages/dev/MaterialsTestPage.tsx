/**
 * /dev/materials-test — Checkpoint A validation page (Onda 5)
 *
 * Displays all 4 ABS Escovado materials with:
 *  - 24px swatch circle (hex from DB)
 *  - label
 *  - real PNG thumbnail loaded via Tauri asset protocol
 *
 * This page is DEV-only and will NOT appear in production builds.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { listFamilies } from '@/data/repositories/materialFamilyRepository';
import type { MaterialFamily } from '@/data/repositories/materialFamilyRepository';
import { listByFamily, resolveAssetUrl } from '@/data/repositories/materialRepository';
import type { Material } from '@/data/repositories/materialRepository';

interface MaterialWithUrl extends Material {
  assetUrl: string | null;
  urlError: string | null;
}

interface FamilyGroup {
  family: MaterialFamily;
  materials: MaterialWithUrl[];
}

export default function MaterialsTestPage() {
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const families = await listFamilies();
        const result: FamilyGroup[] = [];

        for (const family of families) {
          const mats = await listByFamily(family.id);
          const withUrls: MaterialWithUrl[] = await Promise.all(
            mats.map(async (m) => {
              try {
                const assetUrl = await resolveAssetUrl(m);
                return { ...m, assetUrl, urlError: null };
              } catch (err) {
                return {
                  ...m,
                  assetUrl: null,
                  urlError: err instanceof Error ? err.message : String(err),
                };
              }
            })
          );
          result.push({ family, materials: withUrls });
        }

        setGroups(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100 p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-laser">/dev/materials-test</h1>
            <p className="text-ink-400 text-sm mt-1">
              Checkpoint A — Onda 5 · valida asset protocol + swatches
            </p>
          </div>
          <Link to="/" className="text-xs text-ink-500 hover:text-ink-300 underline">
            ← Home
          </Link>
        </div>

        {/* States */}
        {loading && <p className="text-ink-400 text-sm animate-pulse">Carregando materiais…</p>}

        {error && (
          <div className="bg-red-950 border border-red-700 rounded p-4 text-red-300 text-sm">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {/* Material groups */}
        {!loading &&
          !error &&
          groups.map(({ family, materials }) => (
            <div key={family.id} className="mb-10">
              {/* Family header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-base font-semibold text-ink-200">{family.label}</h2>
                <span className="text-xs text-ink-500 bg-ink-900 px-2 py-0.5 rounded">
                  {family.id}
                </span>
                {family.brushed && (
                  <span className="text-xs text-ink-400 bg-ink-800 px-2 py-0.5 rounded">
                    escovado
                  </span>
                )}
                <span className="text-xs text-ink-500 ml-auto">
                  {materials.length} variante{materials.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Material cards */}
              <div className="grid grid-cols-2 gap-4">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="bg-ink-900 border border-ink-800 rounded-lg p-4 flex flex-col gap-3"
                  >
                    {/* Swatch + label row */}
                    <div className="flex items-center gap-3">
                      {/* 24px swatch circle */}
                      <span
                        className="shrink-0 rounded-full border border-ink-700"
                        style={{ width: 24, height: 24, backgroundColor: m.swatch }}
                        title={m.swatch}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-100 truncate">{m.label}</p>
                        <p className="text-xs text-ink-500 truncate">{m.id}</p>
                      </div>
                      <code className="text-xs text-ink-400 ml-auto shrink-0">{m.swatch}</code>
                    </div>

                    {/* PNG thumbnail */}
                    {m.assetUrl ? (
                      <div className="relative">
                        <img
                          src={m.assetUrl}
                          alt={`Textura ${m.label}`}
                          className="w-full h-24 object-cover rounded border border-ink-700"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            (
                              e.currentTarget.nextElementSibling as HTMLElement | null
                            )?.removeAttribute('hidden');
                          }}
                        />
                        <p hidden className="text-xs text-red-400 mt-1">
                          ✗ Erro ao carregar PNG
                        </p>
                        <p className="text-xs text-ink-500 mt-1 truncate">{m.pngPath}</p>
                      </div>
                    ) : (
                      <div className="bg-red-950 border border-red-800 rounded p-2">
                        <p className="text-xs text-red-400">✗ resolveAssetUrl falhou</p>
                        <p className="text-xs text-red-500 mt-1 break-all">{m.urlError}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Summary */}
        {!loading && !error && (
          <div className="mt-8 border-t border-ink-800 pt-4 text-xs text-ink-500">
            <p>
              {groups.reduce((acc, g) => acc + g.materials.length, 0)} materiais carregados ·{' '}
              {groups.reduce((acc, g) => acc + g.materials.filter((m) => m.assetUrl).length, 0)} com
              URL resolvida
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
