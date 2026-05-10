/**
 * Teste de integração final da Onda 7b.
 *
 * Exercita a cadeia completa que falhou nos bugs Fix #1 e Fix #2 da Fase D:
 * slot dentro de aplique → resolve id capi corretamente → alinha em relação
 * ao pai imediato, NÃO ao canvas.
 *
 * Mockamos os objetos Fabric com plain objects (shape mínimo aceito por
 * `getCapiId`), evitando dependência de Fabric runtime / node-canvas. A
 * cadeia testada é a que vive em produção:
 *
 *   getCapiId(obj) → engine.getParentBoundsForObject (semantics) →
 *   applyAlignment com parentBounds = aplique → resultado = centro do
 *   aplique (não do canvas)
 *
 * O caso reverso (slot direto na placa) também é coberto: parentBounds =
 * canvas → resultado = centro do canvas.
 *
 * Refs: Onda 7b Fix #1 (commit 9713f3b), Fix #2 (db84315).
 */
import { describe, expect, it } from 'vitest';

import { applyAlignment } from '@/core/canvas/alignment/alignment-commands';
import type { RectMm } from '@/core/canvas/alignment/snap-targets';
import { getCapiId } from '@/core/canvas/capi-id';

// Placa-300x90 (real do MVP).
const CANVAS: RectMm = { left: 0, top: 0, width: 300, height: 90 };

describe('Onda 7b — integração final: slot dentro de aplique', () => {
  it('resolve id do slot via capiSlot.id (Fix #1), alinha em relação ao aplique (não canvas)', () => {
    // SETUP — simula a estrutura real:
    // - aplique: objeto Fabric com `id` direto (rect, principal layer)
    // - slot:    body do slot que tem `capiSlot: { id }`, NÃO tem `id` próprio
    //   (slot-manager nunca seta `body.id` — esse é o ponto do Fix #1)
    const aplique = { id: 'aplique-1' } as Record<string, unknown>;
    const slot = {
      // sem `id` próprio
      capiSlot: { id: 'slot-1' },
    } as Record<string, unknown>;

    // PASSO 1 — getCapiId resolve corretamente ambos os caminhos.
    expect(getCapiId(aplique)).toBe('aplique-1');
    expect(getCapiId(slot)).toBe('slot-1');

    // PASSO 2 — antes do Fix #1, aqui era onde o caller fazia `obj.id` e
    // recebia undefined pra slot, caindo pra canvas. Hoje getCapiId é a
    // abstração canônica e isso é impossível.

    // PASSO 3 — geometria: aplique posicionado no centro da placa,
    // slot pequeno dentro do aplique, deslocado da posição central do aplique.
    const appliqueRect: RectMm = { left: 100, top: 20, width: 100, height: 50 };
    const slotRect: RectMm = { left: 110, top: 25, width: 30, height: 10 };

    // PASSO 4 — Fix #2: slot foi criado com parentLayerId = aplique.id,
    // então engine.getParentBoundsForObject(slot.id) retornaria appliqueRect.
    // Aqui simulamos esse passo direto (testar o engine real exige Fabric runtime).
    const parentBounds = appliqueRect;

    // PASSO 5 — aplica alignCenterH com parentBounds = aplique.
    // Esperado: centro X do slot vai pro centro X do aplique (não do canvas).
    const [centeredHorizontally] = applyAlignment('alignCenterH', [slotRect], parentBounds);

    // Centro do aplique: 100 + 100/2 = 150. Slot width 30 → left = 150 - 15 = 135.
    expect(centeredHorizontally.left).toBe(135);
    expect(centeredHorizontally.top).toBe(slotRect.top); // top intacto
    expect(centeredHorizontally.width).toBe(slotRect.width);
    expect(centeredHorizontally.height).toBe(slotRect.height);

    // PASSO 6 — bug pré-Fix #1 era equivalente a: parentBounds = canvas.
    // Confirma que daria resultado DIFERENTE (left = 135 vs 150 - 15 = 135?).
    // Atenção: canvas centro X = 150, mesmo do aplique nesta fixture.
    // Deslocamos o aplique pra um centro diferente do canvas pra deixar
    // o teste sensível à diferença.
    const appliqueOffCenter: RectMm = { left: 50, top: 20, width: 100, height: 50 };
    // Centro do aplique off-center: 50 + 50 = 100.
    const [centeredInOffApplique] = applyAlignment('alignCenterH', [slotRect], appliqueOffCenter);
    expect(centeredInOffApplique.left).toBe(100 - 15); // 85

    // Mesmo slot alinhado ao canvas inteiro (cenário do bug):
    const [centeredInCanvas] = applyAlignment('alignCenterH', [slotRect], CANVAS);
    expect(centeredInCanvas.left).toBe(150 - 15); // 135

    // 85 ≠ 135 — confirma que a escolha de parentBounds altera o resultado.
    // Esse é exatamente o bug que Fix #1 + Fix #2 corrigiram juntos.
    expect(centeredInOffApplique.left).not.toBe(centeredInCanvas.left);
  });

  it('cenário reverso: slot direto na placa → parentBounds = canvas → centraliza no canvas', () => {
    // Slot solto, sem aplique pai. parentLayerId = null no LayerMeta →
    // engine.getParentBoundsForObject retorna null → caller usa canvas como
    // referenceBounds (fallback documentado em ADR 014 §6).
    const slot = { capiSlot: { id: 'slot-solto' } } as Record<string, unknown>;
    expect(getCapiId(slot)).toBe('slot-solto');

    const slotRect: RectMm = { left: 10, top: 10, width: 40, height: 20 };
    // Sem pai — caller passa CANVAS como referenceBounds.
    const [centered] = applyAlignment('alignCenterH', [slotRect], CANVAS);
    // Centro do canvas: 150. left = 150 - 20 = 130.
    expect(centered.left).toBe(130);
  });

  it('verifica que alinhar TOPO de slot dentro de aplique posiciona em aplique.top', () => {
    // Cenário pragmático do MVP: nome (slot) na borda superior da área do
    // aplique. Esperado: slot.top = aplique.top.
    const aplique: RectMm = { left: 100, top: 20, width: 100, height: 50 };
    const slot: RectMm = { left: 110, top: 40, width: 30, height: 10 };

    const [aligned] = applyAlignment('alignTop', [slot], aplique);
    expect(aligned.top).toBe(20); // = aplique.top
    expect(aligned.left).toBe(slot.left); // X intacto
  });
});
