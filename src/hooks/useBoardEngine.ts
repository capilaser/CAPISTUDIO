/**
 * useBoardEngine — hook do editor multi-broche (Onda 13.6).
 *
 * Diferenças do useCanvasEngine (single-product):
 *   - Canvas é instanciado com tamanho da PRANCHA (board), não do produto.
 *   - Cada broche entra como aplique posicionado em offset Y (e X se for
 *     coluna 2). NÃO chama loadProductSvgFromMeta — sem base global do
 *     produto, porque a prancha não tem "1 produto".
 *   - Material aplica-se POR broche (applyMaterialToLayer no aplique
 *     correspondente), não no base.
 *   - boardItems vem do store via useCanvasStore — o hook lê e popula
 *     o canvas. Sem prop drilling.
 *
 * Boot:
 *   1. Calcula dimensões da prancha a partir dos items
 *   2. Cria canvas com (boardWidthMm, boardHeightMm)
 *   3. Pra cada item: parseCorelSvg(product.baseSvg) → addAppliqueSvg
 *      com position = offset calculado. Aplica material no aplique
 *      criado.
 *   4. Marca ready=true
 *
 * Reload quando boardItems muda: efeito reroda. Engine é descartado e
 * recriado. Caro mas correto — em uma onda futura podemos diff e
 * incrementar.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

import { CanvasEngine } from '@/core/canvas/canvas-engine';
import { parseCorelSvg } from '@/core/canvas/corel-svg-parser';
import { attachCanvasKeybindings } from '@/core/canvas/keybindings';
import {
  getById as getMaterialById,
  resolveAssetUrl,
} from '@/data/repositories/materialRepository';
import { getPatternById } from '@/data/repositories/patternRepository';
import { getProductById, type Product } from '@/data/repositories/productRepository';
import { useAltKey } from '@/hooks/useAltKey';
import { useCanvasStore, type BoardItemDraft, type CanvasMode } from '@/stores/canvas-store';

/** Itens por coluna na prancha (regra do dono — 6º+ vai pra coluna 2). */
const ITEMS_PER_COLUMN = 5;
/** Gap vertical entre broches em mm (regra do dono). */
const GAP_Y_MM = 4;
/** Gap horizontal entre colunas em mm. */
const GAP_X_MM = 8;

export interface UseBoardEngineOptions {
  boardItems: BoardItemDraft[];
  viewport: { widthPx: number; heightPx: number };
  mode: CanvasMode;
  /**
   * Onda 13.7 — snapshot do canvas inteiro pra reabertura. Quando informado
   * (e não-vazio), o hook pula a montagem de apliques via baseSvg e
   * deserializa este JSON diretamente. As dimensões da prancha continuam
   * sendo calculadas dos boardItems (precisa pra config do engine).
   *
   * Onda 14b-schema (migration v12) — persistência agora é em
   * `orders.board_canvas_json` (coluna própria). Antes ficava em
   * order_items[0].canvasJson como gambiarra, foi limpo na v12.
   */
  snapshotCanvasJson?: string;
}

export interface UseBoardEngineResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engineRef: RefObject<CanvasEngine | null>;
  ready: boolean;
  error: string | null;
  /** Mapeia boardItem.id → layerId do aplique correspondente no engine. */
  layerByItemId: RefObject<Map<string, string>>;
  /** Dimensões calculadas da prancha em mm (pra preview, debug). */
  boardDims: { widthMm: number; heightMm: number } | null;
  /**
   * Onda 15.fix — incrementa a cada engine novo instanciado. Consumido pelo
   * LayerPanel como dep do useEffect: garante re-anexação de listeners no
   * canvas novo quando o engine é trocado (boardKey muda).
   */
  engineVersion: number;
}

