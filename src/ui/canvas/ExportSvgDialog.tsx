/**
 * ExportSvgDialog — Onda 13.6 + Onda 27 (Fase C.3 SVG por chapa, Fase C.4 DXF).
 *
 * Modal pra exportar SVG da prancha (1 arquivo por máquina envolvida) pra
 * alimentar o software de corte/gravação. Análogo ao ExportPngDialog.
 *
 * Modos:
 *   - **Single-chapa** (legado): canvas inteiro → 1 SVG por máquina.
 *     Filename: `${stem}_${machineId}.svg`. DXF (opcional): por
 *     `${machineId}_${operation}`.
 *   - **Multi-chapa** (Onda 27): N SVGs por chapa, cada um com 1 arquivo
 *     por máquina envolvida na chapa. Filename:
 *     `${stem}_${chapaToken}_${machineId}.svg`. DXF (opcional): por
 *     `${stem}_${chapaToken}_${machineId}_${operation}.dxf`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openFolderPicker } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import {
  type BoardChapaDescriptor,
  exportBoardDxfByChapa,
  exportBoardSvgByChapa,
} from '@/core/export/board-exporter';
import { CHAPA_LABEL_HEIGHT_MM, type ChapaExportInfo } from '@/core/export/chapa-export-info';
import type { DxfDebugReport } from '@/core/export/dxf-debug-report';
import { exportDxfByMachineAndOperation } from '@/core/export/dxf-exporter';
import { exportDxfV2ByMachineAndOperation } from '@/core/export/dxf-exporter-v2';
import { precheckFonts, type FontPrecheckIssue } from '@/core/export/font-precheck';
import { resolveLayerRouting } from '@/core/export/routing-resolver';
import { withSlotContentExportable } from '@/core/export/slot-content-promoter';
import { exportSvgByMachine } from '@/core/export/svg-exporter';
import type { TextConversionError } from '@/core/export/svg-text-converter';
import { makeFontBufferLoader } from '@/services/font-buffer-loader';
import { validatePattern, type PatternIssue } from '@/core/patterns/validate-pattern';
import {
  PatternValidationDialog,
  type FontIssue,
  type RoutingSkipIssue,
} from '@/ui/pages/padroes/PatternValidationDialog';
import { setSetting } from '@/data/repositories/settingsRepository';
import { normalizeAssetName } from '@/lib/normalize-asset-name';
import { makeAssetLookup } from '@/services/asset-lookup';
import { saveDxfs } from '@/services/dxf-export-service';
import { saveDxfsV2 } from '@/services/dxf-export-service-v2';
import { DxfDebugPanel } from '@/ui/canvas/DxfDebugPanel';
import {
  SVG_EXPORT_LAST_FOLDER_KEY,
  getDefaultSvgFolder,
  saveSvgs,
} from '@/services/svg-export-service';
import { makeTauriIO } from '@/services/tauri-io';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';
import { Input } from '@/ui/components/input';
import { Label } from '@/ui/components/label';

interface ExportSvgDialogProps {
  open: boolean;
  /** Getter pra engine — chamado no momento que precisamos. */
  getEngine: () => CanvasEngine | null;
  /** Tamanho da prancha em mm. Vem do useBoardEngine.boardDims. */
  boardDims: { widthMm: number; heightMm: number } | null;
  /** Stem default do nome do arquivo (ex: pedidoLabel). */
  defaultStem?: string;
  /**
   * Onda 27 (Fase C) — chapas do pedido. Quando 2+, o dialog gera N×M SVGs
   * (N chapas × M máquinas envolvidas), cada filename ganhando o token da
   * chapa. Quando 0 ou 1, comportamento legado (1 arquivo por máquina).
   */
  chapaInfos?: ChapaExportInfo[];
  onClose: () => void;
}

function buildStem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'prancha';
  return normalizeAssetName(trimmed);
}

