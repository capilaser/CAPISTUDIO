/**
 * ExportPngDialog — Onda 9.F + Onda 17 (mockup profissional)
 *
 * Modal pra exportar PNG mockup do canvas pro cliente. Lê cliente/profissão
 * dos slots, gera nome de arquivo em tempo real (com data + lote), escolhe
 * pasta (com default persistido em settings), mostra preview thumbnail,
 * exporta via png-exporter com fundo cinza + sombra, salva via Tauri fs,
 * abre Explorer.
 *
 * Onda 17:
 *   - Preview ~300px do mockup antes de exportar (debounce 200ms)
 *   - Background `#F4F4F2` + sombra difusa em principals
 *   - Recorte por `boardBounds` (caller informa bbox dos broches)
 *   - Nome de arquivo com data ISO + prefixo `lote_Nx_` quando multi
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { open as openFolderPicker } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import type { ChapaExportInfo } from '@/core/export/chapa-export-info';
import { exportPngMockup, type PngBoundingBoxPx } from '@/core/export/png-exporter';
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

/** Margem em mm (briefing Onda 17, ajustada pós-validação pra 3mm — foco no produto). */
const MOCKUP_MARGIN_MM = 3;
/** Cor de fundo do mockup (briefing Onda 17). */
const MOCKUP_BACKGROUND = '#F4F4F2';
/** DPI usado pro preview do dialog — leve, suficiente pra thumbnail. */
const PREVIEW_DPI = 72;
/** DPI do export final — qualidade de impressão. */
const EXPORT_DPI = 300;
/** MM_TO_PX = 4 (canvas Fabric usa 4 px/mm em units.ts). */
const MM_TO_PX = 4;

interface ExportPngDialogProps {
  open: boolean;
  /**
   * Getter pra engine — chamado no momento que precisamos (não durante
   * render do parent). Padrão herdado do SaveAsPatternDialog.getCanvasJson.
   */
  getEngine: () => CanvasEngine | null;
  onClose: () => void;
  /**
   * Onda 17 — bounding box dos broches em px do canvas Fabric. Quando
   * informado, o export é recortado nessa região + margem (cinza ao redor).
   * Sem informar (CanvasTest, single broche legado), exporta viewport
   * inteiro com fundo cinza ainda assim.
   */
  boardBounds?: PngBoundingBoxPx | null;
  /**
   * Onda 17 — quantos broches estão na prancha. Quando >1, filename ganha
   * prefixo `lote_Nx_`. Default 1.
   */
  boardItemCount?: number;
  /**
   * Onda 27 (Fase C) — chapas do pedido. Quando 2+, o dialog gera N PNGs
   * (um por chapa), cada um com filename ganhando o token da chapa. Quando
   * 0 ou 1, comportamento legado: 1 arquivo único (`boardBounds` clipa).
   */
  chapaInfos?: ChapaExportInfo[];
}

/** Lê o texto do PRIMEIRO slot do tipo dado. Retorna '' se não houver. */
function readSlotText(engine: CanvasEngine | null, type: 'nome' | 'profissao'): string {
  if (!engine) return '';
  const slots = engine.getSlotsByType(type);
  if (slots.length === 0) return '';
  return engine.getSlotText(slots[0].id) ?? '';
}

/** Converte mm → px no espaço do canvas Fabric. */
function mmToCanvasPx(mm: number): number {
  return mm * MM_TO_PX;
}

