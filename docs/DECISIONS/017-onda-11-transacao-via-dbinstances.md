# ADR 017 — Onda 11: transação atômica via `DbInstances` (pool compartilhado)

**Data:** 2026-05-11
**Status:** Aceito (Fase A da Onda 11)
**Implementação:** `src-tauri/src/db_tx.rs` + `src/data/transaction.ts`

---

## Contexto

A Onda 11 introduz `order_revisions` (histórico imutável de revisões de pedido)
e mantém os 4 campos snapshot (`fields`, `material_id`, `canvas_json`,
`exported_png_path`) também na tabela `orders` como "última revisão"
denormalizada — ver Ajustes 1-3 da Fase A.

**Invariante crítica:** toda escrita desses 4 campos em `orders` acontece
DENTRO da mesma transação SQL que cria a revisão correspondente. Nunca um
sem o outro. Se a transação aborta, ambos rollback.

O problema: o `tauri-plugin-sql` 2.x **não expõe API de transação**. Só
expõe `db.execute(query, params)` single-statement via `sqlx::query()`
(prepared statement). Não dá pra fazer atomicidade real só com o que está
disponível na JS API.

---

## Opções avaliadas

### Opção 1 — `"BEGIN; INSERT; INSERT; COMMIT;"` em uma só chamada `execute()`

**Rejeitada — inseguro.** O Rust do plugin chama
`sqlx::query(&_query)` que sob SQLite é prepared statement. A doc oficial
do sqlx avisa: "_the query string may only contain a single DML statement_".
Em runtime, sqlx-sqlite executa só o **primeiro** statement de uma string
multi-comando — os outros são silenciosamente descartados. Resultado:
`BEGIN` abre transação, `INSERT` cai fora dela, `COMMIT` é ignorado.
Dados inconsistentes sem erro visível.

Evidências: [`plugins/sql/src/wrapper.rs` (linha do `sqlx::query`)](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/v2/plugins/sql/src/wrapper.rs)

