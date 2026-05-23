/**
 * Testes do slot-content-promoter (Onda 35).
 *
 * Função pura sobre pares (content, body) + array de layers. Cobre:
 *   - Flip de excludeFromExport durante callback, restore no finally.
 *   - Injeção de id capi temporário, restore no finally.
 *   - Layer sintética com parentLayerId = capiSlot.id da AREA pai.
 *   - Propagação de exceção e idempotência.
 */
import { describe, expect, it } from 'vitest';

import {
  withSlotContentExportable,
  type SlotContentEntry,
} from '@/core/export/slot-content-promoter';
import type { LayerMeta, VisualLayerMeta } from '@/data/schema';

function makeEntry(
  contentOverrides: Partial<{ excludeFromExport: boolean; id: string }>,
  slotId = 'slot-1'
): SlotContentEntry {
  return {
    content: {
      ...(contentOverrides.excludeFromExport !== undefined && {
        excludeFromExport: contentOverrides.excludeFromExport,
      }),
      ...(contentOverrides.id !== undefined && { id: contentOverrides.id }),
    },
    body: { capiSlot: { id: slotId } },
  };
}

function visualLayer(id: string, overrides: Partial<VisualLayerMeta> = {}): VisualLayerMeta {
  return {
    kind: 'visual',
    id,
    parentLayerId: null,
    name: id,
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    ...overrides,
  };
}

describe('withSlotContentExportable (Onda 35)', () => {
  it('flipa excludeFromExport para false durante o callback', async () => {
    const entry = makeEntry({ excludeFromExport: true });
    let observed: boolean | undefined;
    await withSlotContentExportable([entry], [], async () => {
      observed = entry.content.excludeFromExport;
    });
    expect(observed).toBe(false);
  });

  it('restaura excludeFromExport=true após o callback retornar', async () => {
    const entry = makeEntry({ excludeFromExport: true });
    await withSlotContentExportable([entry], [], async () => {});
    expect(entry.content.excludeFromExport).toBe(true);
  });

  it('restaura mesmo se o callback lança', async () => {
    const entry = makeEntry({ excludeFromExport: true });
    const err = new Error('boom');
    await expect(
      withSlotContentExportable([entry], [], async () => {
        throw err;
      })
    ).rejects.toBe(err);
    expect(entry.content.excludeFromExport).toBe(true);
  });

  it('entries vazias → executa fn sem mexer em nada, layers = baseLayers (mesma referência)', async () => {
    const baseLayers: LayerMeta[] = [visualLayer('l1')];
    let observedLayers: LayerMeta[] | null = null;
    await withSlotContentExportable([], baseLayers, async ({ layers }) => {
      observedLayers = layers;
    });
    expect(observedLayers).toBe(baseLayers);
  });

  it('atribui id sintético derivado de capiSlot.id quando content não tem id', async () => {
    const entry = makeEntry({}, 'slot-XYZ');
    let observedId: string | undefined;
    await withSlotContentExportable([entry], [], async () => {
      observedId = entry.content.id;
    });
    expect(observedId).toBe('slot-XYZ__content');
  });

  it('preserva id pré-existente do content (não sobrescreve)', async () => {
    const entry = makeEntry({ id: 'preexistente' });
    let observedId: string | undefined;
    await withSlotContentExportable([entry], [], async () => {
      observedId = entry.content.id;
    });
    expect(observedId).toBe('preexistente');
    // E ao fim, mantém id pré-existente (não delete).
    expect(entry.content.id).toBe('preexistente');
  });

  it('remove id sintético após o callback (restore total)', async () => {
    const entry = makeEntry({});
    await withSlotContentExportable([entry], [], async () => {});
    expect(entry.content.id).toBeUndefined();
    expect('id' in entry.content).toBe(false);
  });

  it('injeta VisualLayerMeta sintética no array com parentLayerId = capiSlot.id', async () => {
    const entry = makeEntry({}, 'slot-A');
    const baseLayers: LayerMeta[] = [visualLayer('outra-layer')];
    let observedLayers: LayerMeta[] | null = null;
    await withSlotContentExportable([entry], baseLayers, async ({ layers }) => {
      observedLayers = layers;
    });
    expect(observedLayers).not.toBeNull();
    expect(observedLayers!.length).toBe(2);
    const synthetic = observedLayers![1];
    expect(synthetic.parentLayerId).toBe('slot-A');
    expect(synthetic.kind).toBe('visual');
    expect(synthetic.id).toBe('slot-A__content');
  });

  it('NÃO injeta entry sintética se body não tem capiSlot.id', async () => {
    const entry: SlotContentEntry = {
      content: { excludeFromExport: true },
      body: {}, // sem capiSlot
    };
    let observedLayers: LayerMeta[] | null = null;
    await withSlotContentExportable([entry], [], async ({ layers }) => {
      observedLayers = layers;
    });
    expect(observedLayers!.length).toBe(0);
  });

  it('NÃO muta o array de baseLayers original', async () => {
    const baseLayers: LayerMeta[] = [visualLayer('l1')];
    const entry = makeEntry({}, 'slot-A');
    await withSlotContentExportable([entry], baseLayers, async () => {});
    expect(baseLayers).toHaveLength(1); // mantém só o original
  });
});
