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
import type { ChapaExportInfo } from '@/core/export/chapa-export-info';
import { exportDxfByMachineAndOperation } from '@/core/export/dxf-exporter';
import { exportSvgByMachine } from '@/core/export/svg-exporter';
import { setSetting } from '@/data/repositories/settingsRepository';
import { normalizeAssetName } from '@/lib/normalize-asset-name';
import { makeAssetLookup } from '@/services/asset-lookup';
import { saveDxfs } from '@/services/dxf-export-service';
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

    setExporting(true);
    try {
      const layers = Array.from(engine.getAllLayerMetas().values());

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
          console.warn(`[ExportSvgDialog] persist lastFolder falhou (não-fatal): ${String(err)}`);
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
        toast.success(summary, { description: `${chapaInfos.length} chapas` });
        if (import.meta.env.DEV) console.info('[ExportSvgDialog] paths:', savedFiles);
        onClose();
        return;
      }

      // ── Single-chapa (legado) ───────────────────────────────────────────
      const byMachine = await exportSvgByMachine(engine.canvas, {
        productWidthMm: boardDims.widthMm,
        productHeightMm: boardDims.heightMm,
        layers,
        assetLookup: makeAssetLookup(),
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
        openFolderAfter: !exportDxf, // se vamos salvar DXF também, abre Explorer só no fim
      });

      const savedFiles: string[] = [...result.paths];
      let dxfCount = 0;
      if (exportDxf) {
        const byBucket = await exportDxfByMachineAndOperation(engine.canvas, {
          productWidthMm: boardDims.widthMm,
          productHeightMm: boardDims.heightMm,
          layers,
          assetLookup: makeAssetLookup(),
        });
        if (byBucket.size > 0) {
          const dxfResult = await saveDxfs(ioRef.current, {
            byBucket,
            folder,
            filenameStem: stem,
          });
          savedFiles.push(...dxfResult.paths);
          dxfCount = dxfResult.paths.length;
        }
      }

      const svgCount = result.paths.length;
      const summary =
        dxfCount > 0
          ? `${svgCount} SVG${svgCount === 1 ? '' : 's'} + ${dxfCount} DXF${dxfCount === 1 ? '' : 's'} salvos`
          : `${svgCount} SVG${svgCount === 1 ? '' : 's'} salvos`;
      const machineList = Array.from(byMachine.keys()).join(', ');
      toast.success(summary, { description: machineList });
      if (import.meta.env.DEV) console.info('[ExportSvgDialog] paths:', savedFiles);
      onClose();
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
              <span className="block text-xs text-ink-200">Também exportar DXF</span>
              <span className="block font-mono text-[10px] text-ink-500">
                +{' '}
                <span className="text-ink-300">
                  {multiChapa
                    ? `${stem || 'prancha'}_<chapa>_<máquina>_<operação>.dxf`
                    : `${stem || 'prancha'}_<máquina>_<operação>.dxf`}
                </span>{' '}
                · R12 (RDWorks/LaserCAD)
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
    </Dialog>
  );
}
