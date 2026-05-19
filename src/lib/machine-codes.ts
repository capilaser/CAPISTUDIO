/**
 * machine-codes.ts — Single source-of-truth para o mapping entre
 * MachineCode da spec (M1/M2/M3) e machineId do banco (master-biro /
 * fiber-laser / due-laser). Onda 33.D.
 *
 * Por que existe:
 * - A spec de templates inteligentes ("AREAs", processType, machineTargets)
 *   fala em M1/M2/M3 — vocabulário curto, simples pra UI e pra docs.
 * - O banco e os exporters (svg-exporter, dxf-exporter, asset-lookup)
 *   usam os IDs longos cadastrados na tabela `machines` desde Onda 6.
 * - Sem este arquivo, a tradução ficaria espalhada em N callsites e
 *   viraria um drift silencioso (igual ao `operations` SQL vs
 *   VALID_OPERATIONS do `_export-validation`).
 *
 * Onda 33 só armazena códigos M1/M2/M3 em canvasJson.capi.layers.
 * Onda 40 (export) chama os helpers daqui para traduzir.
 */

import type { MachineCode } from '@/data/schema';

/** Mapeamento canônico MachineCode → machineId do banco. */
export const MACHINE_CODE_TO_ID: Readonly<Record<MachineCode, string>> = {
  M1: 'master-biro',
  M2: 'fiber-laser',
  M3: 'due-laser',
} as const;

/** Inverso de MACHINE_CODE_TO_ID. Mantido como const explícita pra autocomplete. */
export const MACHINE_ID_TO_CODE: Readonly<Record<string, MachineCode>> = {
  'master-biro': 'M1',
  'fiber-laser': 'M2',
  'due-laser': 'M3',
} as const;

/** Lista ordenada (útil para checkboxes UI). */
export const MACHINE_CODES: readonly MachineCode[] = ['M1', 'M2', 'M3'] as const;

/**
 * Rótulo humano pra mostrar na UI ao lado do código curto.
 * Operador conhece os nomes legados; spec fala em M1/M2/M3. Show ambos.
 */
export const MACHINE_LABEL: Readonly<Record<MachineCode, string>> = {
  M1: 'Master Biro',
  M2: 'Fiber Laser',
  M3: 'Due Laser',
} as const;

/**
 * Traduz código da spec para machineId do banco. Retorna undefined se
 * código inválido (não-MachineCode). Onda 40 (export) usa isto pra
 * rotear por máquina.
 */
export function machineCodeToId(code: MachineCode): string {
  return MACHINE_CODE_TO_ID[code];
}

/**
 * Traduz machineId do banco para código da spec. Retorna undefined se
 * id desconhecido (ex: máquina nova cadastrada no banco sem entry aqui).
 */
export function machineIdToCode(id: string): MachineCode | undefined {
  return MACHINE_ID_TO_CODE[id];
}
