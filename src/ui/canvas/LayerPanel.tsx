/**
 * LayerPanel.tsx (Onda 7) — painel hierárquico de camadas estilo Photoshop.
 *
 * Renderiza a lista retornada por `engine.getLayersHierarchy()` agrupando
 * apliques principais e seus filhos (slots/visuais), com órfãos no fim.
 *
 * Reage a:
 *   - selection:created/updated/cleared do canvas → atualiza linha destacada
 *   - object:added/object:removed → reconstrói a hierarquia
 *   - layer-meta-changed (custom, disparado pelo engine) → idem
 *
 * Clicar numa linha seleciona o objeto no canvas. Os botões de ação
 * chamam métodos do engine que disparam `layer-meta-changed` → o painel
 * se reconstrói via o mesmo listener. Loop completo, zero estado
 * duplicado no React.
 */
import { useEffect, useState, type RefObject } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';

import { CanvasEngine, isBaseObject, type LayerNode } from '@/core/canvas/canvas-engine';
import { getCapiId } from '@/core/canvas/capi-id';
import { LayerRow } from './layer-panel/LayerRow';
import { DeleteLayerDialog } from './layer-panel/DeleteLayerDialog';

interface Props {
  engineRef: RefObject<CanvasEngine | null>;
  /**
   * Onda 15 — sinal de que o engine ficou pronto. Quando este boolean
   * transita false→true, o painel re-anexa listeners (caso tenha sido
   * montado ANTES do engine existir).
   *
   * Onda 15.fix — quando o engine é TROCADO (não só "ficou pronto" — outra
   * instância), `engineReady` pode permanecer true entre as duas, e o
   * useEffect do painel não re-roda. Resultado: listeners atados ao canvas
   * antigo (já disposed). Pra resolver, callers que recriam engine devem
   * passar `engineVersion: number` que incrementa a cada novo engine. O
   * painel usa esse número como dep do useEffect.
   *
   * Default true: pra callers que já têm o engine pronto no mount
   * (ex: /dev/canvas-test).
   */
  engineReady?: boolean;
  /**
   * Onda 15.fix — incrementado a cada novo engine. Quando muda, força
   * re-anexação dos listeners do canvas (cleanup do anterior + setup no novo).
   * Default 0 — pra callers single-engine (ex: /dev/canvas-test).
   */
  engineVersion?: number;
  /**
   * Onda 15 — quando o componente é embutido em uma sidebar que já tem
   * header próprio (NovoPedidoLayerSidebar, PadraoEditorPage), passamos
   * false pra evitar duplicar "Camadas" na tela. Default true.
   */
  showTitle?: boolean;
}

interface DeleteTarget {
  id: string;
  name: string;
  cascadeChildren: string[];
}

