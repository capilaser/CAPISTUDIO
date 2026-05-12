// Onda 11.A — Transação atômica reusando o pool do tauri-plugin-sql.
//
// Por que existe: tauri-plugin-sql 2.x expõe apenas `db.execute(query, params)`
// single-statement via sqlx::query (prepared statement). Chamadas separadas de
// BEGIN/INSERT/INSERT/COMMIT pegam conexões diferentes do pool → não atômico
// (bug confirmado em https://github.com/tauri-apps/plugins-workspace/issues/886).
//
// Solução: reusa o `SqlitePool` interno via `DbInstances` (pub desde PR #1381)
// e roda múltiplas queries no MESMO `Transaction`. Atomicidade real, sem 2º
// pool, sem cache duplicado, sem footgun WAL. Ver ADR 017.
//
// Reuso pretendido:
// - Onda 11: orders + order_revisions na mesma tx.
// - Onda 12: orders.status + orders.approved_revision_id + order_revisions.is_approved.
// - Ondas futuras: qualquer write multi-tabela que exija invariante atômica.

use serde::{Deserialize, Serialize};
use sqlx::{Arguments, sqlite::SqliteArguments};
use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};

/// Valor primitivo bindável em uma query SQL. Subset intencional de JSON:
/// null/bool/number/string. Bytes não são suportados nesta versão — adicionar
/// se aparecer caso de uso real (não especular).
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum TxValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
}

#[derive(Debug, Deserialize)]
pub struct TxQuery {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<TxValue>,
}

#[derive(Debug, Serialize)]
pub struct TxResult {
    /// rowsAffected por query, na mesma ordem da entrada.
    pub rows_affected: Vec<u64>,
}

/// Erro tipado: query_index aponta qual entrada da lista falhou (0-based).
/// Mensagem inclui texto do sqlx pra debugging.
#[derive(Debug, Serialize)]
pub struct TxError {
    pub query_index: usize,
    pub message: String,
}

impl std::fmt::Display for TxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "db_tx_execute: query[{}] failed: {}",
            self.query_index, self.message
        )
    }
}

impl std::error::Error for TxError {}

// `tauri::command` precisa de Result<_, X> onde X: Serialize. TxError já é.
#[tauri::command]
pub async fn db_tx_execute(
    app: tauri::AppHandle,
    db: String,
    queries: Vec<TxQuery>,
) -> Result<TxResult, TxError> {
    let pool = resolve_pool(&app, &db).await.map_err(|m| TxError {
        query_index: 0,
        message: m,
    })?;

    run_tx(&pool, queries).await
}

/// Resolve o `SqlitePool` registrado pelo tauri-plugin-sql para `db_url`.
/// Retorna erro se o db não foi carregado (Database.load(...) ainda não rodou)
/// ou se o pool não é Sqlite.
async fn resolve_pool(app: &tauri::AppHandle, db_url: &str) -> Result<sqlx::SqlitePool, String> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(db_url) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        // Compilamos só com feature `sqlite` → `Some(_)` é inalcançável hoje;
        // mantemos por robustez se `features = ["mysql"|"postgres"]` for
        // adicionada no futuro.
        #[allow(unreachable_patterns)]
        Some(_) => Err(format!("db `{}` is not a SQLite pool", db_url)),
        None => Err(format!(
            "db `{}` not loaded — call Database.load() first",
            db_url
        )),
    }
}

/// Núcleo testável: dado um pool sqlx, executa as queries em uma transação.
/// Isolado de Tauri para permitir teste unitário em Rust com pool in-memory.
pub async fn run_tx(
    pool: &sqlx::SqlitePool,
    queries: Vec<TxQuery>,
) -> Result<TxResult, TxError> {
    let mut tx = pool.begin().await.map_err(|e| TxError {
        query_index: 0,
        message: format!("BEGIN failed: {}", e),
    })?;

    let mut rows_affected: Vec<u64> = Vec::with_capacity(queries.len());

    for (idx, q) in queries.iter().enumerate() {
        let mut args = SqliteArguments::default();
        for v in &q.params {
            let bind_result = match v {
                TxValue::Null => args.add(Option::<String>::None),
                TxValue::Bool(b) => args.add(*b),
                TxValue::Int(i) => args.add(*i),
                TxValue::Float(f) => args.add(*f),
                TxValue::Text(s) => args.add(s.clone()),
            };
            if let Err(e) = bind_result {
                // Rollback explícito (drop também faz, mas explícito é mais claro).
                let _ = tx.rollback().await;
                return Err(TxError {
                    query_index: idx,
                    message: format!("bind failed: {}", e),
                });
            }
        }

        let result = sqlx::query_with(&q.sql, args)
            .execute(&mut *tx)
            .await
            .map_err(|e| TxError {
                query_index: idx,
                message: format!("execute failed: {}", e),
            });

        match result {
            Ok(r) => rows_affected.push(r.rows_affected()),
            Err(err) => {
                let _ = tx.rollback().await;
                return Err(err);
            }
        }
    }

    tx.commit().await.map_err(|e| TxError {
        query_index: queries.len().saturating_sub(1),
        message: format!("COMMIT failed: {}", e),
    })?;

    Ok(TxResult { rows_affected })
}

