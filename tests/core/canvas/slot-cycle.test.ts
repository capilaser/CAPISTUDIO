import { describe, expect, it } from 'vitest';

import { cycleSlotIndex } from '@/core/canvas/slot-cycle';

describe('cycleSlotIndex', () => {
  it('retorna -1 quando não há slots', () => {
    expect(cycleSlotIndex(-1, 0, 'forward')).toBe(-1);
    expect(cycleSlotIndex(-1, 0, 'backward')).toBe(-1);
    expect(cycleSlotIndex(0, 0, 'forward')).toBe(-1);
  });

  describe('partindo de "nada selecionado" (current = -1)', () => {
    it('forward foca o primeiro slot', () => {
      expect(cycleSlotIndex(-1, 3, 'forward')).toBe(0);
    });

    it('backward foca o último slot', () => {
      expect(cycleSlotIndex(-1, 3, 'backward')).toBe(2);
    });
  });

  describe('avança forward', () => {
    it('vai do índice 0 ao 1', () => {
      expect(cycleSlotIndex(0, 3, 'forward')).toBe(1);
    });

    it('vai do meio ao próximo', () => {
      expect(cycleSlotIndex(1, 3, 'forward')).toBe(2);
    });

    it('wrap-around do último ao primeiro', () => {
      expect(cycleSlotIndex(2, 3, 'forward')).toBe(0);
    });
  });

  describe('volta backward', () => {
    it('vai do índice 2 ao 1', () => {
      expect(cycleSlotIndex(2, 3, 'backward')).toBe(1);
    });

    it('vai do meio ao anterior', () => {
      expect(cycleSlotIndex(1, 3, 'backward')).toBe(0);
    });

    it('wrap-around do primeiro ao último', () => {
      expect(cycleSlotIndex(0, 3, 'backward')).toBe(2);
    });
  });

  describe('current fora do range trata como nada selecionado', () => {
    it('forward com current >= total → 0', () => {
      expect(cycleSlotIndex(5, 3, 'forward')).toBe(0);
    });

    it('backward com current >= total → último', () => {
      expect(cycleSlotIndex(99, 3, 'backward')).toBe(2);
    });

    it('forward com current = -2 (proteção) → 0', () => {
      expect(cycleSlotIndex(-2, 3, 'forward')).toBe(0);
    });
  });

  describe('edge case: 1 slot só', () => {
    it('forward fica no mesmo (wrap)', () => {
      expect(cycleSlotIndex(0, 1, 'forward')).toBe(0);
    });

    it('backward fica no mesmo (wrap)', () => {
      expect(cycleSlotIndex(0, 1, 'backward')).toBe(0);
    });
  });
});
