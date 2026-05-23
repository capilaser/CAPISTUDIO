/**
 * Testes do mapeamento processo → cor DXF (ADR 020 §4, sub-onda DXF-1).
 *
 * Cores ancoradas no DXF de referência:
 *   - corte = 31 (1 entidade no real: contorno externo)
 *   - gravacao = 250 (66 entidades no real: texto + detalhes)
 *   - marcacao = 5 (convenção industrial; TBD por teste de máquina)
 */
import { describe, expect, it } from 'vitest';

import { DXF_PROCESS_COLOR, type DxfProcess, processColor } from '@/core/export/dxf-process-color';

describe('dxf-process-color — mapeamento ADR 020 §4', () => {
  it('corte → 31 (espelha contorno externo do DXF real)', () => {
    expect(processColor('corte')).toBe(31);
  });

  it('gravacao → 250 (espelha texto vetorizado do DXF real)', () => {
    expect(processColor('gravacao')).toBe(250);
  });

  it('marcacao → 5 (convenção industrial — TBD validação de máquina)', () => {
    expect(processColor('marcacao')).toBe(5);
  });

  it('DXF_PROCESS_COLOR cobre exatamente os 3 processos do sistema', () => {
    const keys = Object.keys(DXF_PROCESS_COLOR).sort();
    expect(keys).toEqual(['corte', 'gravacao', 'marcacao']);
  });

  it('cores são números inteiros válidos para código DXF 62 (ACI 0-256)', () => {
    for (const process of ['corte', 'gravacao', 'marcacao'] as DxfProcess[]) {
      const color = processColor(process);
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(256);
    }
  });

  it('cores 31 e 250 não colidem (corte ≠ gravacao)', () => {
    expect(processColor('corte')).not.toBe(processColor('gravacao'));
    expect(processColor('corte')).not.toBe(processColor('marcacao'));
    expect(processColor('gravacao')).not.toBe(processColor('marcacao'));
  });
});
