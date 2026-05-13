import { useEffect, useRef, useState, type RefObject } from 'react';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { attachCanvasKeybindings } from '@/core/canvas/keybindings';
import {
  getById as getMaterialById,
  resolveAssetUrl,
} from '@/data/repositories/materialRepository';
import { getPatternById, upsertPatternCanvas } from '@/data/repositories/patternRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';
import { useAltKey } from '@/hooks/useAltKey';
import { useCanvasStore, type CanvasMode } from '@/stores/canvas-store';

export interface UseCanvasEngineOptions {
  productId: string;
  /**
   * Pattern opcional. Quando omitido, o canvas abre vazio (só produto base —
   * sem deserialize, sem preloadMaterials, sem loadSlotsFromCanvas).
   * Fase C usa essa forma pra abrir pedido sem padrão pré-carregado.
   */
  patternId?: string;
  viewport: { widthPx: number; heightPx: number };
  /**
   * Label usado no metadado do `upsertPatternCanvas` ao salvar.
   * Default: 'Canvas'.
   */
  patternLabel?: string;
  /**
   * Modo atual do canvas-store. O hook sincroniza `engine.setMode(mode)`
   * sempre que muda. Recebido como prop pra desacoplar o hook da fonte
   * (em testes pode passar valor estático).
   */
  mode: CanvasMode;
}

export interface UseCanvasEngineResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /**
   * Expõe `engineRef` cru deliberadamente — componentes-filhos como
   * SlotCreatorButtons, GridToggle, AlignmentToolbar e ApliquePanel já
   * são "íntimos" do engine e chamam métodos imperativos. Encapsular
   * tudo em N métodos do hook não traria ganho real e inflaria a API.
   * Se um componente novo precisar só de 1-2 métodos, considerar expor
   * método dedicado.
   */
  engineRef: RefObject<CanvasEngine | null>;
  product: Product | null;
  ready: boolean;
  error: string | null;
  saving: boolean;
  /**
   * Salva o canvas atual no `patternId` configurado em options.
   * Lança erro se options.patternId for undefined — a página decide
   * o que fazer (toast, log, modal). Princípio: hook não decide UX,
   * hook valida invariante.
   */
  save: () => Promise<void>;
  clear: () => void;
  loadPattern: (patternId: string) => Promise<void>;
}