export function ExportPngDialog({
  open,
  getEngine,
  onClose,
  boardBounds = null,
  boardItemCount = 1,
  chapaInfos = [],
}: ExportPngDialogProps) {
  // Onda 27 — se há 2+ chapas, exportamos por chapa. Senão, comportamento
  // legado (1 arquivo único com clientBounds = boardBounds).
  const multiChapa = chapaInfos.length >= 2;
  const [cliente, setCliente] = useState('');
  const [profissao, setProfissao] = useState('');
  const [folder, setFolder] = useState('');
  const [exporting, setExporting] = useState(false);

  // Onda 17 — preview do mockup.
  // Onda 27 — em multi-chapa, mantemos N preview URLs (paralelo a chapaInfos).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Array<string | null>>([]);

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
  // Onda 17 — inclui data (now) + prefixo lote_Nx_ quando aplicável.
  // Onda 27 — em multi-chapa: gera 1 nome por chapa com chapaToken no infixo.
  const filename = useMemo(
    () => buildPngFilename({ cliente, profissao, boardItemCount }),
    [cliente, profissao, boardItemCount]
  );
  const filenamesByChapa = useMemo(
    () =>
      multiChapa
        ? chapaInfos.map((c) => ({
            chapa: c,
            filename: buildPngFilename({
              cliente,
              profissao,
              boardItemCount,
              chapaToken: c.filenameToken,
            }),
          }))
        : [],
    [multiChapa, chapaInfos, cliente, profissao, boardItemCount]
  );

  // ── Onda 17 — Preview thumbnail ─────────────────────────────────────────
  // Debounce de 200ms pra evitar gerar preview a cada keystroke. A imagem
  // não depende do texto digitado, mas depende do estado do canvas — que
  // pode mudar antes do dialog abrir. Regeneramos uma vez quando abre +
  // sempre que `boardBounds` muda.
  useEffect(() => {
    if (!open) {
      // Limpa preview anterior ao fechar pra não vazar blob URL.
      // Promise.resolve() pra fugir do warning react-hooks/set-state-in-effect.
      void Promise.resolve().then(() => {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setPreviewUrls((prev) => {
          for (const u of prev) if (u) URL.revokeObjectURL(u);
          return [];
        });
      });
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      const engine = getEngine();
      if (!engine) return;

      setPreviewLoading(true);
      void (async () => {
        try {
          const layers = Array.from(engine.getAllLayerMetas().values());
          const marginPx = mmToCanvasPx(MOCKUP_MARGIN_MM);

          if (multiChapa) {
            // Onda 27 — gera 1 preview por chapa (clientBounds da chapa).
            const urls: Array<string | null> = [];
            for (const info of chapaInfos) {
              try {
                const bytes = await exportPngMockup(engine.canvas, {
                  layers,
                  dpi: PREVIEW_DPI,
                  backgroundColor: MOCKUP_BACKGROUND,
                  shadow: true,
                  marginPx,
                  clientBounds: info.bboxPx,
                });
                if (cancelled) return;
                const blob = new Blob([bytes], { type: 'image/png' });
                urls.push(URL.createObjectURL(blob));
              } catch {
                urls.push(null);
              }
            }
            setPreviewUrls((prev) => {
              for (const u of prev) if (u) URL.revokeObjectURL(u);
              return urls;
            });
          } else {
            const bytes = await exportPngMockup(engine.canvas, {
              layers,
              dpi: PREVIEW_DPI,
              backgroundColor: MOCKUP_BACKGROUND,
              shadow: true,
              marginPx,
              clientBounds: boardBounds ?? undefined,
            });
            if (cancelled) return;
            const blob = new Blob([bytes], { type: 'image/png' });
            const url = URL.createObjectURL(blob);
            setPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return url;
            });
          }
        } catch (err) {
          if (!cancelled && import.meta.env.DEV) {
            console.warn('[ExportPngDialog] preview falhou:', err);
          }
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, getEngine, boardBounds, multiChapa, chapaInfos]);

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
      const marginPx = mmToCanvasPx(MOCKUP_MARGIN_MM);

      if (multiChapa) {
        // Onda 27 — exporta N PNGs, um por chapa. openFolder só na ÚLTIMA
        // chamada pra evitar abrir N Explorers. lastFolder persiste só na
        // primeira (idempotente, mas só uma escrita é suficiente).
        for (let i = 0; i < filenamesByChapa.length; i++) {
          const { chapa, filename: chapaFilename } = filenamesByChapa[i];
          const bytes = await exportPngMockup(engine.canvas, {
            layers,
            dpi: EXPORT_DPI,
            backgroundColor: MOCKUP_BACKGROUND,
            shadow: true,
            marginPx,
            clientBounds: chapa.bboxPx,
          });
          await savePng(ioRef.current, {
            bytes,
            folder,
            filename: chapaFilename,
            openFolderAfter: i === filenamesByChapa.length - 1,
            rememberFolder: i === 0,
          });
        }
        toast.success(`${filenamesByChapa.length} PNGs salvos em ${folder}`);
      } else {
        const bytes = await exportPngMockup(engine.canvas, {
          layers,
          dpi: EXPORT_DPI,
          backgroundColor: MOCKUP_BACKGROUND,
          shadow: true,
          marginPx,
          clientBounds: boardBounds ?? undefined,
        });
        const result = await savePng(ioRef.current, { bytes, folder, filename });
        toast.success(`PNG salvo: ${filename}`);
        if (import.meta.env.DEV) console.info('[ExportPngDialog] saved at', result.path);
      }

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
      <DialogContent
        className={`border-ink-700 bg-ink-900 text-ink-100 ${multiChapa ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
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

          {/* Onda 17 — Preview thumbnail (~300px wide, altura flexível). */}
          {/* Onda 27 — multi-chapa: N previews lado-a-lado. */}
          <div className="space-y-1.5">
            <Label className="text-xs text-ink-400">
              {multiChapa ? `Previews (${chapaInfos.length} chapas)` : 'Preview'}
            </Label>
            <div className="flex h-[180px] items-center justify-center gap-2 overflow-hidden rounded border border-ink-700 bg-ink-950 p-2">
              {multiChapa ? (
                previewLoading && previewUrls.length === 0 ? (
                  <p className="animate-pulse text-[10px] text-ink-500">Gerando previews…</p>
                ) : previewUrls.length > 0 ? (
                  previewUrls.map((url, i) => (
                    <div
                      key={chapaInfos[i]?.productId ?? i}
                      className="flex h-full flex-1 flex-col items-center justify-center gap-1"
                    >
                      {url ? (
                        <img
                          src={url}
                          alt={`Preview ${chapaInfos[i]?.displayLabel ?? i}`}
                          className="max-h-[140px] max-w-full object-contain"
                        />
                      ) : (
                        <p className="text-[10px] text-ink-500">— erro —</p>
                      )}
                      <span className="truncate text-[9px] text-ink-400">
                        {chapaInfos[i]?.displayLabel ?? ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-ink-500">— sem preview —</p>
                )
              ) : previewLoading && !previewUrl ? (
                <p className="animate-pulse text-[10px] text-ink-500">Gerando preview…</p>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview do mockup"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-[10px] text-ink-500">— sem preview —</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-ink-400">
              {multiChapa ? `Arquivos (${filenamesByChapa.length})` : 'Arquivo'}
            </Label>
            {multiChapa ? (
              <ul className="space-y-0.5">
                {filenamesByChapa.map(({ chapa, filename: fname }) => (
                  <li
                    key={chapa.productId}
                    className="font-mono text-[11px] text-ink-200 break-all"
                  >
                    {fname}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-[11px] text-ink-200 break-all">{filename}</p>
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
            {exporting
              ? 'Exportando…'
              : multiChapa
                ? `Exportar ${filenamesByChapa.length} PNGs`
                : 'Exportar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
