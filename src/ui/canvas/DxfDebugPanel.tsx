/**
 * DxfDebugPanel — Painel visual de telemetria geométrica do export DXF.
 *
 * Sub-onda DXF-PRODUCTION-ALIGNMENT.
 *
 * Consome um `DxfDebugReport` (gerado por exportDxfV2ByMachineAndOperation
 * com `debugSink`) e renderiza tabela expansível por objeto mostrando:
 *
 *   - Contexto global: product, contentOffsetMm, frame, canvas bbox, DXF bbox
 *   - Por objeto: 8 etapas do pipeline com bbox e métricas
 *   - Botão "Copiar JSON" para colar em issue/diagnóstico
 *
 * Não grava arquivo nenhum. É apenas inspeção.
 */
import { useState } from 'react';
import { toast } from 'sonner';

import type {
  DebugBbox,
  DebugObjectSnapshot,
  DxfDebugReport,
} from '@/core/export/dxf-debug-report';
import { Button } from '@/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/components/dialog';

interface DxfDebugPanelProps {
  open: boolean;
  report: DxfDebugReport | null;
  onClose: () => void;
  /** Se informado, mostra botão "Continuar export" que dispara este callback. */
  onContinueExport?: () => void;
}

function fmt(n: number, decimals = 3): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals);
}

function bboxStr(b: DebugBbox | null, unit: string): string {
  if (!b) return '—';
  return (
    `(${fmt(b.minX)}, ${fmt(b.minY)}) → (${fmt(b.maxX)}, ${fmt(b.maxY)}) ${unit}\n` +
    `   width=${fmt(b.width)} ${unit}  height=${fmt(b.height)} ${unit}`
  );
}

