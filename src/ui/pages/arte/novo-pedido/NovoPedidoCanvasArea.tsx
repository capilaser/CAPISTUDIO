/**
 * NovoPedidoCanvasArea — área central do editor (Onda 13.6).
 *
 * Onda 13.6: canvas ÚNICO mostrando TODOS os broches empilhados verticalmente
 * (coluna 1: items 0..4, coluna 2: items 5..9). Substitui a fita-preview da
 * Onda 13 C2.
 *
 * Implementação:
 *   - useBoardEngine instancia 1 CanvasEngine com tamanho da prancha
 *     calculado a partir dos boardItems
 *   - Cada broche é adicionado como aplique (com posição absoluta em mm)
 *     e recebe o material correspondente
 *   - Sem fita lateral. Sem 2 canvases.
 *
 * Limitação: trocar/adicionar/remover broche re-instancia o engine inteiro.
 * Custo aceitável pra escala atual (5-10 broches). Cache de canvasJson
 * (Onda 13.5) está temporariamente sem uso aqui — vai voltar quando o
 * fluxo de "selecionar broche ativo" for repensado.
 */
import { useEffect, useRef, type RefObject } from 'react';
import { Loader2 } from 'lucide-react';

import type { CanvasEngine } from '@/core/canvas/canvas-engine';
import { useBoardEngine } from '@/hooks/useBoardEngine';
import type { BoardItemDraft } from '@/stores/canvas-store';

import { PatternBar } from './PatternBar';

// Tamanho inicial do canvas. ResizeObserver ajusta pra dimensão real do
// container assim que o componente monta — esses valores só servem pro
// primeiro tick antes do observer disparar.
const VIEWPORT = { widthPx: 1800, heightPx: 1100 };

interface Props {
  /** Items da prancha. Cada um vira um aplique posicionado no canvas. */
  boardItems: BoardItemDraft[];
  /** Broche ativo (pra PatternBar saber qual produto filtrar). */
  activeItem: BoardItemDraft | null;
  /** Offset do broche ativo na prancha (mm). Default {0,0}. */
  activeOffsetMm: { leftMm: number; topMm: number };
  /** Callback quando um pattern é aplicado no broche ativo. */
  onPatternApplied?: (patternId: string) => void;
  /** Ref compartilhada com a página para BancoDrawer/TextoItem. */
  engineRef: RefObject<CanvasEngine | null>;
  /** Callback de mudança das dims da prancha (usado pelo dialog de export). */
  onBoardDimsChange?: (dims: { widthMm: number; heightMm: number } | null) => void;
  /**
   * Onda 15 — callback disparado quando o engine fica pronto (após montagem
   * do canvas e carga inicial). LayerPanel usa esse sinal pra re-anexar
   * listeners depois do mount.
   */
  onEngineReadyChange?: (ready: boolean) => void;
  /**
   * Onda 15.fix — versão do engine (incrementa a cada novo engine).
   * Propagada pro LayerPanel pra disparar re-anexação de listeners
   * quando o engine é TROCADO (não só pronto).
   */
  onEngineVersionChange?: (version: number) => void;
  /**
   * Onda 13.7 — snapshot do canvas inteiro pra reabertura. Vem de
   * `orders.boardCanvasJson` (migration v12) na hidratação. Quando presente,
   * o hook deserializa em vez de montar via baseSvg.
   */
  snapshotCanvasJson?: string;
}

export function NovoPedidoCanvasArea({
  boardItems,
  activeItem,
  activeOffsetMm,
  onPatternApplied,
  engineRef: externalEngineRef,
  onBoardDimsChange,
  onEngineReadyChange,
  onEngineVersionChange,
  snapshotCanvasJson,
}: Props) {
  // Quando a prancha está vazia o BoardHost não monta — engine não existe.
  // Garante que o sinal vai pra false pra LayerPanel limpar listeners.
  useEffect(() => {
    if (boardItems.length === 0) onEngineReadyChange?.(false);
  }, [boardItems.length, onEngineReadyChange]);

  if (boardItems.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground">Adicione um broche na sidebar esquerda</p>
          <p className="text-[10px] text-muted-foreground/70">→</p>
        </div>
      </div>
    );
  }

  return (
    <BoardHost
      boardItems={boardItems}
      activeItem={activeItem}
      activeOffsetMm={activeOffsetMm}
      onPatternApplied={onPatternApplied}
      externalEngineRef={externalEngineRef}
      onBoardDimsChange={onBoardDimsChange}
      onEngineReadyChange={onEngineReadyChange}
      onEngineVersionChange={onEngineVersionChange}
      snapshotCanvasJson={snapshotCanvasJson}
    />
  );
}