// ── Unit tests (cargo test --lib) ────────────────────────────────────────────
//
// Roda em pool sqlite in-memory, sem Tauri. Cobre:
//   1. happy path — 2 inserts atômicos commitam, rows_affected correto.
//   2. failure path — 2º insert com FK inválida → 1º insert sofre rollback.
#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(":memory:")
            .await
            .expect("in-memory pool");

        // FK enforcement OFF por default no SQLite — precisa do PRAGMA pra
        // teste de FK violation rolar.
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query(
            "CREATE TABLE parent (id TEXT PRIMARY KEY, name TEXT NOT NULL)",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "CREATE TABLE child (
                id TEXT PRIMARY KEY,
                parent_id TEXT NOT NULL REFERENCES parent(id),
                value TEXT
             )",
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn happy_path_two_inserts_commit() {
        let pool = setup_pool().await;

        let queries = vec![
            TxQuery {
                sql: "INSERT INTO parent (id, name) VALUES (?, ?)".into(),
                params: vec![TxValue::Text("p1".into()), TxValue::Text("Alice".into())],
            },
            TxQuery {
                sql: "INSERT INTO child (id, parent_id, value) VALUES (?, ?, ?)".into(),
                params: vec![
                    TxValue::Text("c1".into()),
                    TxValue::Text("p1".into()),
                    TxValue::Text("hello".into()),
                ],
            },
        ];

        let result = run_tx(&pool, queries).await.expect("commit");
        assert_eq!(result.rows_affected, vec![1, 1]);

        let parent_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM parent WHERE id = 'p1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(parent_count.0, 1, "parent persisted");

        let child_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM child WHERE id = 'c1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(child_count.0, 1, "child persisted");
    }

    #[tokio::test]
    async fn fk_violation_rollbacks_first_insert() {
        let pool = setup_pool().await;

        // 2º insert aponta pra parent_id 'ghost' que não existe → FK violation
        // (que com foreign_keys=ON gera erro). Esperado: 1º insert é desfeito.
        let queries = vec![
            TxQuery {
                sql: "INSERT INTO parent (id, name) VALUES (?, ?)".into(),
                params: vec![TxValue::Text("p2".into()), TxValue::Text("Bob".into())],
            },
            TxQuery {
                sql: "INSERT INTO child (id, parent_id, value) VALUES (?, ?, ?)".into(),
                params: vec![
                    TxValue::Text("c2".into()),
                    TxValue::Text("ghost".into()),
                    TxValue::Text("orphan".into()),
                ],
            },
        ];

        let err = run_tx(&pool, queries).await.expect_err("should fail");
        assert_eq!(err.query_index, 1, "error points to 2nd query");
        assert!(
            err.message.contains("FOREIGN KEY")
                || err.message.to_lowercase().contains("foreign key"),
            "error mentions foreign key, got: {}",
            err.message
        );

        let parent_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM parent WHERE id = 'p2'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(parent_count.0, 0, "first insert was rolled back");
    }

    #[tokio::test]
    async fn empty_queries_list_commits_noop() {
        let pool = setup_pool().await;
        let result = run_tx(&pool, vec![]).await.expect("noop commit ok");
        assert!(result.rows_affected.is_empty());
    }

    #[tokio::test]
    async fn null_and_int_params_bind_correctly() {
        let pool = setup_pool().await;
        sqlx::query("CREATE TABLE nums (id TEXT PRIMARY KEY, n INTEGER, t TEXT)")
            .execute(&pool)
            .await
            .unwrap();

        let queries = vec![TxQuery {
            sql: "INSERT INTO nums (id, n, t) VALUES (?, ?, ?)".into(),
            params: vec![
                TxValue::Text("r1".into()),
                TxValue::Int(42),
                TxValue::Null,
            ],
        }];

        run_tx(&pool, queries).await.expect("ok");

        let row: (String, i64, Option<String>) =
            sqlx::query_as("SELECT id, n, t FROM nums WHERE id = 'r1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(row.0, "r1");
        assert_eq!(row.1, 42);
        assert_eq!(row.2, None);
    }
}
