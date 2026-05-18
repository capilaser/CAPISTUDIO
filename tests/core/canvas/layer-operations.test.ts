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

  // ── 13. setLayerOpacity (Onda 26) — propaga pro obj e persiste em meta ────
  it('setLayerOpacity define obj.opacity e LayerMeta.opacity', () => {
    const id = addRect();
    engine.setLayerOpacity(id, 0.5);

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    expect(obj.opacity).toBe(0.5);
    expect(engine.getLayerMeta(id)?.opacity).toBe(0.5);
  });

  // ── 14. setLayerOpacity clampa valores fora de [0, 1] ─────────────────────
  it('setLayerOpacity clampa valores fora de [0, 1]', () => {
    const id = addRect();
    engine.setLayerOpacity(id, 1.5);
    expect(engine.getLayerMeta(id)?.opacity).toBe(1);
    engine.setLayerOpacity(id, -0.2);
    expect(engine.getLayerMeta(id)?.opacity).toBe(0);
  });

  // ── 15. setLayerOpacity dispara layer-meta-changed ────────────────────────
  it('setLayerOpacity dispara layer-meta-changed', () => {
    const id = addRect();
    let fired = false;
    (
      engine.canvas as unknown as {
        on: (name: string, h: (e: { layerId?: string }) => void) => void;
      }
    ).on('layer-meta-changed', (e) => {
      if (e.layerId === id) fired = true;
    });

    engine.setLayerOpacity(id, 0.3);
    expect(fired).toBe(true);
  });

  // ── 16. setLayerOpacity em id inválido = no-op ────────────────────────────
  it('setLayerOpacity em id inválido é no-op silencioso', () => {
    expect(() => engine.setLayerOpacity('id-inexistente', 0.5)).not.toThrow();
  });

  // ── 17. opacity persiste no getLayersHierarchy ────────────────────────────
  it('getLayersHierarchy expõe opacity (1 quando não setado, valor real após set)', () => {
    const id1 = addRect();
    const id2 = addRect();
    engine.setLayerOpacity(id2, 0.7);

    const hier = engine.getLayersHierarchy();
    const node1 = hier.find((n) => n.id === id1);
    const node2 = hier.find((n) => n.id === id2);
    expect(node1?.opacity).toBe(1);
    expect(node2?.opacity).toBe(0.7);
  });

  // ── 18b. moveLayerToIndex (Fase 2) — reposiciona obj e sincroniza zIndex ──
  it('moveLayerToIndex reposiciona o obj no canvas e atualiza meta.zIndex', () => {
    const id1 = addRect();
    const id2 = addRect();
    const id3 = addRect();

    const objs0 = engine.canvas.getObjects();
    const idxAtual = objs0.findIndex((o) => (o as unknown as { id?: string }).id === id1);
    expect(idxAtual).toBeGreaterThanOrEqual(0);

    const target = objs0.length - 1;
    engine.moveLayerToIndex(id1, target);

    const objsAfter = engine.canvas.getObjects();
    const newIdx = objsAfter.findIndex((o) => (o as unknown as { id?: string }).id === id1);
    expect(newIdx).toBe(target);
    expect(engine.getLayerMeta(id1)?.zIndex).toBe(target);

    expect(objsAfter.find((o) => (o as unknown as { id?: string }).id === id2)).toBeDefined();
    expect(objsAfter.find((o) => (o as unknown as { id?: string }).id === id3)).toBeDefined();
  });

  it('moveLayerToIndex clampa índice fora do range do canvas', () => {
    const id = addRect();
    expect(() => engine.moveLayerToIndex(id, 9999)).not.toThrow();
    expect(() => engine.moveLayerToIndex(id, -10)).not.toThrow();
  });

  it('moveLayerToIndex em id inválido é no-op silencioso', () => {
    expect(() => engine.moveLayerToIndex('id-inexistente', 0)).not.toThrow();
  });

  // ── 18e. soloLayer (Fase 3) — só a alvo fica visible; null restaura tudo ──
  it('soloLayer(id) deixa só a alvo visível; soloLayer(null) restaura', () => {
    const id1 = addRect();
    const id2 = addRect();
    const id3 = addRect();

    engine.soloLayer(id2);
    expect(engine.getLayerMeta(id1)?.visible).toBe(false);
    expect(engine.getLayerMeta(id2)?.visible).toBe(true);
    expect(engine.getLayerMeta(id3)?.visible).toBe(false);

    engine.soloLayer(null);
    expect(engine.getLayerMeta(id1)?.visible).toBe(true);
    expect(engine.getLayerMeta(id2)?.visible).toBe(true);
    expect(engine.getLayerMeta(id3)?.visible).toBe(true);
  });

  // ── 18f. duplicateLayer (Fase 3) — cria novo id com mesma meta + offset ──
  it('duplicateLayer cria novo obj com novo id, herda metadata e offset 10px', async () => {
    const id = addRect();
    engine.setLayerOpacity(id, 0.6);

    const newId = await engine.duplicateLayer(id);
    expect(newId).not.toBeNull();
    expect(newId).not.toBe(id);

    const newMeta = engine.getLayerMeta(newId!);
    expect(newMeta).not.toBeNull();
    // Herdou opacity.
    expect(newMeta?.opacity).toBe(0.6);
    // Nome novo indica que é cópia.
    expect(newMeta?.name).toContain('(cópia)');

    // O obj clonado está offset 10 em relação ao original.
    const orig = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    const dup = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === newId)!;
    expect(dup.left).toBe((orig.left ?? 0) + 10);
    expect(dup.top).toBe((orig.top ?? 0) + 10);
  });

  // ── 18g. duplicateLayer recusa principal (Fase 3) ─────────────────────────
  it('duplicateLayer retorna null pra camada principal', async () => {
    const id = addRect();
    // Força kind=principal pra simular aplique.
    const meta = engine.getAllLayerMetas().get(id)!;
    (meta as unknown as { kind: string; parentLayerId: null }).kind = 'principal';
    (meta as unknown as { kind: string; parentLayerId: null }).parentLayerId = null;

    const result = await engine.duplicateLayer(id);
    expect(result).toBeNull();
  });

  // ── 18h. duplicateLayer em id inválido = null ─────────────────────────────
  it('duplicateLayer em id inválido retorna null', async () => {
    const result = await engine.duplicateLayer('id-inexistente');
    expect(result).toBeNull();
  });

  // ── 18. opacity serializa e deserializa preservando o valor ───────────────
  it('opacity sobrevive a serialize → deserialize', async () => {
    const id = addRect();
    engine.setLayerOpacity(id, 0.42);

    const snapshot = engine.serialize();
    // Cria engine novo e carrega o snapshot.
    const canvas2 = document.createElement('canvas');
    const engine2 = new CanvasEngine(canvas2, baseConfig);
    try {
      await engine2.deserialize(snapshot);
      const meta = engine2.getAllLayerMetas().get(id);
      expect(meta?.opacity).toBe(0.42);
      const obj = engine2.canvas
        .getObjects()
        .find((o) => (o as unknown as { id?: string }).id === id);
      expect(obj?.opacity).toBe(0.42);
    } finally {
      engine2.dispose();
    }
  });

  // ── 18i. setMultipleVisibility (Fase 4) — aplica em lote ──────────────────
  it('setMultipleVisibility aplica visible em todos os ids passados', () => {
    const id1 = addRect();
    const id2 = addRect();
    const id3 = addRect();

    engine.setMultipleVisibility([id1, id2], false);
    expect(engine.getLayerMeta(id1)?.visible).toBe(false);
    expect(engine.getLayerMeta(id2)?.visible).toBe(false);
    expect(engine.getLayerMeta(id3)?.visible).toBe(true);
  });

  // ── 18j. setMultipleOpacity (Fase 4) ──────────────────────────────────────
  it('setMultipleOpacity aplica opacity em todos os ids passados', () => {
    const id1 = addRect();
    const id2 = addRect();

    engine.setMultipleOpacity([id1, id2], 0.25);
    expect(engine.getLayerMeta(id1)?.opacity).toBe(0.25);
    expect(engine.getLayerMeta(id2)?.opacity).toBe(0.25);
  });

  // ── 18k. setMultipleLocked (Fase 4) ───────────────────────────────────────
  it('setMultipleLocked aplica locked em todos os ids passados', () => {
    const id1 = addRect();
    const id2 = addRect();

    engine.setMultipleLocked([id1, id2], true);
    expect(engine.getLayerMeta(id1)?.locked).toBe(true);
    expect(engine.getLayerMeta(id2)?.locked).toBe(true);
  });

  // ── 18l. deleteMultipleLayers (Fase 4) ────────────────────────────────────
  it('deleteMultipleLayers remove todos os ids passados', () => {
    const id1 = addRect();
    const id2 = addRect();
    const id3 = addRect();

    const result = engine.deleteMultipleLayers([id1, id2]);
    expect(result.deletedIds).toContain(id1);
    expect(result.deletedIds).toContain(id2);
    expect(engine.getLayerMeta(id1)).toBeNull();
    expect(engine.getLayerMeta(id2)).toBeNull();
    expect(engine.getLayerMeta(id3)).not.toBeNull();
  });

  // ── 18m. batch ops ignoram ids inválidos silenciosamente ──────────────────
  it('batch ops ignoram ids inválidos silenciosamente', () => {
    const id1 = addRect();
    expect(() =>
      engine.setMultipleVisibility([id1, 'nao-existe', 'tambem-nao'], false)
    ).not.toThrow();
    expect(engine.getLayerMeta(id1)?.visible).toBe(false);
  });

  // ── 19. setLayerColorLabel (Fase 5) — persiste e respeita 'none' ──────────
  it('setLayerColorLabel persiste cor e none apaga', () => {
    const id = addRect();
    engine.setLayerColorLabel(id, 'red');
    expect(engine.getLayerMeta(id)?.colorLabel).toBe('red');

    engine.setLayerColorLabel(id, 'none');
    // 'none' deleta o campo (volta a undefined no meta).
    expect(engine.getLayerMeta(id)?.colorLabel).toBeUndefined();
  });

  // ── 19b. setLayerColorLabel dispara layer-meta-changed ────────────────────
  it('setLayerColorLabel dispara layer-meta-changed', () => {
    const id = addRect();
    let fired = false;
    (
      engine.canvas as unknown as {
        on: (n: string, h: (e: { layerId?: string }) => void) => void;
      }
    ).on('layer-meta-changed', (e) => {
      if (e.layerId === id) fired = true;
    });
    engine.setLayerColorLabel(id, 'blue');
    expect(fired).toBe(true);
  });

  // ── 19c. setLayerColorLabel em id inválido = no-op ────────────────────────
  it('setLayerColorLabel em id inválido é no-op silencioso', () => {
    expect(() => engine.setLayerColorLabel('id-inexistente', 'green')).not.toThrow();
  });

  // ── 20. setLayerBlendMode (Fase 5) — propaga pro obj.globalCompositeOperation
  it('setLayerBlendMode persiste e seta globalCompositeOperation', () => {
    const id = addRect();
    engine.setLayerBlendMode(id, 'multiply');
    expect(engine.getLayerMeta(id)?.blendMode).toBe('multiply');

    const obj = engine.canvas
      .getObjects()
      .find((o) => (o as unknown as { id?: string }).id === id)!;
    expect((obj as unknown as { globalCompositeOperation: string }).globalCompositeOperation).toBe(
      'multiply'
    );

    engine.setLayerBlendMode(id, 'normal');
    // 'normal' deleta o campo e seta source-over no obj.
    expect(engine.getLayerMeta(id)?.blendMode).toBeUndefined();
    expect((obj as unknown as { globalCompositeOperation: string }).globalCompositeOperation).toBe(
      'source-over'
    );
  });

  // ── 20b. setLayerBlendMode em id inválido = no-op ─────────────────────────
  it('setLayerBlendMode em id inválido é no-op silencioso', () => {
    expect(() => engine.setLayerBlendMode('id-inexistente', 'multiply')).not.toThrow();
  });

  // ── 20c. blendMode + colorLabel sobrevivem a serialize → deserialize ──────
  it('colorLabel e blendMode sobrevivem a serialize/deserialize', async () => {
    const id = addRect();
    engine.setLayerColorLabel(id, 'violet');
    engine.setLayerBlendMode(id, 'screen');

    const snap = engine.serialize();
    const canvas2 = document.createElement('canvas');
    const engine2 = new CanvasEngine(canvas2, baseConfig);
    try {
      await engine2.deserialize(snap);
      const meta = engine2.getAllLayerMetas().get(id);
      expect(meta?.colorLabel).toBe('violet');
      expect(meta?.blendMode).toBe('screen');
      const obj = engine2.canvas
        .getObjects()
        .find((o) => (o as unknown as { id?: string }).id === id);
      expect(
        (obj as unknown as { globalCompositeOperation: string }).globalCompositeOperation
      ).toBe('screen');
    } finally {
      engine2.dispose();
    }
  });

  // ── 20d. LayerNode expõe defaults ('none' e 'normal') quando meta vazio ───
  it('getLayersHierarchy expõe colorLabel/blendMode defaults pra metas sem campos', () => {
    const id = addRect();
    const hier = engine.getLayersHierarchy();
    const node = hier.find((n) => n.id === id);
    expect(node?.colorLabel).toBe('none');
    expect(node?.blendMode).toBe('normal');
  });
});
