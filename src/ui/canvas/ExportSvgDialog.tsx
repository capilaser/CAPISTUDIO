/**
 * ExportSvgDialog — Onda 13.6
 *
 * Modal pra exportar SVG da prancha (1 arquivo por máquina) pra alimentar
 * o software de corte/gravação. Análogo ao ExportPngDialog, mas:
 *
 *   - Chama svg-exporter direto no canvas vivo (que já é a prancha inteira)
 *   - Salva N arquivos (1 por máquina envolvida)
 *   - Nome do arquivo: `${stem}_${machineId}.svg`
 *
 * Como o canvas-engine atual é UM canvas com todos os broches empilhados,
 * NÃO usamos o board-exporter (que orquestraria N canvases). O canvas já
 * tem tudo posicionado, então svg-exporter direto basta.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openFolderPicker } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { exportDxfByMachineAndOperation } from '@/core/export/dxf-exporter';
import { exportSvgByMachine } from '@/core/export/svg-exporter';
import { normalizeAssetName } from '@/lib/normalize-asset-name';
import { makeAssetLookup } from '@/services/asset-lookup';
import { saveDxfs } from '@/services/dxf-export-service';
import { getDefaultSvgFolder, saveSvgs } from '@/services/svg-export-service';
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
  onClose,
}: ExportSvgDialogProps) {
  const [nome, setNome] = useState('');
  const [folder, setFolder] = useState('');
  const [exporting, setExporting] = useState(false);
  // Onda 18: checkbox "Também exportar DXF" — default OFF.
  // Quando ON, gera arquivos extras `${stem}_${machineId}_${op}.dxf` na mesma pasta.
  // Pasta DXF tem setting própria (export.dxf.lastFolder); aqui priorizamos a
  // mesma pasta do SVG pra simplificar o fluxo do operador.
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

  // Preview do nome do primeiro arquivo (placeholder se sem stem).
  const previewFilename = `${stem || 'prancha'}_<máquina>.svg`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border-ink-700 bg-ink-900 text-ink-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Exportar SVG da prancha
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
            <p className="text-[10px] text-ink-500">
              Será gerado: <span className="font-mono text-ink-300">{previewFilename}</span>
            </p>
          </div>

          {boardDims && (
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-400">Prancha</Label>
              <p className="font-mono text-[11px] tabular-nums text-ink-200">
                {boardDims.widthMm.toFixed(0)}×{boardDims.heightMm.toFixed(0)} mm
              </p>
            </div>
          )}

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
                  {stem || 'prancha'}_&lt;máquina&gt;_&lt;operação&gt;.dxf
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
            {exporting ? 'Exportando…' : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