export function ExportSvgDialog({
  open,
  getEngine,
  boardDims,
  defaultStem,
  chapaInfos = [],
  onClose,
}: ExportSvgDialogProps) {
  // Onda 27 — multi-chapa quando 2+ chapas. Single-chapa preserva fluxo legado
  // exato (1 SVG por máquina, sem token de chapa no filename).
  const multiChapa = chapaInfos.length >= 2;

  const [nome, setNome] = useState('');
  const [folder, setFolder] = useState('');
  const [exporting, setExporting] = useState(false);
  // Onda 18: checkbox "Também exportar DXF" — default OFF.
  // Onda 27 (Fase C.4): habilitado também em multi-chapa, gerando 1 DXF por
  // (chapa × máquina × operação) via exportBoardDxfByChapa.
  const [exportDxf, setExportDxf] = useState(false);
  // DXF-4: checkbox paralelo "DXF v2 (AC1032/SPLINE)" — default OFF.
  // Único caminho de coexistência com o v1: pode marcar ambos. Sufixo `_v2`
  // no filename evita colisão. Desabilitado em multi-chapa (DXF-3.5).
  const [exportDxfV2, setExportDxfV2] = useState(false);
  // DXF-PRODUCTION-ALIGNMENT: modo debug do v2. Quando ativo, o exporter
  // popula um DxfDebugReport e o dialog mostra um painel ANTES de gravar
  // arquivo. Operador inspeciona números e confirma ou cancela.
  const [debugDxfV2, setDebugDxfV2] = useState(false);
  const [pendingDebugReport, setPendingDebugReport] = useState<DxfDebugReport | null>(null);
  // Resolver pendente que retoma o handleExport quando operador clica
  // "Continuar export" no painel debug. null fora do fluxo de debug.
  const pendingDebugResolverRef = useRef<((proceed: boolean) => void) | null>(null);
  // Onda 36 — pre-check de validação + routing antes do export. Mostra
  // dialog com errors estruturais, warnings, e layers que serão skipadas.
  // Não bloqueia — operador confirma "Exportar mesmo assim" pra continuar.
  // Onda 36+ (rodada 2): adicionado pre-check de fontes. Fontes que não
  // vetorizam aparecem como erro vermelho — operador escolhe cancelar ou
  // exportar mesmo assim (gerando placeholder XML como escape hatch).
  const [preCheck, setPreCheck] = useState<{
    open: boolean;
    errors: PatternIssue[];
    warnings: PatternIssue[];
    skips: RoutingSkipIssue[];
    fontIssues: FontIssue[];
  }>({ open: false, errors: [], warnings: [], skips: [], fontIssues: [] });

  const ioRef = useRef(makeTauriIO());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setNome(defaultStem ?? '');
    });
    getDefaultSvgFolder(ioRef.current)
      .then((f) => {
        if (!cancelled) setFolder(f);
      })
      .catch(() => {
        if (!cancelled) setFolder('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, defaultStem]);

  const stem = useMemo(() => buildStem(nome), [nome]);

  // Lista de filenames previstos pro UI mostrar antes do export. Em
  // single-chapa, mostramos só o template (não sabemos machineIds antes de
  // rodar o exporter). Em multi-chapa, também é template — chapas × <máquina>.
  const filenameTemplates = useMemo(() => {
    if (multiChapa) {
      return chapaInfos.map((c) => `${stem || 'prancha'}_${c.filenameToken}_<máquina>.svg`);
    }
    return [`${stem || 'prancha'}_<máquina>.svg`];
  }, [multiChapa, chapaInfos, stem]);

  function handleClose() {
    if (exporting) return;
    onClose();
  }

  /**
   * Bug-fix Onda 36+: agrupa erros de conversão de texto e mostra toast.error
   * persistente identificando as fontes problemáticas. Os arquivos já foram
   * gravados, então o operador precisa decidir o que fazer (re-cadastrar
   * fonte, vetorizar texto manualmente, etc). Critério explícito do briefing:
   * "Não aceitar export silencioso com apenas comentário XML".
   */
  function reportFontFailures(errors: Array<{ err: TextConversionError; text: string }>): void {
    const families = Array.from(new Set(errors.map((e) => e.err.fontFamily)));
    const kinds = Array.from(new Set(errors.map((e) => e.err.kind)));
    const texts = errors
      .slice(0, 3)
      .map((e) => `"${e.text}"`)
      .join(', ');
    const more = errors.length > 3 ? ` (+${errors.length - 3} mais)` : '';
    toast.error('Texto não vetorizado — arquivos saíram SEM texto', {
      description:
        `${errors.length} texto(s) ${texts}${more} ` +
        `falhou(falharam) em vetorizar. Fontes: ${families.join(', ')}. ` +
        `Motivo: ${kinds.join(', ')}. Cadastre a fonte ou vetorize manualmente antes de mandar pra produção.`,
      duration: 30000,
    });
  }

  async function handlePickFolder() {
    try {
      const picked = await openFolderPicker({ multiple: false, directory: true });
      if (typeof picked === 'string' && picked.length > 0) {
        setFolder(picked);
      }
    } catch (err) {
      console.error('[ExportSvgDialog] folder picker:', err);
      toast.error('Erro ao abrir seletor de pasta');
    }
  }

  async function handleExport() {
    const engine = getEngine();
    if (!engine || exporting) return;
    if (!folder) {
      toast.error('Escolha uma pasta de destino');
      return;
    }
    if (!boardDims) {
      toast.error('Prancha sem dimensões — adicione um broche antes de exportar.');
      return;
    }

    // Onda 36 — pre-check estrutural + routing.
    const baseLayersForPreCheck = Array.from(engine.getAllLayerMetas().values());
    const validation = validatePattern(baseLayersForPreCheck, {
      hasFabricObject: (id) => engine.getObjectById(id) !== null,
    });
    const skips = await detectRoutingSkips(engine, baseLayersForPreCheck);

    // Bug-fix Onda 36+ (rodada 2) — pre-check BLOQUEANTE de fontes. Roda
    // ANTES de gravar arquivos. Promove slot content temporariamente pro
    // varredor enxergar fabric.Text dos slots (que normalmente têm
    // excludeFromExport=true). Restore acontece automaticamente no finally
    // de withSlotContentExportable.
    const fontBufferLoaderForPreCheck = makeFontBufferLoader();
    const fontPrecheck = await withSlotContentExportable(
      engine.getSlotContentBodyPairs(),
      baseLayersForPreCheck,
      async () => precheckFonts(engine.canvas, fontBufferLoaderForPreCheck)
    );
    const fontIssues: FontIssue[] = fontPrecheck.issues.map((i: FontPrecheckIssue) => ({
      text: i.text,
      fontFamily: i.fontFamily,
      reasonKind: i.error.kind,
    }));

    if (
      validation.errors.length + validation.warnings.length + skips.length + fontIssues.length >
      0
    ) {
      setPreCheck({
        open: true,
        errors: validation.errors,
        warnings: validation.warnings,
        skips,
        fontIssues,
      });
      return;
    }

    void runExport();
  }

  /**
   * Onda 36 — chamado quando o operador confirma "Exportar mesmo assim".
   * Não re-roda o pre-check.
   */
  function handleConfirmExportWithIssues() {
    setPreCheck((p) => ({ ...p, open: false }));
    void runExport();
  }

  async function runExport() {
    const engine = getEngine();
    if (!engine || exporting) return;
    if (!folder || !boardDims) return;

    setExporting(true);
    try {
      const baseLayers = Array.from(engine.getAllLayerMetas().values());

      // Bug-fix Onda 36+: loader real de fontes pra opentype.js vetorizar
      // texto. SEM isto, svg-exporter cai em "Fase 9D legacy" e emite
      // `<!-- Texto pendente -->` (XML sem o texto). Erros de conversão são
      // COLETADOS aqui pra mostrar toast claro no fim — não passar
      // silenciosamente é critério de produção.
      const fontBufferLoader = makeFontBufferLoader();
      const textConversionErrors: Array<{ err: TextConversionError; text: string }> = [];
      const onTextConversionError = (err: TextConversionError, text: string) => {
        textConversionErrors.push({ err, text });
      };

      // Onda 35 — promove slot contents (texto/logo) a "exportáveis" só
      // durante este export. Promoter destrava excludeFromExport, injeta
      // id capi temporário, e adiciona LayerMeta sintética com
      // parentLayerId = id da AREA pai (que carrega processType+machineTargets).
      // PNG/serialize/canvas.toJSON continuam vendo o estado original.
      await withSlotContentExportable(
        engine.getSlotContentBodyPairs(),
        baseLayers,
        async ({ layers }) => {
          if (multiChapa) {
            // ── Fase C.3 — N SVGs por chapa ───────────────────────────────────
            const chapasDescriptors: BoardChapaDescriptor[] = chapaInfos.map((c) => ({
              chapaId: c.productId,
              filenameToken: c.filenameToken,
              bboxMm: c.bboxMm,
            }));

            const results = await exportBoardSvgByChapa({
              canvas: engine.canvas,
              layers,
              boardWidthMm: boardDims.widthMm,
              boardHeightMm: boardDims.heightMm,
              chapas: chapasDescriptors,
              assetLookup: makeAssetLookup(),
              fontBufferLoader,
              onTextConversionError,
            });

            if (results.length === 0) {
              toast.info('Nada pra exportar', {
                description:
                  'A prancha não tem elementos exportáveis (sem apliques, gravações ou marcações).',
              });
              return;
            }

            // Grava cada arquivo. Persiste folder e abre Explorer só na última.
            const savedFiles: string[] = [];
            const encoder = new TextEncoder();
            const io = ioRef.current;
            for (let i = 0; i < results.length; i++) {
              const r = results[i];
              const filename = `${stem}_${r.filenameToken}_${r.machineId}.svg`;
              const path = await io.joinPath(folder, filename);
              await io.writeFile(path, encoder.encode(r.svg));
              savedFiles.push(path);
            }

            // Fase C.4 — DXF por chapa (opcional).
            let dxfCount = 0;
            if (exportDxf) {
              const dxfResults = await exportBoardDxfByChapa({
                canvas: engine.canvas,
                layers,
                boardWidthMm: boardDims.widthMm,
                boardHeightMm: boardDims.heightMm,
                chapas: chapasDescriptors,
                assetLookup: makeAssetLookup(),
                fontBufferLoader,
              });
              for (const dr of dxfResults) {
                const filename = `${stem}_${dr.filenameToken}_${dr.machineId}_${dr.operation}.dxf`;
                const path = await io.joinPath(folder, filename);
                await io.writeFile(path, encoder.encode(dr.dxf));
                savedFiles.push(path);
              }
              dxfCount = dxfResults.length;
            }

            // Persiste última pasta (mesma chave que saveSvgs usa em single-chapa).
            try {
              await setSetting(SVG_EXPORT_LAST_FOLDER_KEY, folder);
            } catch (err) {
              console.warn(
                `[ExportSvgDialog] persist lastFolder falhou (não-fatal): ${String(err)}`
              );
            }
            // Abre Explorer só uma vez no final.
            try {
              await io.openFolder(folder);
            } catch (err) {
              console.warn(`[ExportSvgDialog] openFolder falhou (não-fatal): ${String(err)}`);
            }

            const svgCount = results.length;
            const summary =
              dxfCount > 0
                ? `${svgCount} SVG${svgCount === 1 ? '' : 's'} + ${dxfCount} DXF${dxfCount === 1 ? '' : 's'} salvos`
                : `${svgCount} SVG${svgCount === 1 ? '' : 's'} salvos`;
            // Bug-fix Onda 36+: AVISO BLOQUEANTE (visual, não-bloqueia file write
            // — arquivos já saíram). Critério: nenhuma falha de fonte pode passar
            // silenciosamente. Se houver, mostramos toast.error com lista das
            // fontes ausentes; toast.success some pra não confundir.
            if (textConversionErrors.length > 0) {
              reportFontFailures(textConversionErrors);
            } else {
              toast.success(summary, { description: `${chapaInfos.length} chapas` });
            }
            if (import.meta.env.DEV) console.info('[ExportSvgDialog] paths:', savedFiles);
            onClose();
            return;
          }

          // ── Single-chapa (legado) ───────────────────────────────────────────
          //
          // Onda 37 bug-fix: o `boardDims` vem do useBoardEngine, que reserva
          // `CHAPA_LABEL_HEIGHT_MM` (8mm) em cima da chapa pro label visual
          // ("Broches (N)"). Esses 8mm ficam dentro do bbox do canvas mas NÃO
          // pertencem ao SVG técnico — produto 60×25 sairia como 60×33 com
          // faixa vazia em y=0..8. Multi-chapa já faz esse ajuste via
          // `buildChapaExportInfos`; aqui replicamos pra single-chapa:
          //   - technicalHeightMm = boardDims.heightMm - 8mm  (altura real)
          //   - contentOffsetMm.yMm = 8mm                    (translate negativo)
          // O conteúdo do canvas (aplique posicionado em y=8 px*4=32px) é
          // deslocado pra começar em y=0 no viewBox final.
          const technicalHeightMm = Math.max(0, boardDims.heightMm - CHAPA_LABEL_HEIGHT_MM);
          const contentOffsetMm = { xMm: 0, yMm: CHAPA_LABEL_HEIGHT_MM };

          const byMachine = await exportSvgByMachine(engine.canvas, {
            productWidthMm: boardDims.widthMm,
            productHeightMm: technicalHeightMm,
            layers,
            assetLookup: makeAssetLookup(),
            fontBufferLoader,
            onTextConversionError,
            contentOffsetMm,
          });

          if (byMachine.size === 0) {
            toast.info('Nada pra exportar', {
              description:
                'A prancha não tem elementos exportáveis (sem apliques, gravações ou marcações).',
            });
            return;
          }

          const result = await saveSvgs(ioRef.current, {
            byMachine,
            folder,
            filenameStem: stem,
            // Se vamos salvar DXF (v1 ou v2) também, abre Explorer só no último.
            openFolderAfter: !exportDxf && !exportDxfV2,
          });

          const savedFiles: string[] = [...result.paths];
          let dxfCount = 0;
          let dxfV2Count = 0;
          if (exportDxf) {
            // Onda 37 bug-fix — mesma correção do SVG single-chapa, mas DXF já
            // tem `clipBoundsMm` que faz o trabalho: subtrai offset e usa a
            // altura da chapa pro flipY. A região técnica é (0, label, width, h-label).
            const byBucket = await exportDxfByMachineAndOperation(engine.canvas, {
              productWidthMm: boardDims.widthMm,
              productHeightMm: technicalHeightMm,
              layers,
              assetLookup: makeAssetLookup(),
              fontBufferLoader,
              clipBoundsMm: {
                leftMm: 0,
                topMm: CHAPA_LABEL_HEIGHT_MM,
                widthMm: boardDims.widthMm,
                heightMm: technicalHeightMm,
              },
            });
            if (byBucket.size > 0) {
              const dxfResult = await saveDxfs(ioRef.current, {
                byBucket,
                folder,
                filenameStem: stem,
                // Abre Explorer apenas no fim do export inteiro.
                openFolderAfter: !exportDxfV2,
              });
              savedFiles.push(...dxfResult.paths);
              dxfCount = dxfResult.paths.length;
            }
          }

          if (exportDxfV2) {
            // DXF-4 — caminho paralelo AC1032/SPLINE. Mesmas opts do legado
            // (technicalHeightMm + contentOffsetMm) — exporter v2 NÃO suporta
            // clipBoundsMm ainda (DXF-3.5). O onTextConversionError converge no
            // mesmo array `textConversionErrors`, então erros de fonte do v2
            // somam aos do SVG e geram um único toast no fim.
            //
            // DXF-PRODUCTION-ALIGNMENT: quando debugDxfV2 está ativo, o exporter
            // popula um DxfDebugReport via debugSink. Abrimos o painel ANTES de
            // gravar; se operador cancelar, nada vai pra disk.
            let collectedReport: DxfDebugReport | null = null;
            const byBucketV2 = await exportDxfV2ByMachineAndOperation(engine.canvas, {
              productWidthMm: boardDims.widthMm,
              productHeightMm: technicalHeightMm,
              layers,
              assetLookup: makeAssetLookup(),
              fontBufferLoader,
              contentOffsetMm,
              onTextConversionError,
              debugSink: debugDxfV2
                ? (r) => {
                    collectedReport = r;
                  }
                : undefined,
            });

            if (debugDxfV2 && collectedReport) {
              // Mostra painel e aguarda confirmação. Se cancelar, pula gravação.
              const proceed = await new Promise<boolean>((resolve) => {
                pendingDebugResolverRef.current = resolve;
                setPendingDebugReport(collectedReport);
              });
              setPendingDebugReport(null);
              pendingDebugResolverRef.current = null;
              if (!proceed) {
                toast.info('Export DXF v2 cancelado (modo debug)');
                // Não grava nada do v2. Os outros já gravaram (SVG/v1). Sai cedo
                // do bloco v2 mas continua o resumo geral.
                // dxfV2Count permanece 0.
              } else if (byBucketV2.size > 0) {
                const dxfV2Result = await saveDxfsV2(ioRef.current, {
                  byBucket: byBucketV2,
                  folder,
                  filenameStem: stem,
                  openFolderAfter: true,
                });
                savedFiles.push(...dxfV2Result.paths);
                dxfV2Count = dxfV2Result.paths.length;
              }
            } else if (byBucketV2.size > 0) {
              // Caminho normal (sem debug): grava direto.
              const dxfV2Result = await saveDxfsV2(ioRef.current, {
                byBucket: byBucketV2,
                folder,
                filenameStem: stem,
                // Este é o último export do fluxo single-chapa — abre Explorer aqui.
                openFolderAfter: true,
              });
              savedFiles.push(...dxfV2Result.paths);
              dxfV2Count = dxfV2Result.paths.length;
            }
          }

          const svgCount = result.paths.length;
          const parts: string[] = [`${svgCount} SVG${svgCount === 1 ? '' : 's'}`];
          if (dxfCount > 0) parts.push(`${dxfCount} DXF${dxfCount === 1 ? '' : 's'}`);
          if (dxfV2Count > 0) parts.push(`${dxfV2Count} DXF v2`);
          const summary = `${parts.join(' + ')} salvos`;
          const machineList = Array.from(byMachine.keys()).join(', ');
          // Bug-fix Onda 36+: ver comentário do branch multi-chapa.
          if (textConversionErrors.length > 0) {
            reportFontFailures(textConversionErrors);
          } else {
            toast.success(summary, { description: machineList });
          }
          if (import.meta.env.DEV) console.info('[ExportSvgDialog] paths:', savedFiles);
          onClose();
        }
      ); // ← fecha withSlotContentExportable
    } catch (err) {
      console.error('[ExportSvgDialog] export error:', err);
      toast.error(`Erro ao exportar: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className={`border-ink-700 bg-ink-900 text-ink-100 ${multiChapa ? 'sm:max-w-xl' : 'sm:max-w-md'}`}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            {multiChapa
              ? `Exportar SVG por chapa (${chapaInfos.length} chapas)`
              : 'Exportar SVG da prancha'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="svg-nome" className="text-xs text-ink-400">
              Nome do arquivo (prefixo)
            </Label>
            <Input
              id="svg-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="prancha"
              className="border-ink-700 bg-ink-800 text-ink-100 focus-visible:ring-laser-muted"
              autoFocus
              disabled={exporting}
            />
          </div>

          {boardDims && !multiChapa && (
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-400">Prancha</Label>
              <p className="font-mono text-[11px] tabular-nums text-ink-200">
                {boardDims.widthMm.toFixed(0)}×{boardDims.heightMm.toFixed(0)} mm
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-ink-400">
              {multiChapa
                ? `Arquivos previstos (${filenameTemplates.length} chapas × N máquinas)`
                : 'Arquivo'}
            </Label>
            <ul className="space-y-0.5 rounded border border-ink-700 bg-ink-800/40 p-2">
              {filenameTemplates.map((tpl, i) => (
                <li
                  key={multiChapa ? chapaInfos[i].productId : i}
                  className="font-mono text-[11px] text-ink-200 break-all"
                >
                  {tpl}
                </li>
              ))}
            </ul>
            {multiChapa && (
              <p className="text-[10px] text-ink-500">
                &lt;máquina&gt; vira <span className="font-mono">fiber-laser</span>,{' '}
                <span className="font-mono">master-biro</span>, etc — 1 arquivo por máquina
                envolvida em cada chapa.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-ink-400">Pasta</Label>
            <div className="flex items-center gap-2">
              <p className="flex-1 font-mono text-[11px] text-ink-200 break-all">
                {folder || <span className="text-ink-500">— nenhuma pasta selecionada —</span>}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handlePickFolder()}
                disabled={exporting}
                className="text-[11px]"
              >
                Escolher…
              </Button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded border border-ink-700 bg-ink-800/40 p-2.5 transition-colors hover:bg-ink-800/70">
            <input
              type="checkbox"
              checked={exportDxf}
              onChange={(e) => setExportDxf(e.target.checked)}
              disabled={exporting}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-laser-muted"
            />
            <div className="flex-1">
              <span className="block text-xs text-ink-200">Também exportar DXF (legacy)</span>
              <span className="block font-mono text-[10px] text-ink-500">
                +{' '}
                <span className="text-ink-300">
                  {multiChapa
                    ? `${stem || 'prancha'}_<chapa>_<máquina>_<operação>.dxf`
                    : `${stem || 'prancha'}_<máquina>_<operação>.dxf`}
                </span>{' '}
                · R12/POLYLINE (legacy)
              </span>
            </div>
          </label>

          <label
            className={`flex items-start gap-2 rounded border border-ink-700 bg-ink-800/40 p-2.5 transition-colors ${
              multiChapa ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-ink-800/70'
            }`}
            title={multiChapa ? 'Multi-chapa em DXF v2 chega em DXF-3.5' : undefined}
          >
            <input
              type="checkbox"
              checked={exportDxfV2 && !multiChapa}
              onChange={(e) => setExportDxfV2(e.target.checked)}
              disabled={exporting || multiChapa}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-laser-muted"
            />
            <div className="flex-1">
              <span className="block text-xs text-ink-200">
                DXF v2 (AC1032/SPLINE — RDWorks recomendado)
              </span>
              <span className="block font-mono text-[10px] text-ink-500">
                +{' '}
                <span className="text-ink-300">
                  {`${stem || 'prancha'}_<máquina>_<operação>_v2.dxf`}
                </span>{' '}
                · AC1032/SPLINE (novo formato)
                {multiChapa && ' · indisponível em multi-chapa'}
              </span>
            </div>
          </label>

          {/* DXF-PRODUCTION-ALIGNMENT — debug toggle do v2 */}
          <label
            className={`ml-6 flex items-start gap-2 rounded border border-ink-800 bg-ink-900/30 p-2 transition-colors ${
              !exportDxfV2 || multiChapa
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer hover:bg-ink-800/50'
            }`}
          >
            <input
              type="checkbox"
              checked={debugDxfV2 && exportDxfV2 && !multiChapa}
              onChange={(e) => setDebugDxfV2(e.target.checked)}
              disabled={exporting || !exportDxfV2 || multiChapa}
              className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-laser-muted"
            />
            <div className="flex-1">
              <span className="block text-xs text-ink-200">
                🔍 Debug DXF v2 (inspecionar antes de gravar)
              </span>
              <span className="block font-mono text-[10px] text-ink-500">
                Abre painel com bbox/transforms/splines por objeto. Você confirma ou cancela antes
                de salvar.
              </span>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={exporting}
            className="text-ink-400 hover:text-ink-100"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => void handleExport()}
            disabled={!folder || exporting || !boardDims}
            className="bg-ink-700 text-ink-100 hover:bg-ink-600"
          >
            {exporting
              ? 'Exportando…'
              : multiChapa
                ? `Exportar SVGs (${chapaInfos.length} chapas)`
                : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Onda 36 — pre-check de validação + routing antes do export.
          Onda 36+ rodada 2: também recebe fontIssues do pre-check de fontes. */}
      <PatternValidationDialog
        open={preCheck.open}
        mode="confirm-export"
        errors={preCheck.errors}
        warnings={preCheck.warnings}
        routingSkips={preCheck.skips}
        fontIssues={preCheck.fontIssues}
        onCancel={() => setPreCheck((p) => ({ ...p, open: false }))}
        onConfirm={handleConfirmExportWithIssues}
        busy={exporting}
      />

      {/* DXF-PRODUCTION-ALIGNMENT — painel debug entre coleta e gravação. */}
      <DxfDebugPanel
        open={pendingDebugReport !== null}
        report={pendingDebugReport}
        onClose={() => {
          // Cancelar fecha sem gravar.
          pendingDebugResolverRef.current?.(false);
        }}
        onContinueExport={() => {
          pendingDebugResolverRef.current?.(true);
        }}
      />
    </Dialog>
  );
}

/**
 * Onda 36 — pre-check de routing: simula o que o exporter faria pra cada
 * layer e retorna as que viriam como "sem rota" (warn+skip no exporter).
 * Patterns antigos cujas layers têm engravingId/appliqueId válidos passam
 * normal; layers Onda 33 incompletas E sem asset cadastrado aparecem aqui.
 *
 * Não consulta canvas Fabric — opera puramente sobre LayerMeta + lookup.
 */
async function detectRoutingSkips(
  engine: CanvasEngine,
  layers: LayerMetaForSkip[]
): Promise<RoutingSkipIssue[]> {
  void engine; // reservado para futuro uso (ex: ignorar layers invisíveis)
  const lookup = makeAssetLookup();
  const skips: RoutingSkipIssue[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue; // layer oculta nunca exporta — sem skip a reportar
    if (layer.kind === 'operation') continue; // sem objeto Fabric próprio
    try {
      const res = await resolveLayerRouting(layer, lookup, 'export-pre-check');
      if (!res.routing) {
        skips.push({
          layerId: layer.id,
          layerName: layer.name || '(sem nome)',
          code: 'ROUTING_SKIP',
          severity: 'warning',
          message: res.reason
            ? `Será ignorada no export — ${res.reason}.`
            : 'Será ignorada no export.',
        });
      }
    } catch (err) {
      // Asset id resolvível mas lookup retorna null → throw do resolver.
      // No pre-check viramos warning (operador já vai ver o erro real durante
      // o export se confirmar; aqui só sinalizamos).
      skips.push({
        layerId: layer.id,
        layerName: layer.name || '(sem nome)',
        code: 'ROUTING_SKIP',
        severity: 'warning',
        message: `Routing inconsistente — ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return skips;
}

/**
 * Shape mínimo de LayerMeta usado por `detectRoutingSkips`. Evita coupling
 * direto com o type union — o caller passa `Array.from(engine.getAllLayerMetas().values())`.
 */
type LayerMetaForSkip = Parameters<typeof resolveLayerRouting>[0];
