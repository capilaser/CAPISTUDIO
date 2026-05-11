/**
 * Validações compartilhadas dos campos operation + machines (Onda 9).
 *
 * Apliques, gravações e marcações têm contratos idênticos:
 *   - operation ∈ { 'corte', 'marcacao', 'gravacao' }
 *   - machines = array de 1 a 3 ids (strings não-vazias)
 *
 * Repository do banco valida em runtime antes de gravar pra evitar dados
 * inválidos chegarem ao motor de exportação (que assume contrato).
 * TypeScript pega erros de tipagem, mas valores vindos do banco podem
 * estar inválidos (migration default, edição direta, etc).
 */

/** Operações de produção válidas. */
export const VALID_OPERATIONS = ['corte', 'marcacao', 'gravacao'] as const;
export type Operation = (typeof VALID_OPERATIONS)[number];

export function isValidOperation(op: unknown): op is Operation {
  return typeof op === 'string' && (VALID_OPERATIONS as readonly string[]).includes(op);
}

/**
 * Valida que `machines` é um array de 1-3 ids string não-vazios.
 * Lança Error com mensagem específica em violação.
 */
export function assertValidMachines(
  machines: unknown,
  context: string
): asserts machines is string[] {
  if (!Array.isArray(machines)) {
    throw new Error(`[${context}] machines deve ser array, recebido: ${typeof machines}`);
  }
  if (machines.length < 1 || machines.length > 3) {
    throw new Error(`[${context}] machines deve ter 1-3 entries, recebido: ${machines.length}`);
  }
  for (const m of machines) {
    if (typeof m !== 'string' || m.length === 0) {
      throw new Error(
        `[${context}] machines deve conter strings não-vazias, recebido: ${JSON.stringify(m)}`
      );
    }
  }
}

/**
 * Valida operation. Lança Error com mensagem específica em violação.
 */
export function assertValidOperation(op: unknown, context: string): asserts op is Operation {
  if (!isValidOperation(op)) {
    throw new Error(
      `[${context}] operation deve ser uma de [${VALID_OPERATIONS.join(', ')}], recebido: ${JSON.stringify(op)}`
    );
  }
}
