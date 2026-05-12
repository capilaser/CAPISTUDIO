/**
 * Onda 11.A — Helper TS para o comando Rust `db_tx_execute`.
 *
 * Executa N queries atomicamente no MESMO `Transaction` SQLite (BEGIN→…→COMMIT
 * ou ROLLBACK no primeiro erro). Reusa o pool registrado pelo tauri-plugin-sql
 * via `DbInstances` público — ver `src-tauri/src/db_tx.rs` e ADR 017.
 *
 * Use isso (em vez de múltiplos `db.execute()`) quando:
 *   - escrever em duas ou mais tabelas que precisam permanecer consistentes
 *   - executar UPDATE + INSERT que representam uma única operação lógica
 *   - dados duplicados/denormalizados que devem se manter em sincronia
 *
 * Caso de uso original (Onda 11):
 *   - UPDATE em `orders` (última revisão denormalizada)
 *   - INSERT em `order_revisions` (snapshot imutável)
 */
import { invoke } from '@tauri-apps/api/core';

/** Valor primitivo bindável. Subset intencional: null/bool/number/string. */
export type TxParam = null | boolean | number | string;

export interface TxQuery {
  sql: string;
  params?: TxParam[];
}

export interface TxResult {
  /** rowsAffected por query, na ordem da entrada. */
  rowsAffected: number[];
}

/**
 * Erro tipado retornado pelo comando Rust. `queryIndex` aponta o índice 0-based
 * da query que falhou na lista. `message` carrega o texto do sqlx (FK, UNIQUE,
 * etc) ou indicação clara de BEGIN/COMMIT falhando.
 */
export class TransactionError extends Error {
  readonly queryIndex: number;

  constructor(queryIndex: number, message: string) {
    super(`tx query[${queryIndex}]: ${message}`);
    this.name = 'TransactionError';
    this.queryIndex = queryIndex;
  }
}

const DB_URL = 'sqlite:capi-studio.db';

/**
 * Executa queries em transação atômica. Throws `TransactionError` com o
 * `queryIndex` da query que falhou se algo abortar — todas as queries
 * anteriores sofrem rollback.
 *
 * Sucesso: retorna `rowsAffected` na mesma ordem das queries.
 */
export async function executeTransaction(queries: TxQuery[]): Promise<TxResult> {
  if (queries.length === 0) {
    return { rowsAffected: [] };
  }

  try {
    const result = await invoke<{ rows_affected: number[] }>('db_tx_execute', {
      db: DB_URL,
      queries: queries.map((q) => ({ sql: q.sql, params: q.params ?? [] })),
    });
    return { rowsAffected: result.rows_affected };
  } catch (raw) {
    // O comando Rust retorna `TxError { query_index, message }` serializado.
    // Tauri propaga via reject como objeto plain JS — desempacotamos aqui.
    if (typeof raw === 'object' && raw !== null && 'query_index' in raw && 'message' in raw) {
      const e = raw as { query_index: number; message: string };
      throw new TransactionError(e.query_index, e.message);
    }
    // Fallback: erro inesperado (canal de invoke quebrado, etc).
    throw new TransactionError(-1, typeof raw === 'string' ? raw : JSON.stringify(raw));
  }
}
