/**
 * Testes da bridge AREA → capiSlot (Onda 34).
 *
 * Função pura, sem Fabric, sem DOM. Cada teste monta um JSON sintético no
 * shape de SerializedCanvas (capi.layers + objects) e verifica a mutação.
 */
import { describe, expect, it } from 'vitest';

import {
  bridgePatternAreasToSlots,
  pickTextSlotType,
  type PatternJsonForBridge,
} from '@/core/canvas/pattern-area-bridge';
import type { LayerBoundsMm, LayerLocks, PatternRole, VisualLayerMeta } from '@/data/schema';
import type { SlotMeta } from '@/core/canvas/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeVisualLayer(
  id: string,
  patternRole?: PatternRole,
  boundsMm?: LayerBoundsMm,
  lockGranular?: LayerLocks
): VisualLayerMeta {
  return {
    kind: 'visual',
    id,
    parentLayerId: null,
    name: id,
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    patternRole,
    boundsMm,
    lockGranular,
  };
}

function makeObject(id: string, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    type: 'rect',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    scaleX: 1,
    scaleY: 1,
    ...extras,
  };
}

function getCapiSlot(obj: Record<string, unknown>): SlotMeta | undefined {
  const slot = obj.capiSlot;
  if (!slot || typeof slot !== 'object') return undefined;
  return slot as SlotMeta;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('pattern-area-bridge', () => {
  describe('pickTextSlotType', () => {
    it('mapeia 0/1/2+ para nome/profissao/custom', () => {
      expect(pickTextSlotType(0)).toBe('nome');
      expect(pickTextSlotType(1)).toBe('profissao');
      expect(pickTextSlotType(2)).toBe('custom');
      expect(pickTextSlotType(5)).toBe('custom');
    });
  });

  describe('bridgePatternAreasToSlots', () => {
    it('pattern sem layers → no-op', () => {
      const json: PatternJsonForBridge = { objects: [makeObject('o1')] };
      const result = bridgePatternAreasToSlots(json);
      expect(result).toEqual({ converted: 0, skippedExisting: 0, ignored: 0 });
      expect(json.objects[0].capiSlot).toBeUndefined();
    });

    it('pattern com objects vazios → no-op', () => {
      const json: PatternJsonForBridge = {
        objects: [],
        capi: {
          layers: [makeVisualLayer('l1', 'TEXT_AREA', { x: 1, y: 2, width: 30, height: 8 })],
        },
      };
      const result = bridgePatternAreasToSlots(json);
      expect(result.converted).toBe(0);
    });

    it('layers sem patternRole AREA são ignoradas', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: { layers: [makeVisualLayer('l1', 'CONTOUR')] },
      };
      bridgePatternAreasToSlots(json);
      expect(obj.capiSlot).toBeUndefined();
    });

    it('TEXT_AREA → capiSlot type nome (1º TEXT_AREA)', () => {
      const obj = makeObject('l1');
      const bounds: LayerBoundsMm = { x: 10, y: 5, width: 30, height: 8 };
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: { layers: [makeVisualLayer('l1', 'TEXT_AREA', bounds)] },
      };
      const result = bridgePatternAreasToSlots(json);

      expect(result.converted).toBe(1);
      const slot = getCapiSlot(obj)!;
      expect(slot.id).toBe('l1');
      expect(slot.type).toBe('nome');
      expect(slot.x).toBe(10);
      expect(slot.y).toBe(5);
      expect(slot.maxWidth).toBe(30);
      expect(slot.maxHeight).toBe(8);
      expect(slot.autoFit).toBe(true);
      expect(slot.autoCenter).toBe(true);
    });

    it('2º TEXT_AREA vira profissao, 3º vira custom', () => {
      const o1 = makeObject('a');
      const o2 = makeObject('b');
      const o3 = makeObject('c');
      const json: PatternJsonForBridge = {
        objects: [o1, o2, o3],
        capi: {
          layers: [
            makeVisualLayer('a', 'TEXT_AREA', { x: 0, y: 0, width: 30, height: 8 }),
            makeVisualLayer('b', 'TEXT_AREA', { x: 0, y: 10, width: 30, height: 6 }),
            makeVisualLayer('c', 'TEXT_AREA', { x: 0, y: 20, width: 30, height: 6 }),
          ],
        },
      };
      bridgePatternAreasToSlots(json);
      expect(getCapiSlot(o1)?.type).toBe('nome');
      expect(getCapiSlot(o2)?.type).toBe('profissao');
      expect(getCapiSlot(o3)?.type).toBe('custom');
    });

    it('LOGO_AREA → capiSlot type logo, autoFit=false', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [makeVisualLayer('l1', 'LOGO_AREA', { x: 2, y: 2, width: 12, height: 12 })],
        },
      };
      bridgePatternAreasToSlots(json);
      const slot = getCapiSlot(obj)!;
      expect(slot.type).toBe('logo');
      expect(slot.autoFit).toBe(false);
    });

    it('boundsMm ausente → ignora (sem crashar)', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: { layers: [makeVisualLayer('l1', 'TEXT_AREA', undefined)] },
      };
      const result = bridgePatternAreasToSlots(json);
      expect(result.ignored).toBe(1);
      expect(result.converted).toBe(0);
      expect(obj.capiSlot).toBeUndefined();
    });

    it('boundsMm com width=0 → ignora (defesa contra divisão por zero no fit)', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [makeVisualLayer('l1', 'TEXT_AREA', { x: 0, y: 0, width: 0, height: 5 })],
        },
      };
      const result = bridgePatternAreasToSlots(json);
      expect(result.ignored).toBe(1);
    });

    it('AREA sem object correspondente no array → ignora', () => {
      const json: PatternJsonForBridge = {
        objects: [makeObject('outro')],
        capi: {
          layers: [makeVisualLayer('l1', 'TEXT_AREA', { x: 0, y: 0, width: 30, height: 8 })],
        },
      };
      const result = bridgePatternAreasToSlots(json);
      expect(result.ignored).toBe(1);
    });

    it('idempotente: rodar 2x produz o mesmo capiSlot, sem duplicar', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [makeVisualLayer('l1', 'TEXT_AREA', { x: 5, y: 5, width: 30, height: 8 })],
        },
      };
      bridgePatternAreasToSlots(json);
      const first = { ...getCapiSlot(obj)! };
      const result2 = bridgePatternAreasToSlots(json);
      expect(result2.converted).toBe(0);
      expect(result2.skippedExisting).toBe(1);
      expect(getCapiSlot(obj)).toEqual(first);
    });

    it('pattern híbrido (capiSlot clássico + AREA) — bridge não duplica nem mexe no clássico', () => {
      const classicSlot: SlotMeta = {
        id: 'classico',
        type: 'nome',
        x: 1,
        y: 1,
        maxWidth: 20,
        maxHeight: 6,
        autoCenter: true,
        autoFit: true,
      };
      const classic = makeObject('classico', { capiSlot: classicSlot });
      const newArea = makeObject('nova');

      const json: PatternJsonForBridge = {
        objects: [classic, newArea],
        capi: {
          layers: [
            // O slot clássico não tem AREA na layer — só capiSlot no object.
            makeVisualLayer('classico'),
            makeVisualLayer('nova', 'TEXT_AREA', { x: 10, y: 10, width: 30, height: 8 }),
          ],
        },
      };
      bridgePatternAreasToSlots(json);

      expect(getCapiSlot(classic)).toEqual(classicSlot);
      const nova = getCapiSlot(newArea)!;
      // A heurística viu 1 TEXT_AREA até agora (a nova) — nome.
      expect(nova.type).toBe('nome');
    });

    it('AREA com capiSlot pré-existente conta no índice TEXT_AREA (não duplica heurística)', () => {
      // Cenário: pattern foi serializado JÁ COM a bridge aplicada (caminho
      // de pattern com capiSlot herdado). Bridge não deve recontar.
      const first = makeObject('a', {
        capiSlot: {
          id: 'a',
          type: 'nome',
          x: 0,
          y: 0,
          maxWidth: 30,
          maxHeight: 8,
          autoCenter: true,
          autoFit: true,
        } satisfies SlotMeta,
      });
      const second = makeObject('b');
      const json: PatternJsonForBridge = {
        objects: [first, second],
        capi: {
          layers: [
            makeVisualLayer('a', 'TEXT_AREA', { x: 0, y: 0, width: 30, height: 8 }),
            makeVisualLayer('b', 'TEXT_AREA', { x: 0, y: 10, width: 30, height: 6 }),
          ],
        },
      };
      bridgePatternAreasToSlots(json);
      // Primeira AREA já tinha capiSlot → skippedExisting, mas avança contador.
      // Segunda AREA é a "segunda" — vira profissao.
      expect(getCapiSlot(second)?.type).toBe('profissao');
    });

    it('locks position/scale propagados para o object; rotation sempre travada', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [
            makeVisualLayer(
              'l1',
              'TEXT_AREA',
              { x: 0, y: 0, width: 30, height: 8 },
              { position: true, scale: true }
            ),
          ],
        },
      };
      bridgePatternAreasToSlots(json);
      expect(obj.lockMovementX).toBe(true);
      expect(obj.lockMovementY).toBe(true);
      expect(obj.lockScalingX).toBe(true);
      expect(obj.lockScalingY).toBe(true);
      expect(obj.lockRotation).toBe(true);
    });

    it('AREA sem lockGranular: locks de movimento ficam false; rotation continua travada', () => {
      const obj = makeObject('l1');
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [makeVisualLayer('l1', 'LOGO_AREA', { x: 0, y: 0, width: 10, height: 10 })],
        },
      };
      bridgePatternAreasToSlots(json);
      expect(obj.lockMovementX).toBe(false);
      expect(obj.lockMovementY).toBe(false);
      expect(obj.lockScalingX).toBe(false);
      expect(obj.lockScalingY).toBe(false);
      expect(obj.lockRotation).toBe(true);
    });

    it('geometria do object é sincronizada com boundsMm (mm→px via MM_TO_PX=4)', () => {
      const obj = makeObject('l1', {
        left: 999, // valor sujo pré-existente
        top: 999,
        width: 1,
        height: 1,
        scaleX: 5,
        scaleY: 5,
      });
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: {
          layers: [makeVisualLayer('l1', 'TEXT_AREA', { x: 10, y: 5, width: 30, height: 8 })],
        },
      };
      bridgePatternAreasToSlots(json);
      expect(obj.left).toBe(40); // 10mm * 4
      expect(obj.top).toBe(20); // 5mm * 4
      expect(obj.width).toBe(120); // 30mm * 4
      expect(obj.height).toBe(32); // 8mm * 4
      expect(obj.scaleX).toBe(1);
      expect(obj.scaleY).toBe(1);
    });

    it('LayerMeta não é mutada — patternRole/boundsMm continuam intactos', () => {
      const obj = makeObject('l1');
      const layer = makeVisualLayer('l1', 'TEXT_AREA', { x: 0, y: 0, width: 30, height: 8 });
      const layerSnapshot = JSON.parse(JSON.stringify(layer));
      const json: PatternJsonForBridge = {
        objects: [obj],
        capi: { layers: [layer] },
      };
      bridgePatternAreasToSlots(json);
      expect(layer).toEqual(layerSnapshot);
    });
  });
});
