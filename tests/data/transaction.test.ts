/**
 * Onda 11.A — Testes do helper TS executeTransaction.
 *
 * Mocka `invoke` do Tauri — o comando Rust `db_tx_execute` tem seus próprios
 * unit tests em src-tauri/src/db_tx.rs (cargo test). Estes testes cobrem:
 *   - payload correto ({db, queries: [{sql, params}]})
 *   - tradução do TxError serializado em TransactionError tipado
 *   - early-return em queries vazias
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

beforeEach(() => {
  invoke.mockReset();
});

describe('executeTransaction', () => {
  it('invoca db_tx_execute com payload correto', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [1, 1] });

    const { executeTransaction } = await import('@/data/transaction');

    const result = await executeTransaction([
      { sql: 'INSERT INTO a VALUES (?)', params: ['x'] },
      { sql: 'INSERT INTO b VALUES (?, ?)', params: ['y', 42] },
    ]);

    expect(invoke).toHaveBeenCalledWith('db_tx_execute', {
      db: 'sqlite:capi-studio.db',
      queries: [
        { sql: 'INSERT INTO a VALUES (?)', params: ['x'] },
        { sql: 'INSERT INTO b VALUES (?, ?)', params: ['y', 42] },
      ],
    });
    expect(result.rowsAffected).toEqual([1, 1]);
  });

  it('default de params vazio quando omitido', async () => {
    invoke.mockResolvedValueOnce({ rows_affected: [0] });

    const { executeTransaction } = await import('@/data/transaction');

    await executeTransaction([{ sql: 'DELETE FROM a' }]);

    const [, payload] = invoke.mock.calls[0] as [string, { queries: Array<{ params: unknown[] }> }];
    expect(payload.queries[0].params).toEqual([]);
  });

  it('early-return sem invocar comando quando lista vazia', async () => {
    const { executeTransaction } = await import('@/data/transaction');

    const result = await executeTransaction([]);

    expect(invoke).not.toHaveBeenCalled();
    expect(result.rowsAffected).toEqual([]);
  });

  it('traduz TxError do Rust em TransactionError tipado', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 1,
      message: 'FOREIGN KEY constraint failed',
    });

    const { executeTransaction, TransactionError } = await import('@/data/transaction');

    await expect(
      executeTransaction([
        { sql: 'INSERT INTO a VALUES (?)', params: ['x'] },
        { sql: 'INSERT INTO b VALUES (?)', params: ['ghost'] },
      ])
    ).rejects.toMatchObject({
      name: 'TransactionError',
      queryIndex: 1,
    });

    invoke.mockRejectedValueOnce({
      query_index: 1,
      message: 'FOREIGN KEY constraint failed',
    });

    await expect(
      executeTransaction([
        { sql: 'INSERT INTO a VALUES (?)' },
        { sql: 'INSERT INTO b VALUES (?)', params: ['ghost'] },
      ])
    ).rejects.toBeInstanceOf(TransactionError);
  });

  it('mensagem do TransactionError inclui sql index e texto original', async () => {
    invoke.mockRejectedValueOnce({
      query_index: 2,
      message: 'UNIQUE constraint failed: order_revisions.order_id, order_revisions.number',
    });

    const { executeTransaction } = await import('@/data/transaction');

    await expect(
      executeTransaction([{ sql: 'q0' }, { sql: 'q1' }, { sql: 'q2' }])
    ).rejects.toThrowError(/query\[2\].*UNIQUE/);
  });

  it('erro não estruturado vira TransactionError com queryIndex=-1', async () => {
    invoke.mockRejectedValueOnce('canal de invoke quebrado');

    const { executeTransaction } = await import('@/data/transaction');

    await expect(executeTransaction([{ sql: 'q' }])).rejects.toMatchObject({
      queryIndex: -1,
    });
  });
});
