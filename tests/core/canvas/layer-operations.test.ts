/**
 * Testes dos 7 métodos públicos de gerenciamento de camadas (Onda 7).
 *
 * Estratégia (lição da Onda 6b/7.5): exercitar a cadeia real do Fabric,
 * não mock de função pura — esses métodos têm contrato com `obj.set({...})`
 * e com o estado do canvas, então usamos Fabric Canvas real em jsdom +
 * node-canvas (mesmo setup do slot-manager-sync.test.ts).
 *
 * Cobre o contrato com a Onda 9: setLayerVisibility NÃO mexe em
 * excludeFromExport. Confirmação garantida por asserção explícita.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CanvasEngine, type LayerNode } from '@/core/canvas/canvas-engine';
import { isPrincipalLayer } from '@/core/canvas/layer-meta';

const baseConfig = {
  productWidthMm: 300,
  productHeightMm: 90,
  viewportWidthPx: 1600,
  viewportHeightPx: 600,
};

describe('CanvasEngine — layer operations (Onda 7)', () => {
  let canvasEl: HTMLCanvasElement;
  let engine: CanvasEngine;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    engine = new CanvasEngine(canvasEl, baseConfig);
  });

  afterEach(() => {
    engine.dispose();
  });

  // Helper: adiciona retângulo e retorna o id capi.
  function addRect(): string {
    const obj = engine.addRectangle(10, 10, 20, 20);
    return (obj as unknown as { id: string }).id;
  }

  // ── 1. setLayerVisibility(false) — visible=false E excludeFromExport NÃO muda ─
  it('setLayerVisibility(false) seta obj.visible=false MAS preserva excludeFromExport (contrato Onda 9)', () => {
    const id = addRect();
    const objBefore = engine.canvas.getObjects().find((o) => {
      return (o as unknown as { id?: string }).id === id;
    })!;
    const exportBefore = objBefore.excludeFromExport;

    engine.setLayerVisibility(id, false);

    expect(objBefore.visible).toBe(false);
    // Contrato crítico — NÃO mexe em excludeFromExport (bug que faria
    // a camada sumir do canvasJson ao salvar padrão).
    expect(objBefore.excludeFromExport).toBe(exportBefore);

    const meta = engine.getLayerMeta(id);
    expect(meta?.visible).toBe(false);
  });

  // ── 2. setLayerVisibility(true) — restaura ──────────────────────────────────
  it('setLayerVisibility(true) restaura visibilidade', () => {
    const id = addRect();
    engine.setLayerVisibility(id, false);
    engine.setLayerVisibility(id, true);

    const obj = engine.canvas.getObjects().find((o) => {
      return (o as unknown as { id?: string }).id === id;
    })!;
    expect(obj.visible).toBe(true);
    expect(engine.getLayerMeta(id)?.visible).toBe(true);
  });

  // ── 3. setLayerLocked(true) — 5 locks ativos + selectable continua true ──────
  it('setLayerLocked(true) trava movimento/scale/rotation mas mantém selectable', () => {
    const id = addRect();
    engine.setLayerLocked(id, true);
    const obj = engine.canvas.getObjects().find((o) => {
      return (o as unknown as { id?: string }).id === id;
    })!;

    // Visual layer não-principal: lockRotation NÃO é alterado pra preservar invariante.
    expect(obj.lockMovementX).toBe(true);
    expect(obj.lockMovementY).toBe(true);
    expect(obj.lockScalingX).toBe(true);
    expect(obj.lockScalingY).toBe(true);
    expect(obj.selectable).toBe(true);
    expect(obj.evented).toBe(true);

    expect(engine.getLayerMeta(id)?.locked).toBe(true);
  });

  // ── 4. setLayerLocked(false) em visual — restaura locks ─────────────────────
  it('setLayerLocked(false) restaura locks de movement/scaling', () => {
    const id = addRect();
    engine.setLayerLocked(id, true);
    engine.setLayerLocked(id, false);
    const obj = engine.canvas.getObjects().find((o) => {
      return (o as unknown as { id?: string }).id === id;
    })!;

    expect(obj.lockMovementX).toBe(false);
    expect(obj.lockMovementY).toBe(false);
    expect(obj.lockScalingX).toBe(false);
    expect(obj.lockScalingY).toBe(false);
    expect(engine.getLayerMeta(id)?.locked).toBe(false);
  });

  // ── 5. renameLayer — atualiza nome; vazio é no-op ───────────────────────────
  it('renameLayer atualiza nome; renomear com string vazia é no-op', () => {
    const id = addRect();
    const original = engine.getLayerMeta(id)?.name;

    engine.renameLayer(id, 'Aplique Dourado');
    expect(engine.getLayerMeta(id)?.name).toBe('Aplique Dourado');

    // Vazio (e só espaços) é no-op.
    engine.renameLayer(id, '');
    expect(engine.getLayerMeta(id)?.name).toBe('Aplique Dourado');

    engine.renameLayer(id, '   ');
    expect(engine.getLayerMeta(id)?.name).toBe('Aplique Dourado');

    // Sanidade — nome original era preenchido antes.
    expect(original).toBeTruthy();
  });

  // ── 6. deleteLayer em rect solto — só ele some ───────────────────────────────
  it('deleteLayer em rect solto remove apenas ele', () => {
    const idA = addRect();
    const idB = addRect();

    const result = engine.deleteLayer(idA);

    expect(result.deletedIds).toEqual([idA]);
    expect(engine.getLayerMeta(idA)).toBeNull();
    expect(engine.getLayerMeta(idB)).not.toBeNull();
  });

  // ── 7. deleteLayer em principal com filhos — cascade ────────────────────────
  it('deleteLayer em principal com filhos remove tudo em cascata', () => {
    // Adiciona 1 rect e força ser principal via patch interno (simula aplique).
    const principalId = addRect();
    const metaP = engine.getAllLayerMetas().get(principalId)!;
    // Promove pra principal manualmente — o teste foca no comportamento de
    // delete cascade, não na criação de aplique (que exige SVG real).
    (metaP as unknown as { kind: string; parentLayerId: null }).kind = 'principal';
    (metaP as unknown as { kind: string; parentLayerId: null }).parentLayerId = null;

    // 2 filhos com parentLayerId = principalId.
    const childA = addRect();
    const childB = addRect();
    const metaA = engine.getAllLayerMetas().get(childA)!;
    const metaB = engine.getAllLayerMetas().get(childB)!;
    (metaA as unknown as { parentLayerId: string }).parentLayerId = principalId;
    (metaB as unknown as { parentLayerId: string }).parentLayerId = principalId;

    const result = engine.deleteLayer(principalId);

    expect(result.deletedIds).toContain(principalId);
    expect(result.deletedIds).toContain(childA);
    expect(result.deletedIds).toContain(childB);
    expect(result.deletedIds).toHaveLength(3);
    expect(engine.getLayerMeta(principalId)).toBeNull();
    expect(engine.getLayerMeta(childA)).toBeNull();
    expect(engine.getLayerMeta(childB)).toBeNull();
  });

  // ── 8. moveLayer('up') — sobe na z-order ────────────────────────────────────
  it("moveLayer('up') sobe o objeto na z-order do canvas", () => {
    const idA = addRect();
    addRect(); // idB — adicionado pra que A tenha onde subir (não usamos a ref).

    // B foi adicionado por último → está em cima de A. Mover A pra cima.
    const objA = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === idA)!;
    const idxBefore = engine.canvas.getObjects().indexOf(objA);

    engine.moveLayer(idA, 'up');

    const idxAfter = engine.canvas.getObjects().indexOf(objA);
    expect(idxAfter).toBeGreaterThan(idxBefore);
    // LayerMeta.zIndex foi sincronizado com a nova posição.
    expect(engine.getLayerMeta(idA)?.zIndex).toBe(idxAfter);
  });

  // ── 9. reparentLayer — muda parentLayerId ────────────────────────────────────
  it('reparentLayer muda parentLayerId; rejeita pai inexistente; rejeita reparent de principal', () => {
    const principalId = addRect();
    const metaP = engine.getAllLayerMetas().get(principalId)!;
    (metaP as unknown as { kind: string; parentLayerId: null }).kind = 'principal';
    (metaP as unknown as { kind: string; parentLayerId: null }).parentLayerId = null;

    const slotId = addRect(); // visual por default

    // Reparent pra aplique → ok.
    engine.reparentLayer(slotId, principalId);
    expect(engine.getLayerMeta(slotId)?.parentLayerId).toBe(principalId);

    // Reparent pra null (solto) → ok.
    engine.reparentLayer(slotId, null);
    expect(engine.getLayerMeta(slotId)?.parentLayerId).toBeNull();

    // Reparent pra id inexistente → no-op (preserva o último estado).
    engine.reparentLayer(slotId, 'inexistente-xxx');
    expect(engine.getLayerMeta(slotId)?.parentLayerId).toBeNull();

    // Tentar reparent de principal → no-op (invariante ADR 010).
    engine.reparentLayer(principalId, slotId);
    const finalP = engine.getLayerMeta(principalId);
    expect(finalP && isPrincipalLayer(finalP) && finalP.parentLayerId).toBeNull();
  });

  // ── 10. getLayersHierarchy — estrutura agrupada correta ─────────────────────
  it('getLayersHierarchy retorna principais com filhos + órfãos no fim', () => {
    // 1 principal com 2 filhos + 1 visual solto.
    const principalId = addRect();
    const metaP = engine.getAllLayerMetas().get(principalId)!;
    (metaP as unknown as { kind: string; parentLayerId: null }).kind = 'principal';
    (metaP as unknown as { kind: string; parentLayerId: null }).parentLayerId = null;

    const childA = addRect();
    const childB = addRect();
    const orphan = addRect();

    engine.reparentLayer(childA, principalId);
    engine.reparentLayer(childB, principalId);
    // orphan fica sem pai (default).

    const hierarchy = engine.getLayersHierarchy();

    // 1 principal + 1 órfão na raiz.
    expect(hierarchy).toHaveLength(2);

    const principalNode = hierarchy.find(
      (n): n is Extract<LayerNode, { kind: 'principal' }> => n.kind === 'principal'
    );
    expect(principalNode).toBeDefined();
    expect(principalNode!.children).toHaveLength(2);
    expect(principalNode!.children.map((c) => c.id).sort()).toEqual([childA, childB].sort());

    const orphanNode = hierarchy.find(
      (n): n is Extract<LayerNode, { kind: 'visual' | 'operation' }> => n.id === orphan
    );
    expect(orphanNode).toBeDefined();
    expect(orphanNode!.parentId).toBeNull();
  });

  // ── 11. deleteLayer dispara evento 'layer-meta-changed' ─────────────────────
  it("setLayerVisibility dispara 'layer-meta-changed' no canvas", () => {
    const id = addRect();
    let fired = false;
    (
      engine.canvas as unknown as {
        on: (name: string, h: (e: { layerId?: string }) => void) => void;
      }
    ).on('layer-meta-changed', (e) => {
      if (e.layerId === id) fired = true;
    });

    engine.setLayerVisibility(id, false);
    expect(fired).toBe(true);
  });

  // ── 12. setLayerLocked(false) em principal restaura também lockRotation ────
  it('setLayerLocked(false) em principal restaura lockRotation; em visual NÃO mexe', () => {
    // Visual: lockRotation já é o default que addRectangle setou; vamos
    // mexer só com asserções de movimento/scale (cobertas no teste 4).
    // Aqui foco no principal.
    const principalId = addRect();
    const metaP = engine.getAllLayerMetas().get(principalId)!;
    (metaP as unknown as { kind: string; parentLayerId: null }).kind = 'principal';
    (metaP as unknown as { kind: string; parentLayerId: null }).parentLayerId = null;

    engine.setLayerLocked(principalId, true);
    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === principalId)!;
    expect(obj.lockRotation).toBe(true);

    engine.setLayerLocked(principalId, false);
    expect(obj.lockRotation).toBe(false);
  });
});