export function LayerPanel({
  engineRef,
  engineReady = true,
  engineVersion = 0,
  showTitle = true,
}: Props): React.ReactElement {
  const [hierarchy, setHierarchy] = useState<LayerNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  /**
   * Map id → { idx, canMoveUp, canMoveDown } pré-calculado dentro dos
   * listeners (NÃO durante render — ESLint react-hooks/refs proíbe ler
   * refs durante render). Updated junto com hierarchy.
   */
  const [zOrder, setZOrder] = useState<Map<string, { canMoveUp: boolean; canMoveDown: boolean }>>(
    new Map()
  );

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const canvas = engine.canvas;

    // Recalcula tudo: hierarchy + selectedId + zOrder. Centralizado aqui
    // pra evitar leitura de ref durante render do componente.
    const refresh = (): void => {
      setHierarchy(engine.getLayersHierarchy());

      const active = canvas.getActiveObject();
      const activeId =
        active && !isBaseObject(active)
          ? (getCapiId(active as unknown as Record<string, unknown>) ?? null)
          : null;
      setSelectedId(activeId);

      // Z-order: descobre topo/fundo entre USER objects e popula mapa.
      const objs = canvas.getObjects();
      const userIdxs = objs.filter((o) => !isBaseObject(o)).map((o) => objs.indexOf(o));
      const minUserIdx = userIdxs.length > 0 ? Math.min(...userIdxs) : -1;
      const maxUserIdx = userIdxs.length > 0 ? Math.max(...userIdxs) : -1;
      const map = new Map<string, { canMoveUp: boolean; canMoveDown: boolean }>();
      for (const obj of objs) {
        if (isBaseObject(obj)) continue;
        const id = getCapiId(obj as unknown as Record<string, unknown>);
        if (!id) continue;
        const idx = objs.indexOf(obj);
        map.set(id, { canMoveUp: idx < maxUserIdx, canMoveDown: idx > minUserIdx });
      }
      setZOrder(map);
    };

    const handler = (): void => refresh();

    canvas.on('selection:created', handler);
    canvas.on('selection:updated', handler);
    canvas.on('selection:cleared', handler);
    canvas.on('object:added', handler);
    canvas.on('object:removed', handler);
    // Evento custom — Fabric 6 não tem no tipo. Cast no on().
    (canvas as unknown as { on: (n: string, h: () => void) => void }).on(
      'layer-meta-changed',
      handler
    );

    // Render inicial — caso já existam camadas quando o painel monta.
    refresh();

    return () => {
      canvas.off('selection:created', handler);
      canvas.off('selection:updated', handler);
      canvas.off('selection:cleared', handler);
      canvas.off('object:added', handler);
      canvas.off('object:removed', handler);
      (canvas as unknown as { off: (n: string, h: () => void) => void }).off(
        'layer-meta-changed',
        handler
      );
    };
    // engineRef é estável. engineReady + engineVersion são os sinais pra
    // re-anexar quando o engine fica pronto ou é trocado (ver JSDoc das props).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady, engineVersion]);

  // Reparent options: lista de apliques + opção "Solto" — recalculada
  // a partir da hierarchy atual. Sem useMemo: cálculo é O(N principais).
  const reparentOptions: Array<{ id: string | null; name: string }> = [
    { id: null, name: 'Solto (sem aplique pai)' },
    ...hierarchy
      .filter((n): n is Extract<LayerNode, { kind: 'principal' }> => n.kind === 'principal')
      .map((n) => ({ id: n.id, name: n.name })),
  ];

  // Achata a árvore em uma lista pra renderização linear com indentação.
  type FlatNode = { node: LayerNode; indentPx: number };
  const flat: FlatNode[] = [];
  for (const top of hierarchy) {
    flat.push({ node: top, indentPx: 0 });
    if (top.kind === 'principal') {
      for (const child of top.children) {
        flat.push({ node: child, indentPx: 16 });
      }
    }
  }

  // ─── Handlers que disparam ações no engine ───────────────────────────────

  function handleSelect(id: string): void {
    const engine = engineRef.current;
    if (!engine) return;
    const obj = engine.canvas
      .getObjects()
      .find((o) => getCapiId(o as unknown as Record<string, unknown>) === id);
    if (!obj) return;
    engine.canvas.setActiveObject(obj);
    engine.canvas.requestRenderAll();
    // O 'selection:created' do setActiveObject dispara refresh via listener.
  }

  function handleToggleVisible(node: LayerNode): void {
    engineRef.current?.setLayerVisibility(node.id, !node.visible);
  }

  function handleToggleLocked(node: LayerNode): void {
    engineRef.current?.setLayerLocked(node.id, !node.locked);
  }

  function handleStartRename(id: string): void {
    setRenamingId(id);
  }

  function handleCommitRename(id: string, newName: string): void {
    engineRef.current?.renameLayer(id, newName);
    setRenamingId(null);
  }

  function handleCancelRename(): void {
    setRenamingId(null);
  }

  function handleDeleteRequest(node: LayerNode): void {
    if (node.kind === 'principal') {
      // Lista filhos pra mostrar no dialog.
      const children = node.children.map((c) => c.name);
      setDeleteTarget({ id: node.id, name: node.name, cascadeChildren: children });
    } else {
      setDeleteTarget({ id: node.id, name: node.name, cascadeChildren: [] });
    }
  }

  function handleDeleteConfirm(): void {
    if (!deleteTarget) return;
    const result = engineRef.current?.deleteLayer(deleteTarget.id);
    if (result) {
      const count = result.deletedIds.length;
      toast.success(count === 1 ? 'Camada excluída' : `${count} camadas excluídas`);
    }
    setDeleteTarget(null);
  }

  function handleDeleteCancel(): void {
    setDeleteTarget(null);
  }

  function handleMoveUp(id: string): void {
    engineRef.current?.moveLayer(id, 'up');
  }

  function handleMoveDown(id: string): void {
    engineRef.current?.moveLayer(id, 'down');
  }

  function handleReparent(id: string, newParentId: string | null): void {
    engineRef.current?.reparentLayer(id, newParentId);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (flat.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-ink-400">
        <Layers className="h-8 w-8 opacity-50" />
        <p>Nenhuma camada ainda.</p>
        <p className="text-center text-xs text-ink-500">
          Adicione um aplique ou crie um slot pra começar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-0.5 p-2" data-testid="layer-panel">
        {showTitle && (
          <p className="mb-1 px-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
            Camadas
          </p>
        )}
        {flat.map(({ node, indentPx }) => {
          const zo = zOrder.get(node.id);
          const canMoveUp = zo?.canMoveUp ?? false;
          const canMoveDown = zo?.canMoveDown ?? false;
          // Opções de reparent pra slots/visuais — excluem o pai atual implícito
          // (DropdownMenu desabilita a opção atual via `disabled`).
          const opts = node.kind === 'principal' ? undefined : reparentOptions;

          return (
            <LayerRow
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              renaming={renamingId === node.id}
              indentPx={indentPx}
              reparentOptions={opts}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onSelect={() => handleSelect(node.id)}
              onStartRename={() => handleStartRename(node.id)}
              onCommitRename={(name) => handleCommitRename(node.id, name)}
              onCancelRename={handleCancelRename}
              onToggleVisible={() => handleToggleVisible(node)}
              onToggleLocked={() => handleToggleLocked(node)}
              onDelete={() => handleDeleteRequest(node)}
              onMoveUp={() => handleMoveUp(node.id)}
              onMoveDown={() => handleMoveDown(node.id)}
              onReparent={(newParentId) => handleReparent(node.id, newParentId)}
            />
          );
        })}
      </div>

      <DeleteLayerDialog
        open={deleteTarget !== null}
        layerName={deleteTarget?.name ?? ''}
        cascadeChildren={deleteTarget?.cascadeChildren ?? []}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
}
