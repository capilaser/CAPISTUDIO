import { describe, expect, it } from 'vitest';

import {
  composeDragLine,
  composeResizeLine,
  formatDeltaMm,
  formatMm,
} from '@/core/canvas/format-metrics';

describe('formatMm', () => {
  it('formata com 1 casa decimal e sufixo mm', () => {
    expect(formatMm(12.34)).toBe('12.3 mm');
  });

  it('arredonda inteiro para 1 casa', () => {
    expect(formatMm(0)).toBe('0.0 mm');
    expect(formatMm(7)).toBe('7.0 mm');
  });

  it('arredonda valor negativo preservando sinal', () => {
    expect(formatMm(-2.5)).toBe('-2.5 mm');
  });
});

describe('formatDeltaMm', () => {
  it('sinal positivo explícito em valores positivos', () => {
    expect(formatDeltaMm(2.13)).toBe('+2.1');
  });

  it('sinal negativo em valores negativos', () => {
    expect(formatDeltaMm(-1.96)).toBe('-2.0');
  });

  it('zero exato vira "+0.0" (sinal positivo por convenção)', () => {
    expect(formatDeltaMm(0)).toBe('+0.0');
  });

  it('valor muito pequeno negativo arredonda pra "-0.0" — cosmético aceito', () => {
    // Documentado no ADR 019 §6: sinal mostra que houve direção do gesto.
    expect(formatDeltaMm(-0.04)).toBe('-0.0');
  });

  it('1 casa decimal preservada em valor preciso', () => {
    expect(formatDeltaMm(3.14159)).toBe('+3.1');
  });
});

describe('composeDragLine', () => {
  it('mostra só posição absoluta quando deltas estão ausentes', () => {
    expect(composeDragLine(12.3, 8.1)).toBe('x: 12.3 mm   y: 8.1 mm');
  });

  it('mostra posição + deltas quando ambos fornecidos', () => {
    expect(composeDragLine(12.3, 8.1, 2.1, 0.4)).toBe(
      'x: 12.3 mm   y: 8.1 mm   Δx: +2.1   Δy: +0.4'
    );
  });

  it('formata deltas negativos com sinal', () => {
    expect(composeDragLine(10, 5, -1.5, -0.2)).toBe('x: 10.0 mm   y: 5.0 mm   Δx: -1.5   Δy: -0.2');
  });

  it('arredonda corretamente em todas as partes', () => {
    expect(composeDragLine(12.34, 8.16, 2.13, 0.44)).toBe(
      'x: 12.3 mm   y: 8.2 mm   Δx: +2.1   Δy: +0.4'
    );
  });
});

describe('composeResizeLine', () => {
  it('mostra w/h com 1 casa decimal', () => {
    expect(composeResizeLine(25.0, 12.0)).toBe('w: 25.0 mm   h: 12.0 mm');
  });

  it('arredonda dimensões', () => {
    expect(composeResizeLine(25.06, 12.03)).toBe('w: 25.1 mm   h: 12.0 mm');
  });

  it('aceita zero', () => {
    expect(composeResizeLine(0, 0)).toBe('w: 0.0 mm   h: 0.0 mm');
  });
});
