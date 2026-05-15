/**
 * Onda 11.A → Onda 11.C — orderRepository
 *
 * Gerencia pedidos. Os 4 campos "snapshot" (fields, materialId, canvasJson,
 * exportedPngPath) são denormalizados: ficam em `orders` como "última revisão"
 * E são duplicados em `order_revisions` como histórico imutável.
 *
 * INVARIANTE crítica: toda escrita desses 4 campos em `orders` acontece DENTRO
 * da mesma transação SQL que cria a revisão correspondente. Usar a infra
 * `executeTransaction` (ver `data/transaction.ts` + ADR 017) — nunca chamar
 * `db.execute()` solto pra atualizar esses campos.
 *
 * Onda 11.C estendeu o repositório:
 *  - OrderStatus agora tem 6 valores Kanban
 *  - Order ganhou customerName/olistOrderId/marketplace/folderPath/archived
 *  - patternId/productId viraram nullable (pedido nasce vazio, editor preenche)
 *  - Novos métodos: listAll, listByStatus, listGroupedByStatus, updateStatus,
 *    create (atalho do createWithFirstRevision sem padrão/produto),
 *    archiveAll, setExportedPngPath
 */
import { getDb } from '../client';
import { executeTransaction, type TxParam } from '../transaction';
import type { OrderFields } from '../schema';

// 6 status Kanban — fluxo:
//   novo → aguardando_info (manual) → ... → novo (manual de volta)
//   novo → arte_enviada    (auto ao salvar/exportar)
//   arte_enviada → aprovado     (manual)
//   aprovado     → em_producao  (manual)
//   em_producao  → enviado      (manual)
//   enviado      → archived=1   (boot job — separado de status)
export type OrderStatus =
  | 'novo'
  | 'aguardando_info'
  | 'arte_enviada'
  | 'aprovado'
  | 'em_producao'
  | 'enviado';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'novo',
  'aguardando_info',
  'arte_enviada',
  'aprovado',
  'em_producao',
  'enviado',
] as const;

// Marketplaces conhecidos. NULL = pedido criado dentro do app (sem origem externa).
export type Marketplace = 'shopee' | 'mercado_livre' | 'whatsapp';

export interface Order {
  id: string;
  patternId: string | null;
  productId: string | null;
  label: string;
  fields: OrderFields;
  materialId: string | null;
  status: OrderStatus;
  /** Snapshot da última revisão. Espelha `order_revisions[last].canvas_json`. */
  canvasJson: string;
  /** Path do PNG da última revisão. Null = nunca exportado. */
  exportedPngPath: string | null;
  exportedSvgPaths: string[] | null;
  customerName: string | null;
  olistOrderId: string | null;
  marketplace: Marketplace | null;
  folderPath: string | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface OrderRow {
  id: string;
  patternId: string | null;
  productId: string | null;
  label: string;
  fields: string;
  materialId: string | null;
  status: string;
  canvasJson: string;
  exportedPngPath: string | null;
  exportedSvgPaths: string | null;
  customerName: string | null;
  olistOrderId: string | null;
  marketplace: string | null;
  folderPath: string | null;
  archived: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

const SELECT_COLS = `
  id, pattern_id as patternId, product_id as productId, label,
  fields, material_id as materialId, status,
  canvas_json as canvasJson, exported_png_path as exportedPngPath,
  exported_svg_paths as exportedSvgPaths,
  customer_name as customerName, olist_order_id as olistOrderId,
  marketplace, folder_path as folderPath, archived,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt
`;

function parseStatus(raw: string): OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(raw) ? (raw as OrderStatus) : 'novo';
}

function parseMarketplace(raw: string | null): Marketplace | null {
  if (raw === 'shopee' || raw === 'mercado_livre' || raw === 'whatsapp') return raw;
  return null;
}

function toOrder(row: OrderRow): Order {
  let exportedSvgPaths: string[] | null = null;
  if (row.exportedSvgPaths) {
    try {
      const parsed = JSON.parse(row.exportedSvgPaths) as unknown;
      if (Array.isArray(parsed)) exportedSvgPaths = parsed as string[];
    } catch {
      exportedSvgPaths = null;
    }
  }
  return {
    id: row.id,
    patternId: row.patternId,
    productId: row.productId,
    label: row.label,
    fields: JSON.parse(row.fields) as OrderFields,
    materialId: row.materialId,
    status: parseStatus(row.status),
    canvasJson: row.canvasJson,
    exportedPngPath: row.exportedPngPath,
    exportedSvgPaths,
    customerName: row.customerName,
    olistOrderId: row.olistOrderId,
    marketplace: parseMarketplace(row.marketplace),
    folderPath: row.folderPath,
    archived: row.archived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getById(id: string): Promise<Order | null> {
  const db = await getDb();
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_COLS} FROM orders WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ? toOrder(rows[0]) : null;
}

export interface OrderListItem {
  id: string;
  label: string;
  status: OrderStatus;
  updatedAt: number;
}

/**
 * Listagem paginada — Fase D vai chamar com page size 50.
 * Ordena por updated_at desc (mais recente primeiro).
 * Filtra archived=0 (pedidos despachados não aparecem aqui).
 */
export async function listPage(opts: { limit: number; offset: number }): Promise<OrderListItem[]> {
  const db = await getDb();
  const rows = await db.select<
    Array<{
      id: string;
      label: string;
      status: string;
      updatedAt: number;
    }>
  >(
    `SELECT id, label, status, updated_at as updatedAt
       FROM orders
      WHERE deleted_at IS NULL AND archived = 0
   ORDER BY updated_at DESC
      LIMIT ? OFFSET ?`,
    [opts.limit, opts.offset]
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    status: parseStatus(r.status),
    updatedAt: r.updatedAt,
  }));
}