- [docs.rs `sqlx::query`](https://docs.rs/sqlx/latest/sqlx/fn.query.html).

### Opção 2 — Múltiplos `execute()` separados + ordem "recuperável"

**Rejeitada — débito disfarçado.** Cada `execute()` pega uma conexão
DIFERENTE do pool — `BEGIN` em conn A, `INSERT` em conn B = não atômico.
Bug confirmado em [issue #886](https://github.com/tauri-apps/plugins-workspace/issues/886)
do plugin. Em app desktop single-user, modos de falha não são race
conditions — são power loss, antivírus interceptando, BSOD aleatório. Em
5000 pedidos/ano isso vira "uma vez por semestre revisão órfã".
Inaceitável.

### Opção 3 — Comando Tauri pontual

**Rejeitada — escopo errado.** Resolve só o caso `orderRepository.saveRevision`.
Onda 12 (aprovação de pedido) já precisa de atomicidade para outras 3
escritas. Resolver pontualmente agora = refazer depois.

### Opção 4 — Infra reutilizável `db_tx_execute(queries: Vec<…>)`

Subset de Opção 3 com API genérica. Lista de queries arbitrárias rodam
em transação no Rust. Aceita.

### Opção 5 — Reutilizar o pool do plugin via `DbInstances` (escolhida)

[PR #1381](https://github.com/tauri-apps/plugins-workspace/pull/1381)
(merged jun/2024) tornou `DbInstances` público no `tauri-plugin-sql`:

```rust
pub struct DbInstances(pub RwLock<HashMap<String, DbPool>>);
```

Nosso comando custom Rust acessa `app.state::<DbInstances>()`, pega o
`SqlitePool` já registrado pelo plugin, chama `pool.begin().await` e roda
N queries no MESMO `Transaction`. Atomicidade real, sem segundo pool, sem
WAL footgun, sem cache duplicado.

**Custo:** 1 dep direta (`sqlx 0.8` com feature `sqlite` + `runtime-tokio`)
— já transitiva do plugin-sql, cargo deduplica. ~170 linhas de Rust + 80
de TS + 4 unit tests Rust + 6 testes TS + ~10 testes de integração no
`orderRepository`.

---

## Decisão

**Opção 5.**

### Implementação

**Rust** (`src-tauri/src/db_tx.rs`):

- `#[tauri::command] db_tx_execute(app, db, queries) -> Result<TxResult, TxError>`
- Resolve o `SqlitePool` via `app.state::<DbInstances>().0.read().await.get(db_url)`
- Chama `pool.begin().await`, executa cada query via `sqlx::query_with`, rollback
  explícito em qualquer erro, commit no fim
- Aceita `TxValue` (null/bool/int/float/text) — subset intencional de JSON
- Retorna `TxResult { rows_affected: Vec<u64> }` ou `TxError { query_index, message }`
- Função núcleo `run_tx(pool, queries)` testável com pool sqlite in-memory
  (4 unit tests, `cargo test --lib db_tx::`)

**TS** (`src/data/transaction.ts`):

- `executeTransaction(queries: TxQuery[]) -> Promise<TxResult>`
- `TransactionError` com `queryIndex` (0-based) + `message`
- Early-return em lista vazia
- Mapeia `{query_index, message}` (snake_case do Rust) → `TransactionError`

**Repositórios** (`src/data/repositories/orderRepository.ts`):

- `createWithFirstRevision()`: INSERT orders + INSERT order_revisions n=1
  em `executeTransaction([...])`
- `saveRevision()`: UPDATE orders + INSERT order_revisions com
  `COALESCE(MAX(number),0)+1` na mesma transação
- Race condition protegida por UNIQUE INDEX `(order_id, number)` em
  `0007_order_revisions.sql`

### Schema `order_revisions` — campos declarados, com dono na Onda

| coluna            | dono    | uso na 11.A | observação                                         |
| ----------------- | ------- | ----------- | -------------------------------------------------- |
| id                | 11.A    | sim         | UUID, PK                                           |
| order_id          | 11.A    | sim         | FK                                                 |
| number            | 11.A    | sim         | sequencial, UNIQUE com order_id                    |
| fields            | 11.A    | sim         | snapshot JSON                                      |
| material_id       | 11.A    | sim         | snapshot                                           |
| canvas_json       | 11.A    | sim         | snapshot                                           |
| exported_png_path | Fase E  | NULL        | preenchido quando export PNG fica vinculado        |
| is_approved       | Onda 12 | 0           | declarado AGORA pra evitar migration v9 só pra ele |
| created_at        | 11.A    | sim         | unixepoch                                          |

`is_approved INTEGER DEFAULT 0 NOT NULL` foi declarado já na v8 mesmo
sem consumidor na Onda 11.A. Motivação: Onda 12 (aprovação de pedido)
vai marcar `is_approved=1` na revisão escolhida pelo cliente — declarar
agora elimina uma migration v9 ALTER TABLE só pra adicionar coluna.

Status do pedido (`orders.status`) usa o vocabulário herdado do
migration 0000: `pendente` (default) | `enviado_cliente` (Fase E). Não
foi renomeado para `rascunho` — manter alinhado com schema histórico
evita falsa migração. `aprovado` virá na Onda 12 junto com leituras de
`is_approved`.

---

## Por que não foi opção 1 (multi-statement) nem opção 2 (ordem recuperável)

Já cobertas acima. Resumo: opção 1 silenciosamente perde dados; opção 2
não tem atomicidade nem em SQLite single-user porque o pool checkoutta
conexões diferentes — não é um problema de concorrência, é semântica
do plugin.

## Por que não 2º pool sqlx puro

Riscos levantados (e confirmados na investigação):

1. **WAL mode pode não estar ativado** pelo plugin → 2 pools = lock
   contention
2. **Page cache desincronizado** entre pools → leitura stale após escrita
3. **Schema cacheado** desatualizado relativo às migrations Drizzle

Reusar o pool do plugin elimina os 3.

---

## Reuso futuro

- **Onda 12 (aprovação de pedido):** UPDATE orders.status +
  UPDATE orders.approved_revision_id + UPDATE order_revisions.is_approved
  → 3 queries em `executeTransaction`.
- **Onda 13+ (qualquer write multi-tabela):** mesma infra, sem código
  Rust adicional.
- **Migrações de dados in-place futuras:** comando único + transação,
  sem precisar de migration SQL formal.

---

## Limitações conhecidas

- `TxValue` aceita só null/bool/int/float/text. Bytes (BLOB) não. Adicionar
  só se aparecer caso de uso real (não especular).
- Nenhum suporte a SAVEPOINT (transações aninhadas). Onda 11/12 não
  precisa. Se aparecer, adicionar `nested: bool` em `TxQuery`.
- `read_only: bool` poderia evitar BEGIN IMMEDIATE pra reads, mas as
  reads atuais usam `db.execute()` direto (não `executeTransaction`),
  então não há ganho prático hoje.

---

## Fontes consultadas

- [tauri-apps/plugins-workspace/pull/1381](https://github.com/tauri-apps/plugins-workspace/pull/1381) — tornou DbInstances pub
- [tauri-apps/plugins-workspace/issues/886](https://github.com/tauri-apps/plugins-workspace/issues/886) — discussão de transactions
- [plugins/sql/src/wrapper.rs](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/v2/plugins/sql/src/wrapper.rs) — confirma `sqlx::query` single-statement
- [docs.rs/sqlx](https://docs.rs/sqlx/latest/sqlx/fn.query.html) — restrição de single DML
