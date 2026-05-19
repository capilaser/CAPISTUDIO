import { describe, expect, it } from 'vitest';

import {
  MACHINE_CODES,
  MACHINE_CODE_TO_ID,
  MACHINE_ID_TO_CODE,
  MACHINE_LABEL,
  machineCodeToId,
  machineIdToCode,
} from '@/lib/machine-codes';

describe('machine-codes (Onda 33.D)', () => {
  // ── 1. Bijetividade ────────────────────────────────────────────────────────
  it('MACHINE_CODE_TO_ID e MACHINE_ID_TO_CODE sao bijetivos', () => {
    for (const code of MACHINE_CODES) {
      const id = MACHINE_CODE_TO_ID[code];
      expect(MACHINE_ID_TO_CODE[id]).toBe(code);
    }
  });

  // ── 2. Mapping spec → banco ────────────────────────────────────────────────
  it('machineCodeToId: M1→master-biro, M2→fiber-laser, M3→due-laser', () => {
    expect(machineCodeToId('M1')).toBe('master-biro');
    expect(machineCodeToId('M2')).toBe('fiber-laser');
    expect(machineCodeToId('M3')).toBe('due-laser');
  });

  // ── 3. Mapping banco → spec ────────────────────────────────────────────────
  it('machineIdToCode: master-biro→M1, fiber-laser→M2, due-laser→M3', () => {
    expect(machineIdToCode('master-biro')).toBe('M1');
    expect(machineIdToCode('fiber-laser')).toBe('M2');
    expect(machineIdToCode('due-laser')).toBe('M3');
  });

  // ── 4. Id desconhecido retorna undefined (graceful) ────────────────────────
  it('machineIdToCode retorna undefined para id desconhecido', () => {
    expect(machineIdToCode('plotter-2030')).toBeUndefined();
    expect(machineIdToCode('')).toBeUndefined();
  });

  // ── 5. Labels humanos disponiveis ──────────────────────────────────────────
  it('MACHINE_LABEL tem entrada para cada MachineCode', () => {
    for (const code of MACHINE_CODES) {
      expect(MACHINE_LABEL[code]).toBeTruthy();
      expect(MACHINE_LABEL[code].length).toBeGreaterThan(2);
    }
  });
});
