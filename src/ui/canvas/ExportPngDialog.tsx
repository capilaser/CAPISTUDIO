/**
 * ExportPngDialog — Onda 9.F
 *
 * Modal pra exportar PNG mockup do canvas pro cliente. Lê cliente/profissão
 * dos slots, gera nome de arquivo em tempo real, escolhe pasta (com default
 * persistido em settings), exporta via png-exporter, salva via Tauri fs,
 * abre Explorer.
 *
 * Não tem UI de aprovação de pedido nem botão SVG produção (Onda 11).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openFolderPicker } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { exportPngMockup } from '@/core/export/png-exporter';
import { buildPngFilename, getDefaultExportFolder, savePng } from '@/services/png-export-service';
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

interface ExportPngDialogProps {
  open: boolean;
  /**
   * Getter pra engine — chamado no momento que precisamos (não durante
   * render do parent). Padrão herdado do SaveAsPatternDialog.getCanvasJson.
   */
  getEngine: () => CanvasEngine | null;
  onClose: () => void;
}

/** Lê o texto do PRIMEIRO slot do tipo dado. Retorna '' se não houver. */
function readSlotText(engine: CanvasEngine | null, type: 'nome' | 'profissao'): string {
  if (!engine) return '';
  const slots = engine.getSlotsByType(type);
  if (slots.length === 0) return '';
  return engine.getSlotText(slots[0].id) ?? '';
}

export function ExportPngDialog({ open, getEngine, onClose }: ExportPngDialogProps) {
  const [cliente, setCliente] = useState('');
  const [profissao, setProfissao] = useState('');
  const [folder, setFolder] = useState('');
  const [exporting, setExporting] = useState(false);

  // io é estável durante o ciclo de vida do dialog. useRef evita criar
  // adapter novo em todo render.
  const ioRef = useRef(makeTauriIO());

  // Quando abre: pré-preenche cliente/profissão dos slots, carrega pasta default.
  // Usa Promise.resolve() pra deslocar o setState pra microtask, evitando o
  // "Calling setState synchronously within an effect can trigger cascading renders".
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const engine = getEngine();
      setCliente(readSlotText(engine, 'nome'));
      setProfissao(readSlotText(engine, 'profissao'));
    });

    getDefaultExportFolder(ioRef.current)
      .then((f) => {
        if (!cancelled) setFolder(f);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('[ExportPngDialog] default folder:', err);
        if (!cancelled) setFolder('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, getEngine]);

  // Nome do arquivo gerado em tempo real conforme digita.
  const filename = useMemo(() => buildPngFilename({ cliente, profissao }), [cliente, profissao]);

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
      console.error('[ExportPngDialog] folder picker:', err);
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

    setExporting(true);
    try {
      const layers = Array.from(engine.getAllLayerMetas().values());
      const bytes = await exportPngMockup(engine.canvas, {
        layers,
        backgroundColor: '#ffffff',
      });

      const result = await savePng(ioRef.current, {
        bytes,
        folder,
        filename,
      });

      toast.success(`PNG salvo: ${filename}`);
      if (import.meta.env.DEV) console.info('[ExportPngDialog] saved at', result.path);
      onClose();
    } catch (err) {
      console.error('[ExportPngDialog] export error:', err);
      toast.error(`Erro ao exportar: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border-ink-700 bg-ink-900 text-ink-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-sm font-medium text-ink-100">
            Exportar PNG mockup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="export-cliente" className="text-xs text-ink-400">
              Cliente
            </Label>
            <Input
              id="export-cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              className="border-ink-700 bg-ink-800 text-ink-100 focus-visible:ring-laser-muted"
              autoFocus
              disabled={exporting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="export-profissao" className="text-xs text-ink-400">
              Profissão
            </Label>
            <Input
              id="export-profissao"
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
              placeholder="Ex: Advogado"
              className="border-ink-700 bg-ink-800 text-ink-100 focus-visible:ring-laser-muted"
              disabled={exporting}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-ink-400">Arquivo</Label>
            <p className="font-mono text-[11px] text-ink-200 break-all">{filename}</p>
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
                className="font-mono text-[11px]"
              >
                Escolher…
              </Button>
            </div>
          </div>
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
            disabled={!folder || exporting}
            className="bg-ink-700 text-ink-100 hover:bg-ink-600"
          >
            {exporting ? 'Exportando…' : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
