import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { list as listAppliques } from '@/data/repositories/appliqueRepository';
import { getAllCategories } from '@/data/repositories/categoryRepository';
import { list as listSvgBases } from '@/data/repositories/svgBaseRepository';
import { list as listEngravings } from '@/data/repositories/engravingRepository';
import { getAllFonts } from '@/data/repositories/fontRepository';
import { getAllMachines } from '@/data/repositories/machineRepository';
import { list as listMarkings } from '@/data/repositories/markingRepository';
import { listFamilies } from '@/data/repositories/materialFamilyRepository';
import { getAllMaterials } from '@/data/repositories/materialRepository';
import { getAllOperations } from '@/data/repositories/operationRepository';
import { list as listPatternLayers } from '@/data/repositories/patternLayerRepository';
import { getAllPatternSummaries } from '@/data/repositories/patternRepository';
import { getAllProducts } from '@/data/repositories/productRepository';
import { getAllSettings } from '@/data/repositories/settingsRepository';
import { getAllSlotTypes } from '@/data/repositories/slotTypeRepository';

interface Section {
  title: string;
  rows: Array<Record<string, unknown>>;
}

export default function DevDbCheck() {
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Onda 6a — raw JSON test for appliqueRepo.list()
  const [appliqueJson, setAppliqueJson] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [
          machines,
          operations,
          slotTypes,
          fonts,
          categories,
          materialFamilies,
          materials,
          products,
          patterns,
          settingsMap,
          svgBases,
          patternLayers,
          appliques,
          engravings,
          markings,
        ] = await Promise.all([
          getAllMachines(),
          getAllOperations(),
          getAllSlotTypes(),
          getAllFonts(),
          getAllCategories(),
          listFamilies(),
          getAllMaterials(),
          getAllProducts(),
          getAllPatternSummaries(),
          getAllSettings(),
          listSvgBases(),
          listPatternLayers(),
          listAppliques(),
          listEngravings(),
          listMarkings(),
        ]);

        const settings = Object.entries(settingsMap).map(([key, value]) => ({ key, value }));

        setSections([
          {
            title: `machines (${machines.length})`,
            rows: machines as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `operations (${operations.length})`,
            rows: operations as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `slot_types (${slotTypes.length})`,
            rows: slotTypes as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `fonts (${fonts.length})`,
            rows: fonts as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `categories (${categories.length})`,
            rows: categories as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `material_families (${materialFamilies.length})`,
            rows: materialFamilies as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `materials (${materials.length})`,
            rows: materials as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `products (${products.length})`,
            rows: products as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `patterns (${patterns.length})`,
            rows: patterns as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `settings (${settings.length})`,
            rows: settings as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `svg_bases (${svgBases.length})`,
            rows: svgBases as unknown as Array<Record<string, unknown>>,
          },
          // ── Onda 6a ────────────────────────────────────────────────────────
          {
            title: `pattern_layers (${patternLayers.length})`,
            rows: patternLayers as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `appliques (${appliques.length})`,
            rows: appliques as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `engravings (${engravings.length})`,
            rows: engravings as unknown as Array<Record<string, unknown>>,
          },
          {
            title: `markings (${markings.length})`,
            rows: markings as unknown as Array<Record<string, unknown>>,
          },
        ]);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <main className="min-h-full animate-in fade-in bg-ink-950 font-mono text-xs text-ink-100 duration-150">
      <header className="sticky top-0 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-2">
        <span className="text-laser font-medium text-sm">DEV — db-check</span>
        <Link to="/" className="text-ink-400 hover:text-ink-200 transition-colors">
          ← home
        </Link>
      </header>

      <div className="p-4 space-y-6">
        {loading && <p className="text-ink-400">loading…</p>}

        {error && <p className="text-danger">error: {error}</p>}

        {/* ── Onda 6a — botão temporário: appliqueRepo.list() raw JSON ── */}
        <section className="border border-ink-700 rounded p-3">
          <h2 className="mb-2 text-ink-300 font-medium">Onda 6a — appliqueRepo.list() raw JSON</h2>
          <button
            className="px-3 py-1 text-xs bg-ink-800 hover:bg-ink-700 text-ink-200 rounded transition-colors"
            onClick={() => {
              listAppliques()
                .then((data) => setAppliqueJson(JSON.stringify(data, null, 2)))
                .catch((e: unknown) => setAppliqueJson(`ERROR: ${String(e)}`));
            }}
          >
            Chamar appliqueRepo.list()
          </button>
          {appliqueJson !== null && (
            <pre className="mt-2 overflow-x-auto rounded bg-ink-900 p-2 text-[11px] text-ink-200 whitespace-pre-wrap">
              {appliqueJson}
            </pre>
          )}
        </section>

        {sections.map(({ title, rows }) => (
          <section key={title}>
            <h2 className="mb-2 text-ink-300 font-medium">{title}</h2>
            {rows.length === 0 ? (
              <p className="text-ink-600 pl-2">empty</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-ink-800">
                      {Object.keys(rows[0]).map((col) => (
                        <th
                          key={col}
                          className="pb-1 pr-4 text-left text-ink-500 font-normal whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-b border-ink-900 hover:bg-ink-900/50">
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            className="py-0.5 pr-4 text-ink-300 whitespace-nowrap max-w-[200px] truncate"
                            title={String(val ?? '')}
                          >
                            {val === null ? (
                              <span className="text-ink-700">null</span>
                            ) : typeof val === 'object' ? (
                              <span className="text-ink-500">[object]</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