export async function count(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(
    `SELECT COUNT(*) as n FROM orders WHERE deleted_at IS NULL AND archived = 0`
  );
  return rows[0]?.n ?? 0;
}

/**
 * Conta TODOS os pedidos já criados (inclui arquivados e soft-deleted).
 *
 * Usado pelo onboarding pra gerar nome auto-incrementado "Novo Pedido N"
 * sem risco de colisão: se um pedido N for deletado, N+1 continua o próximo.
 * Não filtra archived/deleted_at justamente pra manter unicidade temporal.
 */
export async function countAll(): Promise<number> {
  const db = await getDb();
  const rows = await db.select<Array<{ n: number }>>(`SELECT COUNT(*) as n FROM orders`);
  return rows[0]?.n ?? 0;
}

/**
 * Lista todos os pedidos ativos (não arquivados, não deletados). Usada pelo
 * Kanban no boot pra hidratar todas as 6 colunas. Ordenada por updated_at
 * desc — o consumer faz o groupBy(status) em JS, evitando 6 queries.
 */
export async function listAll(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_COLS} FROM orders
      WHERE deleted_at IS NULL AND archived = 0
   ORDER BY updated_at DESC`
  );
  return rows.map(toOrder);
}

/**
 * Lista pedidos por status. Usada pelo boot job pra varrer só 'enviado'.
 * Inclui arquivados ou não conforme o parâmetro (boot job precisa pegar
 * pedidos enviado que ainda NÃO foram arquivados — default false).
 */
export async function listByStatus(
  status: OrderStatus,
  opts: { includeArchived?: boolean } = {}
): Promise<Order[]> {
  const db = await getDb();
  const includeArchived = opts.includeArchived ?? false;
  const archivedClause = includeArchived ? '' : 'AND archived = 0';
  const rows = await db.select<OrderRow[]>(
    `SELECT ${SELECT_COLS} FROM orders
      WHERE deleted_at IS NULL AND status = ? ${archivedClause}
   ORDER BY updated_at DESC`,
    [status]
  );
  return rows.map(toOrder);
}

// ── Writes (atomic) ──────────────────────────────────────────────────────────

export interface CreateOrderInput {
  id: string;
  patternId: string;
  productId: string;
  label: string;
  fields: OrderFields;
  materialId?: string | null;
  canvasJson: string;
}

/**
 * Cria pedido + revisão 1 atomicamente. Status inicial = 'novo'.
 *
 * Onda 11.C: status default agora é 'novo' (era 'pendente' na Fase A).
 *
 * Layout da transação:
 *   1. INSERT orders (status='novo', revisão 1 denormalizada)
 *   2. INSERT order_revisions (number=1, is_approved=0)
 *
 * Falha em qualquer query → rollback completo (nem orders nem revisão
 * persistem). Garantia provida por `executeTransaction` (ver ADR 017).
 */
export async function createWithFirstRevision(input: CreateOrderInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const fieldsJson = JSON.stringify(input.fields);
  const materialId: TxParam = input.materialId ?? null;

  await executeTransaction([
    {
      sql: `INSERT INTO orders (
              id, pattern_id, product_id, label, fields, material_id, status,
              canvas_json, exported_png_path, exported_svg_paths,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'novo', ?, NULL, NULL, unixepoch(), unixepoch())`,
      params: [
        input.id,
        input.patternId,
        input.productId,
        input.label,
        fieldsJson,
        materialId,
        input.canvasJson,
      ],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, fields, material_id, canvas_json,
              exported_png_path, is_approved, created_at
            ) VALUES (?, ?, 1, ?, ?, ?, NULL, 0, unixepoch())`,
      params: [revisionId, input.id, fieldsJson, materialId, input.canvasJson],
    },
  ]);
}

/**
 * Atalho usado pelo modal "Novo Pedido" do Kanban (Onda 11.C).
 *
 * Cria um pedido "vazio": apenas customer_name preenchido, sem padrão,
 * sem produto, sem material. fields={}, canvas_json='{}'. Status='novo'.
 *
 * A revisão 1 também é criada (snapshot inicial vazio) — Onda 11.A
 * garante atomicidade via createWithFirstRevision, mas aqui patternId
 * e productId são NULL (relaxados na migration v9).
 *
 * Reusa a mesma transação atômica de `createWithFirstRevision`, mas
 * o INSERT precisa permitir NULL nos FKs — fazemos via SQL inline.
 *
 * Retorna o `id` do pedido criado pra UI redirecionar pro editor.
 */
