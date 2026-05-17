/**
 * logoRepository.ts — Onda 14
 *
 * Banco auto-crescente de logos do cliente. Cada logo é gravado em disco
 * (appData/assets/logos/{id}.svg via logo-storage.ts) e referenciado por
 * path nesta tabela.
 *
 * Por que separamos de appliques: logos têm shape e propósito diferentes
 * — vêm do cliente (sem operation/machines pré-definidas, sempre
 * gravação) e podem ser tags/categorias diferentes (logo de empresa,
 * brasão, etc).
 */
import { getDb } from '../client';

export interface Logo {
  id: string;
  name: string;
  filePath: string;
  format: 'SVG' | 'DXF' | 'PNG' | 'JPG';
  tags: string[];
  lastUsedAt: number | null;
  createdAt: number;
}

interface LogoRow {
  id: string;
  name: string;
  filePath: string;
  format: string;
  tags: string;
  lastUsedAt: number | null;
  createdAt: number;
}

const SELECT_COLS = `
  id, name, file_path as filePath, format,
  tags, last_used_at as lastUsedAt, created_at as createdAt
`;

function parseFormat(raw: string): Logo['format'] {
  if (raw === 'SVG' || raw === 'DXF' || raw === 'PNG' || raw === 'JPG') return raw;
  return 'SVG';
}

function toLogo(row: LogoRow): Logo {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags) as unknown;
    if (Array.isArray(parsed)) tags = parsed as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    name: row.name,
    filePath: row.filePath,
    format: parseFormat(row.format),
    tags,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getById(id: string): Promise<Logo | null> {
  const db = await getDb();
  const rows = await db.select<LogoRow[]>(`SELECT ${SELECT_COLS} FROM logos WHERE id = ?`, [id]);
  return rows[0] ? toLogo(rows[0]) : null;
}

/**
 * Lista logos do mais recentemente usado pro mais antigo. Onda 14 (MVP)
 * não filtra — operador vê todos. Galeria de re-uso virá numa onda futura.
 */
export async function listAll(): Promise<Logo[]> {
  const db = await getDb();
  const rows = await db.select<LogoRow[]>(
    `SELECT ${SELECT_COLS} FROM logos
   ORDER BY COALESCE(last_used_at, created_at) DESC`
  );
  return rows.map(toLogo);
}

export type LogoRecency = 'all' | '7d' | '30d';

export interface ListLogosOptions {
  /** Substring case-insensitive batida no nome do logo. Trim aplicado. */
  search?: string;
  /** Filtra por last_used_at. 'all' (default) ignora; '7d'/'30d' aplicam corte temporal. */
  recency?: LogoRecency;
}

/**
 * Onda 21 — listagem com filtros (busca por nome + janela temporal de uso).
 * Quando `recency !== 'all'`, exclui logos nunca usados (last_used_at IS NULL).
 * Quando o search é vazio/espaço, comporta-se como `listAll` filtrado pela recência.
 */
export async function listFiltered(opts: ListLogosOptions = {}): Promise<Logo[]> {
  const db = await getDb();
  const search = opts.search?.trim() ?? '';
  const recency = opts.recency ?? 'all';

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (search.length > 0) {
    where.push(`name LIKE ? COLLATE NOCASE`);
    params.push(`%${search}%`);
  }

  if (recency !== 'all') {
    const days = recency === '7d' ? 7 : 30;
    const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
    where.push(`last_used_at IS NOT NULL AND last_used_at >= ?`);
    params.push(cutoff);
  }

  const sql =
    `SELECT ${SELECT_COLS} FROM logos` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY COALESCE(last_used_at, created_at) DESC`;

  const rows = await db.select<LogoRow[]>(sql, params);
  return rows.map(toLogo);
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface CreateLogoInput {
  id: string;
  name: string;
  filePath: string;
  format?: Logo['format'];
  tags?: string[];
}

/** Insere um logo novo. Throws em id duplicado. */
export async function create(input: CreateLogoInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO logos (id, name, file_path, format, tags, last_used_at, created_at)
     VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
    [input.id, input.name, input.filePath, input.format ?? 'SVG', JSON.stringify(input.tags ?? [])]
  );
}

/** Marca o logo como recém-usado (atualiza last_used_at). Usado ao aplicar num pedido. */
export async function touch(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE logos SET last_used_at = unixepoch() WHERE id = ?`, [id]);
}