function BoardHost({
  boardItems,
  activeItem,
  activeOffsetMm,
  onPatternApplied,
  externalEngineRef,
  onBoardDimsChange,
  onEngineReadyChange,
  onEngineVersionChange,
  snapshotCanvasJson,
}: {
  boardItems: BoardItemDraft[];
  activeItem: BoardItemDraft | null;
  activeOffsetMm: { leftMm: number; topMm: number };
  onPatternApplied?: (patternId: string) => void;
  externalEngineRef: RefObject<CanvasEngine | null>;
  onBoardDimsChange?: (dims: { widthMm: number; heightMm: number } | null) => void;
  onEngineReadyChange?: (ready: boolean) => void;
  onEngineVersionChange?: (version: number) => void;
  snapshotCanvasJson?: string;
}) {
  const { canvasRef, engineRef, ready, error, boardDims, engineVersion } = useBoardEngine({
    boardItems,
    viewport: VIEWPORT,
    mode: 'operator',
    snapshotCanvasJson,
  });

  // Sincroniza refs interno → externo após cada render. Evita acessar ref
  // durante render (lint rule react-hooks/refs).
  useEffect(() => {
    externalEngineRef.current = engineRef.current;
  });

  // Propaga readiness pro LayerPanel — sem isso, o LayerPanel monta antes
  // do engine existir e nunca anexa os listeners de canvas.
  useEffect(() => {
    onEngineReadyChange?.(ready);
  }, [ready, onEngineReadyChange]);

  // Onda 15.fix — propaga versão do engine pro LayerPanel.
  useEffect(() => {
    onEngineVersionChange?.(engineVersion);
  }, [engineVersion, onEngineVersionChange]);

  // Propaga dims pra página (necessário pro dialog de export saber o tamanho).
  useEffect(() => {
    onBoardDimsChange?.(boardDims);
  }, [boardDims, onBoardDimsChange]);

  // Onda 26d — ResizeObserver no container: mede a área disponível e propaga
  // pro engine pra redimensionar o canvas + re-encaixar a prancha. Dispara
  // no mount (primeira medição), em resize de janela e em mudança de layout
  // (ex: sidebar abrir/fechar no futuro).
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ready) return;
    const container = containerRef.current;
    const engine = engineRef.current;
    if (!container || !engine) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        engine.resizeViewport(Math.floor(width), Math.floor(height));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready, engineRef, engineVersion]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <PatternBar
        engineRef={externalEngineRef}
        activeProductId={activeItem?.productId ?? null}
        activeItemId={activeItem?.id ?? null}
        activeOffsetMm={activeOffsetMm}
        activePatternId={activeItem?.patternId ?? null}
        onApplied={onPatternApplied}
      />
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
      >
        <canvas ref={canvasRef} width={VIEWPORT.widthPx} height={VIEWPORT.heightPx} />
        {!ready && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-[10px] uppercase tracking-wider">Montando canvas…</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => externalEngineRef.current?.fitBoardToViewport()}
          className="pointer-events-auto absolute right-3 top-3 rounded-md border border-border bg-card/80 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-foreground"
          title="Enquadrar tudo no viewport"
        >
          Enquadrar
        </button>
        {boardDims && (
          <div className="pointer-events-none absolute bottom-3 right-3 font-mono text-[10px] tabular-nums text-muted-foreground/70">
            {boardDims.widthMm.toFixed(0)}×{boardDims.heightMm.toFixed(0)}mm · {boardItems.length}{' '}
            {boardItems.length === 1 ? 'broche' : 'broches'}
            {!ready && ' · carregando…'}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <p className="text-xs text-destructive">Erro: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
