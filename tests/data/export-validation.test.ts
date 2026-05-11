/**
 * Testes do helper compartilhado _export-validation (Onda 9, Fase 9A.2).
 *
 * Garantem que apliques/gravações/markings rejeitem em runtime valores
 * inválidos de operation/machines antes de chegarem ao motor de exportação.
 */
import { describe, expect, it } from 'vitest';

import {
  VALID_OPERATIONS,
  assertValidMachines,
  assertValidOperation,
  isValidOperation,
} from '@/data/repositories/_export-validation';

describe('_export-validation', () => {
  describe('isValidOperation', () => {
    it('aceita as três operações do catálogo', () => {
      for (const op of VALID_OPERATIONS) {
        expect(isValidOperation(op)).toBe(true);
      }
    });

    it('rejeita strings desconhecidas, números, null e undefined', () => {
      expect(isValidOperation('foo')).toBe(false);
      expect(isValidOperation('')).toBe(false);
      expect(isValidOperation('CORTE')).toBe(false); // case-sensitive
      expect(isValidOperation(42)).toBe(false);
      expect(isValidOperation(null)).toBe(false);
      expect(isValidOperation(undefined)).toBe(false);
    });
  });

  describe('assertValidOperation', () => {
    it('não lança para operações válidas', () => {
      expect(() => assertValidOperation('corte', 'ctx')).not.toThrow();
      expect(() => assertValidOperation('marcacao', 'ctx')).not.toThrow();
      expect(() => assertValidOperation('gravacao', 'ctx')).not.toThrow();
    });

    it('lança com o contexto informado em violação', () => {
      expect(() => assertValidOperation('xpto', 'appliqueRepository.create(abc)')).toThrow(
        /appliqueRepository\.create\(abc\)/
      );
      expect(() => assertValidOperation(null, 'ctx')).toThrow(/operation/);
    });
  });

  describe('assertValidMachines', () => {
    it('aceita arrays de 1 a 3 strings não-vazias', () => {
      expect(() => assertValidMachines(['fiber'], 'ctx')).not.toThrow();
      expect(() => assertValidMachines(['fiber', 'master-biro'], 'ctx')).not.toThrow();
      expect(() => assertValidMachines(['fiber', 'master-biro', 'due-laser'], 'ctx')).not.toThrow();
    });

    it('rejeita não-arrays', () => {
      expect(() => assertValidMachines('fiber', 'ctx')).toThrow(/array/);
      expect(() => assertValidMachines({ 0: 'fiber' }, 'ctx')).toThrow(/array/);
      expect(() => assertValidMachines(null, 'ctx')).toThrow(/array/);
    });

    it('rejeita array vazio ou com mais de 3 entries', () => {
      expect(() => assertValidMachines([], 'ctx')).toThrow(/1-3 entries/);
      expect(() => assertValidMachines(['a', 'b', 'c', 'd'], 'ctx')).toThrow(/1-3 entries/);
    });

    it('rejeita entries não-string ou vazias', () => {
      expect(() => assertValidMachines([''], 'ctx')).toThrow(/strings não-vazias/);
      expect(() => assertValidMachines(['fiber', ''], 'ctx')).toThrow(/strings não-vazias/);
      expect(() => assertValidMachines([123 as unknown as string], 'ctx')).toThrow(
        /strings não-vazias/
      );
    });

    it('inclui o contexto na mensagem de erro', () => {
      expect(() => assertValidMachines([], 'markingRepository.create(xyz)')).toThrow(
        /markingRepository\.create\(xyz\)/
      );
    });
  });
});