function ObjectRow({ snap, index }: { snap: DebugObjectSnapshot; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded border border-ink-700 bg-ink-900/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ink-800/50"
      >
        <div className="flex items-center gap-3 text-xs">
          <span className="font-mono text-ink-500">#{index}</span>
          <span className="text-ink-100">{snap.name}</span>
          <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
            {snap.fabricType}
          </span>
          <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-laser-muted">
            {snap.operation}
          </span>
          {snap.textContent && (
            <span className="font-mono text-[10px] text-ink-300">
              "{snap.textContent.slice(0, 30)}
              {snap.textContent.length > 30 ? '…' : ''}"
            </span>
          )}
        </div>
        <span className="font-mono text-[10px] text-ink-500">
          {expanded ? '▼' : '▶'} {snap.splinesPostFlip.length} splines
        </span>
      </button>

      {expanded && (
        <div className="border-t border-ink-700 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-300">
          <div className="space-y-2">
            <div>
              <div className="text-ink-500">1. Bbox px Fabric (getBoundingRect):</div>
              <div className="whitespace-pre-wrap pl-3 text-ink-200">
                {bboxStr(snap.fabricBoundingRectPx, 'px')}
              </div>
            </div>

            <div>
              <div className="text-ink-500">2. Matrix Fabric (calcTransformMatrix):</div>
              <div className="pl-3 text-ink-200">
                {snap.fabricTransformMatrix
                  ? `[a=${fmt(snap.fabricTransformMatrix.a)}, b=${fmt(snap.fabricTransformMatrix.b)}, c=${fmt(snap.fabricTransformMatrix.c)}, d=${fmt(snap.fabricTransformMatrix.d)}, e=${fmt(snap.fabricTransformMatrix.e)}, f=${fmt(snap.fabricTransformMatrix.f)}]`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-ink-500">3. d SVG world (em mm, pós shapeToFlatPathD):</div>
              <div className="max-h-24 overflow-auto rounded bg-ink-950 px-2 py-1 text-[10px] text-ink-300">
                {snap.worldPathDmm.slice(0, 500)}
                {snap.worldPathDmm.length > 500 && '…'}
              </div>
              <div className="pl-3 text-ink-500">comprimento: {snap.worldPathDmm.length} chars</div>
            </div>

            <div>
              <div className="text-ink-500">4. Bbox do d (mm):</div>
              <div className="whitespace-pre-wrap pl-3 text-ink-200">
                {bboxStr(snap.worldPathBboxMm, 'mm')}
              </div>
            </div>

            <div>
              <div className="text-ink-500">5. Splines pré-flip (saída de svgPathToSplines):</div>
              <div className="pl-3 text-ink-200">
                count={snap.splinesPreFlip.length} (cada uma com 4 control points)
              </div>
              <div className="text-ink-500">Bbox pré-flip:</div>
              <div className="whitespace-pre-wrap pl-3 text-ink-200">
                {bboxStr(snap.splinesPreFlipBboxMm, 'mm')}
              </div>
            </div>

            <div>
              <div className="text-ink-500">6. Splines pós-flip (saída de normalizeForDxf):</div>
              <div className="text-ink-500">Bbox pós-flip (Y para cima — CAD):</div>
              <div className="whitespace-pre-wrap pl-3 text-ink-200">
                {bboxStr(snap.splinesPostFlipBboxMm, 'mm')}
              </div>
            </div>

            <div>
              <div className="text-ink-500">7. Primeiro control point (pré → pós flip):</div>
              <div className="pl-3 text-ink-200">
                pré:{' '}
                {snap.splinesPreFlip[0]
                  ? `(${fmt(snap.splinesPreFlip[0].controlPoints[0]!.x)}, ${fmt(snap.splinesPreFlip[0].controlPoints[0]!.y)})`
                  : '—'}
              </div>
              <div className="pl-3 text-ink-200">
                pós:{' '}
                {snap.splinesPostFlip[0]
                  ? `(${fmt(snap.splinesPostFlip[0].controlPoints[0]!.x)}, ${fmt(snap.splinesPostFlip[0].controlPoints[0]!.y)})`
                  : '—'}
              </div>
            </div>

            <div>
              <div className="text-ink-500">8. Máquinas roteadas:</div>
              <div className="pl-3 text-ink-200">{snap.machines.join(', ')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DxfDebugPanel({ open, report, onClose, onContinueExport }: DxfDebugPanelProps) {
  if (!report) return null;

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast.success('Report copiado para clipboard');
    } catch (err) {
      toast.error(`Falha ao copiar: ${String(err)}`);
    }
  }

  const { productMm, contentOffsetMm, frame, pxPerMm, canvasBoundingBoxPx, dxfFinalBoundingBoxMm } =
    report;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Debug DXF v2 — Telemetria Geométrica</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 pr-1">
          {/* ── Contexto global ───────────────────────────────────────────── */}
          <div className="rounded border border-ink-700 bg-ink-900/40 p-3 font-mono text-[11px] text-ink-300">
            <div className="mb-1 text-ink-500">Contexto global:</div>
            <div className="pl-2 space-y-0.5">
              <div>
                <span className="text-ink-500">Product:</span>{' '}
                <span className="text-ink-100">
                  {fmt(productMm.widthMm)} × {fmt(productMm.heightMm)} mm
                </span>
              </div>
              <div>
                <span className="text-ink-500">Content offset:</span>{' '}
                <span className="text-ink-100">
                  ({fmt(contentOffsetMm.xMm)}, {fmt(contentOffsetMm.yMm)}) mm
                </span>
              </div>
              <div>
                <span className="text-ink-500">PX_PER_MM:</span>{' '}
                <span className="text-ink-100">{pxPerMm}</span>
              </div>
              <div>
                <span className="text-ink-500">Frame matrix:</span>{' '}
                <span className="text-ink-100">
                  [a={fmt(frame.a)}, b={fmt(frame.b)}, c={fmt(frame.c)}, d={fmt(frame.d)}, e=
                  {fmt(frame.e)}, f={fmt(frame.f)}]
                </span>
              </div>
              <div>
                <span className="text-ink-500">Canvas bbox global (px):</span>
                <pre className="ml-2 whitespace-pre-wrap text-ink-200">
                  {bboxStr(canvasBoundingBoxPx, 'px')}
                </pre>
              </div>
              <div>
                <span className="text-ink-500">DXF final bbox global (mm):</span>
                <pre className="ml-2 whitespace-pre-wrap text-ink-200">
                  {bboxStr(dxfFinalBoundingBoxMm, 'mm')}
                </pre>
              </div>
            </div>
          </div>

          {/* ── Objetos ──────────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="text-xs text-ink-400">
              Objetos exportados ({report.objects.length}) — clique para expandir
            </div>
            {report.objects.map((snap, i) => (
              <ObjectRow key={snap.id} snap={snap} index={i + 1} />
            ))}
            {report.objects.length === 0 && (
              <div className="rounded border border-ink-700 bg-ink-900/40 p-3 text-center text-xs text-ink-500">
                Nenhum objeto exportado.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-ink-700 pt-3">
          <Button variant="outline" size="sm" onClick={() => void copyJson()}>
            Copiar JSON
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Fechar
            </Button>
            {onContinueExport && (
              <Button size="sm" onClick={onContinueExport} className="bg-laser-muted text-ink-100">
                Continuar export
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