export function useCanvasEngine(options: UseCanvasEngineOptions): UseCanvasEngineResult {
  const { productId, patternId, viewport, patternLabel = 'Canvas', mode } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const productRef = useRef<Product | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Setters do Zustand são estáveis (atribuição direta `set({...})` em
  // canvas-store.ts:43-46) — listá-los nas deps satisfaz exhaustive-deps
  // sem re-runs.
  const { setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind } = useCanvasStore();

  const altKeyRef = useAltKey();

  // save/clear/loadPattern como refs estáveis: page-shell passa pra Toolbar
  // como callbacks; mudar identidade entre renders forçaria Toolbar a re-render.
  // Implementação real fica em closures que leem refs/state dentro do hook.
  async function save(): Promise<void> {
    const engine = engineRef.current;
    const p = productRef.current;
    if (!engine || !p || savingRef.current) return;
    if (!patternId) {
      throw new Error(
        'useCanvasEngine.save() requires patternId. Use the dedicated saveAs flow for new patterns.'
      );
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const data = engine.serialize(p.id);
      await upsertPatternCanvas(patternId, p.id, JSON.stringify(data), patternLabel);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function clear(): void {
    engineRef.current?.clearUserObjects();
    setSelectedLayerId(null);
    setSelectedLayerKind(null);
  }

  async function loadPattern(otherPatternId: string): Promise<void> {
    const engine = engineRef.current;
    const p = productRef.current;
    if (!engine || !p) return;

    const pattern = await getPatternById(otherPatternId);
    if (!pattern?.canvasJson) return;

    const layers = pattern.canvasJson.capi?.layers ?? [];
    await engine.deserialize(
      {
        version: pattern.canvasJson.version,
        objects: pattern.canvasJson.objects as Array<Record<string, unknown>>,
        capi: {
          productId: p.id,
          units: 'mm',
          schemaVersion: pattern.canvasJson.capi?.schemaVersion ?? 2,
          layers,
        },
      },
      async (materialId) => {
        const mat = await getMaterialById(materialId);
        if (!mat) throw new Error(`Material not found: ${materialId}`);
        return resolveAssetUrl(mat);
      }
    );
    engine.loadSlotsFromCanvas();
    setSelectedLayerId(null);
    setSelectedLayerKind(null);
  }

  useEffect(() => {
    let cancelled = false;
    let detachKeys: (() => void) | null = null;

    async function boot() {
      try {
        const p = await getProductById(productId);
        if (!p) {
          setError(`Product '${productId}' not found in database.`);
          return;
        }
        if (cancelled || !canvasRef.current) return;
        productRef.current = p;
        setProduct(p);

        const engine = new CanvasEngine(canvasRef.current, {
          productWidthMm: p.canvasMm.width,
          productHeightMm: p.canvasMm.height,
          viewportWidthPx: viewport.widthPx,
          viewportHeightPx: viewport.heightPx,
        });

        // ADR 013: base_svg comes from the DB (seeded from fixture), not a static fetch.
        // p.baseSvg is already returned by productRepository.getProductById().
        if (!p.baseSvg) {
          throw new Error(
            `Product '${productId}' has no base_svg in the database. Re-seed the DB.`
          );
        }
        if (cancelled) {
          engine.dispose();
          return;
        }
        // Parse + validate through all 6 gates before touching the canvas.
        // parseCorelSvg throws user-readable errors for any quality issue —
        // the catch block below surfaces them via setError.
        const meta = parseCorelSvg(p.baseSvg);
        await engine.loadProductSvgFromMeta(meta);
        if (cancelled) {
          engine.dispose();
          return;
        }

        // Restore prior state if pattern is configured.
        if (patternId) {
          const existing = await getPatternById(patternId);
          if (cancelled) {
            engine.dispose();
            return;
          }
          if (existing?.canvasJson) {
            if ((existing.canvasJson.objects?.length ?? 0) > 0) {
              try {
                // Collect materialIds present in layers for pre-loading.
                const layers = existing.canvasJson.capi?.layers ?? [];
                const matEntries: Array<{ id: string; url: string }> = [];

                await engine.deserialize(
                  {
                    version: existing.canvasJson.version,
                    objects: existing.canvasJson.objects as Array<Record<string, unknown>>,
                    capi: {
                      productId: p.id,
                      units: 'mm',
                      schemaVersion: existing.canvasJson.capi?.schemaVersion ?? 1,
                      layers,
                    },
                  },
                  // Re-apply material Patterns from saved materialIds.
                  async (materialId) => {
                    const mat = await getMaterialById(materialId);
                    if (!mat) throw new Error(`Material not found: ${materialId}`);
                    const url = await resolveAssetUrl(mat);
                    matEntries.push({ id: materialId, url });
                    return url;
                  }
                );

                // Pre-warm the image cache with the materials we already resolved
                // during deserialize — zero additional IPC calls.
                if (matEntries.length > 0) {
                  await engine.preloadMaterials(matEntries);
                }
              } catch (e) {
                if (import.meta.env.DEV) {
                  console.warn('[useCanvasEngine] deserialize failed, opening empty:', e);
                }
              }
            }
          } else if (existing === null && import.meta.env.DEV) {
            console.info(
              `[useCanvasEngine] no pattern '${patternId}' yet — will be created on first save.`
            );
          }
        }

        // loadSlotsFromCanvas roda sempre — slots podem vir do SVG do produto
        // base ou do deserialize. Paridade exata com o comportamento pré-hook.
        engine.loadSlotsFromCanvas();

        engine.onSlotSelectionChange = setSelectedSlotId;
        engine.onLayerSelectionChange = (id, meta) => {
          setSelectedLayerId(id);
          setSelectedLayerKind(meta?.kind ?? null);
        };
        // Connect snap — must run after engine is fully initialised so that
        // snapOptions is set before the first object:moving fires.
        // altKeyRef is a stable ref — the closure always reads the current value.
        engine.setSnapOptions({ isAltDown: () => altKeyRef.current });
        engineRef.current = engine;
        detachKeys = attachCanvasKeybindings({
          onZoomIn: () => engine.zoomBy(1.1),
          onZoomOut: () => engine.zoomBy(1 / 1.1),
          onZoomReset: () => engine.resetView(),
          onPanStart: () => engine.setPanMode(true),
          onPanEnd: () => engine.setPanMode(false),
          onSave: () => void save(),
        });
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    void boot();

    return () => {
      cancelled = true;
      detachKeys?.();
      engineRef.current?.setSnapOptions(null);
      engineRef.current?.dispose();
      engineRef.current = null;
      productRef.current = null;
    };
    // Zustand setters são refs estáveis (canvas-store.ts:43-46) — listá-los
    // satisfaz exhaustive-deps sem causar re-runs. altKeyRef é um ref object
    // estável — sua identidade nunca muda. save é closure local que lê refs
    // no tempo de chamada, então não precisa de re-wire dos keybindings.
    // patternLabel/viewport/patternId/productId mudarem em runtime indicaria
    // bug de uso (deveriam ser estáveis na vida útil da página).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind]);

  // Sync mode → canvas engine whenever mode changes.
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.setMode(mode);
  }, [mode, ready]);

  return {
    canvasRef,
    engineRef,
    product,
    ready,
    error,
    saving,
    save,
    clear,
    loadPattern,
  };
}
