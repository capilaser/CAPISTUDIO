/**
 * Testes dos helpers de resumo de validação (Onda 37 Fix-2/Fix-3).
 *
 * `summarizeLayerValidation(layer, opts?)` — recebe LayerMeta inteiro.
 * `summarizeNodeValidation(nodeFields)` — recebe subset Onda 33 (do LayerNode).
 *
 * Ambos reusam validatePattern, então testes focam só nas categorias do
 * status (unclassified / ok / incomplete) e na escolha de mensagem.
 */
import { describe, expect, it } from 'vitest';

import {
  summarizeLayerValidation,
  summarizeNodeValidation,
} from '@/core/patterns/validate-pattern';
import type { VisualLayerMeta } from '@/data/schema';

function visual(overrides: Partial<VisualLayerMeta> = {}): VisualLayerMeta {
  return {
    kind: 'visual',
    id: 'v1',
    parentLayerId: null,
    name: 'visual-1',
    zIndex: 0,
    visible: true,
    locked: false,
    materialId: null,
    ...overrides,
  };
}

describe('summarizeLayerValidation (Onda 37 Fix-2)', () => {
  it('layer null → unclassified', () => {
    expect(summarizeLayerValidation(null)).toEqual({
      kind: 'unclassified',
      message: 'Sem classificação',
    });
  });

  it('layer sem patternRole → unclassified', () => {
    const result = summarizeLayerValidation(visual({}));
    expect(result.kind).toBe('unclassified');
  });

  it('layer completa (patternRole + processType + machineTargets válidos) → ok', () => {
    const result = summarizeLayerValidation(
      visual({
        patternRole: 'APPLIQUE',
        processType: 'corte',
        machineTargets: ['M1'],
      })
    );
    expect(result.kind).toBe('ok');
    expect(result.message).toBe('Pronta para produção');
  });

  it('TEXT_AREA classificada mas sem boundsMm → incomplete', () => {
    const result = summarizeLayerValidation(
      visual({
        patternRole: 'TEXT_AREA',
        processType: 'gravacao',
        machineTargets: ['M2'],
      })
    );
    expect(result.kind).toBe('incomplete');
    expect(result.message).toMatch(/boundsMm|bounds/i);
  });

  it('CONTOUR sem processType → incomplete (mensagem cita processType)', () => {
    const result = summarizeLayerValidation(
      visual({
        patternRole: 'CONTOUR',
        machineTargets: ['M1'],
      })
    );
    expect(result.kind).toBe('incomplete');
    expect(result.message.toLowerCase()).toContain('processtype');
  });

  it('prioriza error sobre warning (machineTargets duplicado é warning, falta processo é error)', () => {
    const result = summarizeLayerValidation(
      visual({
        patternRole: 'APPLIQUE',
        // sem processType (error) E machineTargets duplicado (warning)
        machineTargets: ['M1', 'M1'],
      })
    );
    expect(result.kind).toBe('incomplete');
    // Primeira mensagem deve ser do error (MISSING_PROCESS_TYPE).
    expect(result.message.toLowerCase()).toContain('processtype');
  });
});

describe('summarizeNodeValidation (Onda 37 Fix-3)', () => {
  it('node sem patternRole → unclassified', () => {
    expect(summarizeNodeValidation({ id: 'x', name: 'X' })).toEqual({
      kind: 'unclassified',
      message: 'Sem classificação',
    });
  });

  it('node completo → ok', () => {
    const result = summarizeNodeValidation({
      id: 'x',
      name: 'X',
      patternRole: 'APPLIQUE',
      processType: 'corte',
      machineTargets: ['M1'],
    });
    expect(result.kind).toBe('ok');
  });

  it('node TEXT_AREA sem boundsMm → incomplete', () => {
    const result = summarizeNodeValidation({
      id: 'x',
      name: 'X',
      patternRole: 'TEXT_AREA',
      processType: 'gravacao',
      machineTargets: ['M2'],
    });
    expect(result.kind).toBe('incomplete');
  });

  it('node LOGO_AREA com boundsMm OK → ok', () => {
    const result = summarizeNodeValidation({
      id: 'x',
      name: 'X',
      patternRole: 'LOGO_AREA',
      processType: 'gravacao',
      machineTargets: ['M3'],
      boundsMm: { x: 0, y: 0, width: 10, height: 10 },
      fitMode: 'contain',
    });
    expect(result.kind).toBe('ok');
  });

  it('node APPLIQUE sem machineTargets → incomplete', () => {
    const result = summarizeNodeValidation({
      id: 'x',
      name: 'X',
      patternRole: 'APPLIQUE',
      processType: 'corte',
    });
    expect(result.kind).toBe('incomplete');
    expect(result.message.toLowerCase()).toContain('machine');
  });
});