/**
 * Calcula posição (em mm) de cada broche na prancha.
 * Items 0..4 = coluna 1, 5..9 = coluna 2, etc.
 * Empilhamento vertical com gap de GAP_Y_MM, gap horizontal GAP_X_MM.
 *
 * Assume todos os items têm o MESMO produto (60×25) — limitação atual.
 * Produtos mistos numa prancha funcionariam mas precisariam cálculo
 * mais elaborado (column-major bounds).
 */
function computeItemPositions(
  items: Array<{ widthMm: number; heightMm: number }>
): Array<{ leftMm: number; topMm: number }> {
  const positions: Array<{ leftMm: number; topMm: number }> = [];
  // Largura da coluna 1 = max width dos items na coluna 1.
  const colWidths = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const col = Math.floor(i / ITEMS_PER_COLUMN);
    colWidths.set(col, Math.max(colWidths.get(col) ?? 0, items[i].widthMm));
  }
  // Cálculo cumulativo de leftMm por coluna.
  const colLefts = new Map<number, number>();
  let cumLeft = 0;
  for (let c = 0; c < colWidths.size; c++) {
    colLefts.set(c, cumLeft);
    cumLeft += (colWidths.get(c) ?? 0) + GAP_X_MM;
  }
  // Pra cada item: topMm é acumulado dentro da coluna; leftMm é o da coluna.
  const colTops = new Map<number, number>();
  for (let i = 0; i < items.length; i++) {
    const col = Math.floor(i / ITEMS_PER_COLUMN);
    const top = colTops.get(col) ?? 0;
    positions.push({ leftMm: colLefts.get(col) ?? 0, topMm: top });
    colTops.set(col, top + items[i].heightMm + GAP_Y_MM);
  }
  return positions;
}