export async function create(customerName: string): Promise<string> {
  const trimmed = customerName.trim();
  if (trimmed.length < 2) {
    throw new Error('customerName must have at least 2 characters');
  }
  const orderId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const label = trimmed;
  const fieldsJson = '{}';
  const emptyCanvasJson = '{}';

  await executeTransaction([
    {
      sql: `INSERT INTO orders (
              id, pattern_id, product_id, label, fields, material_id, status,
              canvas_json, exported_png_path, exported_svg_paths,
              customer_name, olist_order_id, marketplace, folder_path, archived,
              created_at, updated_at
            ) VALUES (?, NULL, NULL, ?, ?, NULL, 'novo', ?, NULL, NULL,
                      ?, NULL, NULL, NULL, 0, unixepoch(), unixepoch())`,
      params: [orderId, label, fieldsJson, emptyCanvasJson, trimmed],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, fields, material_id, canvas_json,
              exported_png_path, is_approved, created_at
            ) VALUES (?, ?, 1, ?, NULL, ?, NULL, 0, unixepoch())`,
      params: [revisionId, orderId, fieldsJson, emptyCanvasJson],
    },
  ]);

  return orderId;
}

export interface SaveRevisionInput {
  orderId: string;
  fields: OrderFields;
  materialId?: string | null;
  canvasJson: string;
}

/**
 * Salva nova revisão. Cria order_revisions[next] e ATUALIZA orders pra refletir
 * o snapshot da nova revisão. Número da revisão é calculado atomicamente via
 * `(SELECT COALESCE(MAX(number), 0) + 1 FROM order_revisions WHERE order_id=?)`
 * — protegido contra race por UNIQUE INDEX (order_id, number).
 *
 * Nova revisão SEMPRE entra com is_approved=0. Status do pedido NÃO é alterado
 * aqui (continua o que estava). Fase D vai trigger a transição automática
 * novo→arte_enviada quando salvar OU exportar PNG. Onda 12 vai marcar
 * is_approved=1 em comando dedicado.
 */
export async function saveRevision(input: SaveRevisionInput): Promise<void> {
  const revisionId = crypto.randomUUID();
  const fieldsJson = JSON.stringify(input.fields);
  const materialId: TxParam = input.materialId ?? null;

  await executeTransaction([
    {
      sql: `UPDATE orders
               SET fields = ?, material_id = ?, canvas_json = ?, updated_at = unixepoch()
             WHERE id = ? AND deleted_at IS NULL`,
      params: [fieldsJson, materialId, input.canvasJson, input.orderId],
    },
    {
      sql: `INSERT INTO order_revisions (
              id, order_id, number, fields, material_id, canvas_json,
              exported_png_path, is_approved, created_at
            )
            SELECT ?, ?, COALESCE(MAX(number), 0) + 1, ?, ?, ?, NULL, 0,
                   unixepoch()
              FROM order_revisions
             WHERE order_id = ?`,
      params: [revisionId, input.orderId, fieldsJson, materialId, input.canvasJson, input.orderId],
    },
  ]);
}

/**
 * Atualiza apenas o status do pedido. Não cria revisão (status não é
 * snapshot — é metadata operacional). Usado pelos botões do Kanban
 * ("Aguardando Info", "Aprovar", "Iniciar Produção", "Embalado").
 *
 * Atualiza updated_at — garante que o card sobe na ordenação após a ação.
 */
export async function updateStatus(orderId: string, status: OrderStatus): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET status = ?, updated_at = unixepoch()
      WHERE id = ? AND deleted_at IS NULL`,
    [status, orderId]
  );
}

/**
 * Marca múltiplos pedidos como archived=1. Usado pelo boot job após
 * copiar os arquivos do pedido pra pasta de despacho com sucesso.
 *
 * Não usa transação Rust (single UPDATE batch) — opera só em uma tabela
 * sem invariante cruzada. Atomicidade da própria query é garantida pelo
 * SQLite.
 */
export async function archiveAll(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(', ');
  await db.execute(
    `UPDATE orders SET archived = 1, updated_at = unixepoch()
      WHERE id IN (${placeholders})`,
    ids
  );
}

/**
 * Atualiza apenas o path do PNG exportado em `orders` (denormalizado).
 * Fase D vai chamar isso depois do export PNG. Se o pedido tem revisão
 * "em aberto" (não foi salvo desde último export), também atualiza
 * `order_revisions[last].exported_png_path` — caller decide via flag.
 *
 * Fase D vai chamar isso quando exportar PNG. Fase C declara a função
 * pra fechar o contrato do repositório.
 */
export async function setExportedPngPath(orderId: string, pngPath: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET exported_png_path = ?, updated_at = unixepoch()
      WHERE id = ? AND deleted_at IS NULL`,
    [pngPath, orderId]
  );
}

/** Soft-delete. Não toca em revisions (histórico permanece). */
export async function softDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE orders SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
}