/** Calcula bounding box da prancha (mm). */
function computeBoardDims(
  items: Array<{ widthMm: number; heightMm: number }>,
  positions: Array<{ leftMm: number; topMm: number }>
): { widthMm: number; heightMm: number } {
  let maxRight = 0;
  let maxBottom = 0;
  for (let i = 0; i < items.length; i++) {
    const right = positions[i].leftMm + items[i].widthMm;
    const bottom = positions[i].topMm + items[i].heightMm;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return { widthMm: maxRight, heightMm: maxBottom };
}

export function useBoardEngine(options: UseBoardEngineOptions): UseBoardEngineResult {
  const { boardItems, viewport, mode, snapshotCanvasJson } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const layerByItemId = useRef(new Map<string, string>());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [boardDims, setBoardDims] = useState<{ widthMm: number; heightMm: number } | null>(null);
  // Onda 15.fix — incrementa a cada engine novo. LayerPanel usa como dep.
  const [engineVersion, setEngineVersion] = useState(0);

  const { setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind } = useCanvasStore();
  const altKeyRef = useAltKey();

  // Snapshot só é consumido na primeira montagem com items. Depois disso,
  // mudanças em boardItems remontam do zero (sem snapshot). Ref evita
  // adicionar string gigante nas deps do useEffect.
  const snapshotRef = useRef(snapshotCanvasJson);
  useEffect(() => {
    snapshotRef.current = snapshotCanvasJson;
  }, [snapshotCanvasJson]);
  const snapshotConsumed = useRef(false);

  // Key da prancha = só id+productId (estrutura física). Mudou → reboot do engine.
  // Onda 15.fix — TIRADO materialId/patternId daqui: trocar material ou pattern
  // não reboota engine. Mudanças são aplicadas via segundo useEffect (sync
  // incremental). Antes: mudar cor do broche destruía toda a sessão do operador
  // (zoom, pan, slots arrastados, textos digitados).
  const boardKey = boardItems.map((it) => `${it.id}:${it.productId}`).join('|');

  // Hash dos materialIds e patternIds atuais — usado pelo sync incremental
  // pra detectar mudança sem reboot.
  const materialsKey = boardItems.map((it) => `${it.id}:${it.materialId ?? ''}`).join('|');
  const patternsKey = boardItems.map((it) => `${it.id}:${it.patternId ?? ''}`).join('|');

  useEffect(() => {
    let cancelled = false;
    let detachKeys: (() => void) | null = null;
    // Onda 15.fix — variável local pra dispose async-safe. O engine é criado
    // em meio ao boot async; sem isso, se boardKey mudar antes de
    // `engineRef.current = engine` (publicação), o cleanup tenta dispose de
    // engineRef.current (engine ANTERIOR ou null), deixando o engine novo
    // órfão pendurado ao DOM canvas. Causa real do bug das camadas
    // duplicadas que apareceu em multi-broche.
    let currentEngine: CanvasEngine | null = null;
    // Captura o ref local — react-hooks/exhaustive-deps avisa que .current pode
    // mudar entre setup e cleanup. Aqui o ref vive a vida útil do hook.
    const layerByItemIdRef = layerByItemId;

    // Onda 15.fix — dispose helper que também zera currentEngine pra evitar
    // dispose duplicado no cleanup do effect.
    function disposeCurrent(): void {
      if (currentEngine) {
        currentEngine.dispose();
        currentEngine = null;
      }
    }

    async function boot() {
      // Marca não-ready dentro de async (não-sincrono no body do useEffect,
      // evita warning react-hooks/set-state-in-effect).
      setReady(false);
      try {
        if (boardItems.length === 0 || !canvasRef.current) {
          setBoardDims(null);
          return;
        }

        // 1. Carrega produtos de cada broche EM PARALELO (Onda 15.fix).
        //    Antes: sequencial — 10 broches = 10 round-trips serializados ao SQLite.
        //    Agora: Promise.all reduz pra ~1 round-trip de latência.
        const productsRaw = await Promise.all(boardItems.map((it) => getProductById(it.productId)));
        if (cancelled) return;
        const products: Product[] = [];
        for (let i = 0; i < productsRaw.length; i++) {
          const p = productsRaw[i];
          const it = boardItems[i];
          if (!p) {
            setError(`Produto '${it.productId}' não encontrado.`);
            return;
          }
          if (!p.baseSvg) {
            setError(`Produto '${it.productId}' sem base_svg no banco.`);
            return;
          }
          products.push(p);
        }

        // 2. Calcula posições da prancha.
        const dims = products.map((p) => ({
          widthMm: p.canvasMm.width,
          heightMm: p.canvasMm.height,
        }));
        const positions = computeItemPositions(dims);
        const board = computeBoardDims(dims, positions);
        if (cancelled) return;
        setBoardDims(board);

        // 3. Instancia engine com tamanho da prancha.
        const engine = new CanvasEngine(canvasRef.current!, {
          productWidthMm: board.widthMm,
          productHeightMm: board.heightMm,
          viewportWidthPx: viewport.widthPx,
          viewportHeightPx: viewport.heightPx,
        });
        // Onda 15.fix — publica imediatamente pra variável local. Cleanup
        // do effect (que pode rodar antes do boot terminar) usa esta var
        // pra dispose do engine certo, mesmo que engineRef.current ainda
        // aponte pro engine anterior.
        currentEngine = engine;

        // 3.5 Onda 13.7 — Reabertura: se há snapshot pendente, deserializa
        // direto (pula a montagem via baseSvg). Snapshot inclui os apliques
        // base com os ids board-item:* originais + textos/objetos do operador.
        const snapshotJson = snapshotRef.current;
        if (
          snapshotJson &&
          !snapshotConsumed.current &&
          snapshotJson !== '{}' &&
          snapshotJson !== ''
        ) {
          try {
            const parsed = JSON.parse(snapshotJson) as Parameters<typeof engine.deserialize>[0];
            await engine.deserialize(parsed, async (materialId) => {
              const mat = await getMaterialById(materialId);
              if (!mat) throw new Error(`Material not found: ${materialId}`);
              return resolveAssetUrl(mat);
            });
            snapshotConsumed.current = true;
            // Reconstrói layerByItemId a partir dos layers restaurados.
            layerByItemId.current.clear();
            for (let i = 0; i < boardItems.length; i++) {
              const itemId = boardItems[i].id;
              const expected = `board-item:${itemId}`;
              for (const [layerId, meta] of engine.getAllLayerMetas()) {
                if (meta.kind === 'principal' && meta.appliqueId === expected) {
                  layerByItemId.current.set(itemId, layerId);
                  break;
                }
              }
            }
            // Pula a montagem via baseSvg — snapshot já tem tudo.
            if (cancelled) {
              disposeCurrent();
              return;
            }
            engine.onSlotSelectionChange = setSelectedSlotId;
            engine.onLayerSelectionChange = (id, meta) => {
              setSelectedLayerId(id);
              setSelectedLayerKind(meta?.kind ?? null);
            };
            engine.setSnapOptions({ isAltDown: () => altKeyRef.current });
            engineRef.current = engine;
            // Onda 15.fix — sinaliza LayerPanel pra re-anexar listeners no canvas novo.
            setEngineVersion((v) => v + 1);
            detachKeys = attachCanvasKeybindings({
              onZoomIn: () => engine.zoomBy(1.1),
              onZoomOut: () => engine.zoomBy(1 / 1.1),
              onZoomReset: () => engine.resetView(),
              onPanStart: () => engine.setPanMode(true),
              onPanEnd: () => engine.setPanMode(false),
              onSave: () => {
                /* save fica na página */
              },
            });
            setReady(true);
            return;
          } catch (e) {
            console.warn('[useBoardEngine] snapshot deserialize falhou — recriando do baseSvg:', e);
            // Cai pro fluxo normal abaixo.
            snapshotConsumed.current = true;
          }
        }

        // 3.6 Pré-carrega materials únicos EM PARALELO (Onda 15.fix).
        //    Mesmo material pode aparecer em N broches; carrega 1 vez.
        const uniqueMaterialIds = Array.from(
          new Set(boardItems.map((it) => it.materialId).filter((id): id is string => !!id))
        );
        const materialsMap = new Map<string, { id: string; url: string }>();
        if (uniqueMaterialIds.length > 0) {
          const materialsRaw = await Promise.all(
            uniqueMaterialIds.map((id) => getMaterialById(id))
          );
          if (cancelled) {
            disposeCurrent();
            return;
          }
          const urlPromises: Array<Promise<{ id: string; url: string } | null>> = materialsRaw.map(
            async (mat) => {
              if (!mat) return null;
              try {
                const url = await resolveAssetUrl(mat);
                return { id: mat.id, url };
              } catch {
                return null;
              }
            }
          );
          const resolved = await Promise.all(urlPromises);
          if (cancelled) {
            disposeCurrent();
            return;
          }
          for (const r of resolved) if (r) materialsMap.set(r.id, r);
          // DEBUG Onda 18 — bug material dourado→prata.
          if (import.meta.env.DEV) {
            console.log(
              '[DEBUG-mat] preload: uniqueMaterialIds=',
              uniqueMaterialIds,
              'materialsMap=',
              Array.from(materialsMap.entries()).map(([id, { url }]) => ({
                id,
                urlTail: url.split('/').slice(-2).join('/'),
              }))
            );
          }
        }

        // 4. Pra cada broche: parse baseSvg + addAppliqueSvg na posição.
        //    Aplica material na camada criada.
        layerByItemId.current.clear();
        for (let i = 0; i < boardItems.length; i++) {
          if (cancelled) {
            disposeCurrent();
            return;
          }
          const item = boardItems[i];
          const product = products[i];
          const pos = positions[i];
          try {
            const meta = parseCorelSvg(product.baseSvg!);
            const layerId = await engine.addAppliqueSvg(
              meta,
              `Broche ${i + 1}`,
              `board-item:${item.id}`,
              { leftMm: pos.leftMm, topMm: pos.topMm }
            );
            layerByItemId.current.set(item.id, layerId);

            // Aplica material no broche usando o map pré-carregado.
            if (item.materialId) {
              const matEntry = materialsMap.get(item.materialId);
              // DEBUG Onda 18 — bug material dourado→prata.
              // Log estruturado: id solicitado vs id que vai pro engine vs url.
              // Remove quando bug for resolvido (memory: debt_material_dourado_prata).
              if (import.meta.env.DEV) {
                console.log(
                  `[DEBUG-mat] boot broche ${i + 1}: item.materialId="${item.materialId}" → ` +
                    `matEntry={id:"${matEntry?.id ?? 'MISS'}", url:"${matEntry?.url ?? 'MISS'}"} ` +
                    `(materialsMap.size=${materialsMap.size})`
                );
              }
              if (matEntry && !cancelled) {
                try {
                  await engine.applyMaterialToLayer(layerId, matEntry.id, matEntry.url);
                } catch (e) {
                  console.warn(`[useBoardEngine] applyMaterial falhou no broche ${i + 1}:`, e);
                }
              }
            }
          } catch (e) {
            console.error(`[useBoardEngine] falhou broche ${i + 1}:`, e);
            // Continua com os outros — operador vê os que carregaram.
          }
        }

        if (cancelled) {
          disposeCurrent();
          return;
        }

        // 5. Re-aplica patterns dos broches que têm patternId no store.
        //    Sem isso, adicionar/remover broche (que remonta a prancha) destrói
        //    visualmente os patterns dos broches anteriores. O store mantém
        //    patternId, mas o engine é recriado do zero.
        //    Passa parentLayerId = layerId do aplique base — os slots do pattern
        //    viram filhos do broche no painel de camadas.
        //    Onda 15.fix — paralelo: carrega patterns únicos antes do loop.
        const uniquePatternIds = Array.from(
          new Set(boardItems.map((it) => it.patternId).filter((id): id is string => !!id))
        );
        const patternsMap = new Map<string, Awaited<ReturnType<typeof getPatternById>>>();
        if (uniquePatternIds.length > 0) {
          const patternsRaw = await Promise.all(uniquePatternIds.map((id) => getPatternById(id)));
          if (cancelled) {
            disposeCurrent();
            return;
          }
          for (let i = 0; i < uniquePatternIds.length; i++) {
            patternsMap.set(uniquePatternIds[i], patternsRaw[i]);
          }
        }

        // Resolve materialId→url usando o mesmo cache de materials.
        // Pattern pode referenciar material novo (não usado nos broches base) —
        // nesse caso usa getMaterialById ad-hoc no callback.
        const materialResolver = async (materialId: string): Promise<string> => {
          const cached = materialsMap.get(materialId);
          if (cached) return cached.url;
          const mat = await getMaterialById(materialId);
          if (!mat) throw new Error(`Material not found: ${materialId}`);
          const url = await resolveAssetUrl(mat);
          materialsMap.set(materialId, { id: materialId, url });
          return url;
        };

        for (let i = 0; i < boardItems.length; i++) {
          if (cancelled) {
            disposeCurrent();
            return;
          }
          const item = boardItems[i];
          if (!item.patternId) continue;
          const pos = positions[i];
          const parentLayerId = layerByItemId.current.get(item.id);
          const pattern = patternsMap.get(item.patternId);
          if (!pattern || !pattern.canvasJson) continue;
          try {
            await engine.applyPatternObjects(
              pattern.canvasJson as unknown as Parameters<typeof engine.applyPatternObjects>[0],
              { leftMm: pos.leftMm, topMm: pos.topMm },
              materialResolver,
              parentLayerId
            );
          } catch (e) {
            console.warn(
              `[useBoardEngine] re-aplicar pattern '${item.patternId}' no broche ${i + 1} falhou:`,
              e
            );
          }
        }

        engine.onSlotSelectionChange = setSelectedSlotId;
        engine.onLayerSelectionChange = (id, meta) => {
          setSelectedLayerId(id);
          setSelectedLayerKind(meta?.kind ?? null);
        };
        engine.setSnapOptions({ isAltDown: () => altKeyRef.current });
        engineRef.current = engine;
        // Onda 15.fix — sinaliza LayerPanel pra re-anexar listeners no canvas novo.
        setEngineVersion((v) => v + 1);

        detachKeys = attachCanvasKeybindings({
          onZoomIn: () => engine.zoomBy(1.1),
          onZoomOut: () => engine.zoomBy(1 / 1.1),
          onZoomReset: () => engine.resetView(),
          onPanStart: () => engine.setPanMode(true),
          onPanEnd: () => engine.setPanMode(false),
          onSave: () => {
            /* save fica na página */
          },
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
      // Onda 15.fix — usa currentEngine (variável local do effect) em vez de
      // engineRef.current. Garante dispose mesmo se boardKey mudou ANTES de
      // publicar engineRef.current = engine (ver currentEngine no boot).
      if (currentEngine) {
        currentEngine.setSnapOptions(null);
        currentEngine.dispose();
      }
      // Limpa o ref público SE ele aponta pro engine que estamos descartando.
      // Senão (engine novo já publicou no ref), deixa intocado.
      if (engineRef.current === currentEngine) {
        engineRef.current = null;
      }
      currentEngine = null;
      layerByItemIdRef.current.clear();
    };
    // boardKey já encapsula identidade dos items. setters Zustand são estáveis.
    // viewport/altKeyRef estáveis na vida útil da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardKey, setSelectedSlotId, setSelectedLayerId, setSelectedLayerKind]);

  // Sync mode → canvas engine.
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.setMode(mode);
  }, [mode, ready]);

  // Onda 15.fix — Sync incremental de MATERIAL.
  // Quando boardItems[i].materialId muda (operador trocou a cor), aplica direto
  // na layer correspondente. Sem reboot do engine.
  const lastMaterialsKey = useRef('');
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    if (lastMaterialsKey.current === materialsKey) return;
    lastMaterialsKey.current = materialsKey;
    const engine = engineRef.current;
    let cancelled = false;
    void (async () => {
      for (const item of boardItems) {
        if (cancelled) return;
        const layerId = layerByItemId.current.get(item.id);
        if (!layerId) continue;
        if (!item.materialId) continue;
        try {
          const mat = await getMaterialById(item.materialId);
          if (cancelled || !mat) continue;
          const url = await resolveAssetUrl(mat);
          if (cancelled) return;
          await engine.applyMaterialToLayer(layerId, mat.id, url);
        } catch (e) {
          if (import.meta.env.DEV) {
            console.warn(`[useBoardEngine] sync material falhou item ${item.id}:`, e);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [materialsKey, ready, boardItems]);

  // Onda 15.fix — Sync incremental de PATTERN.
  // Quando boardItems[i].patternId muda (operador aplicou novo pattern via UI
  // ou trocou via PatternBar), o canvas já foi atualizado diretamente pelo
  // próprio PatternBar — esse effect só serve pra cobrir caso de mudança
  // programática (ex: reabertura). Hoje no-op pra evitar duplo-apply: o
  // PatternBar chama removeItemContents + applyPatternObjects diretamente
  // antes de atualizar o store.
  const lastPatternsKey = useRef('');
  useEffect(() => {
    if (!ready || !engineRef.current) return;
    lastPatternsKey.current = patternsKey;
  }, [patternsKey, ready]);

  return {
    canvasRef,
    engineRef,
    ready,
    error,
    layerByItemId,
    boardDims,
    engineVersion,
  };
}

// Re-exportos pra outros módulos calcularem posições sem instanciar engine.
export { computeItemPositions, computeBoardDims, ITEMS_PER_COLUMN, GAP_Y_MM, GAP_X_MM };
