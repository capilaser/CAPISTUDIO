# 📊 Capi Studio v2 — Modelagem do Banco de Dados

**Stack:** SQLite local (via `tauri-plugin-sql`) + Drizzle ORM (TypeScript)
**Escopo:** MVP. Tabelas marcadas como `[FUTURO]` ficam preparadas no schema mas não são usadas no MVP.

---

## Princípios da modelagem

1. **Padrão Mestre vs Arte do Pedido são entidades separadas** — regra crítica do CLAUDE.md preservada.
2. **Camadas (layers) carregam metadados de produção** (operação + máquinas) desde o dia 1, mesmo que a UI completa de produção venha em wave futura.
3. **Tudo serializável** — campos de canvas (coordenadas, transforms, fabric.js JSON) ficam em colunas `TEXT` com JSON estruturado.
4. **Sem deletes destrutivos** — usa `deleted_at` (soft delete) em entidades referenciáveis.
5. **Migrations versionadas via Drizzle Kit** desde o commit 1.

---

## Diagrama lógico (resumido)

```
products ────┬──< product_layers (camadas da base do produto)
             │
             ├──< patterns (padrões mestre por produto)
             │      │
             │      └──< pattern_slots (logo, nome, profissão...)
             │
             └──< orders (artes de pedido)
                    │
                    ├── (FK → patterns: padrão base do pedido)
                    └──< order_overrides (ajustes finos do pedido)

assets/
  ├── textures (PNGs de material)
  ├── fonts (TTF/OTF carregadas)
  ├── logos (SVG/PNG do banco crescente automático)
  └── svg_bases (SVGs crus do Corel)

machines (catálogo) ──< layer_machines (N:N com layers/slots)
operations (catálogo)
categories (tags livres)
```

---

## Schema completo — Drizzle TypeScript

Arquivo: `src/data/schema.ts`

```typescript
import { sqliteTable, integer, text, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ──────────────────────────────────────────────────────────────
// 1. CATÁLOGOS (sementes fixas — vêm dos JSONs do Capi v1)
// ──────────────────────────────────────────────────────────────

/**
 * Máquinas disponíveis no parque produtivo.
 * Seed inicial: master-biro, fiber-laser, due-laser (do v1)
 */
export const machines = sqliteTable('machines', {
  id: text('id').primaryKey(), // ex: "master-biro"
  label: text('label').notNull(), // ex: "Master Biro"
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Operações que uma camada pode executar.
 * Seed inicial: contorno, corte-laser, corte, gravacao, marcacao, aplique, gravacao-aplique
 */
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(), // ex: "gravacao"
  label: text('label').notNull(),
  // Cor padrão do overlay no canvas (hex). Pode ser sobrescrita por settings.
  defaultColor: text('default_color').notNull(),
});

/**
 * Relação N:N — quais operações cada máquina suporta.
 * Seed do v1: master-biro suporta contorno/corte-laser/corte/marcacao/gravacao/aplique
 *             fiber-laser suporta aplique/gravacao-aplique/gravacao/marcacao
 *             due-laser  suporta contorno/corte-laser/corte/marcacao/gravacao
 */
export const machineOperations = sqliteTable(
  'machine_operations',
  {
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id),
    operationId: text('operation_id')
      .notNull()
      .references(() => operations.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.machineId, t.operationId] }),
  })
);

// ──────────────────────────────────────────────────────────────
// 2. PRODUTOS (broche, placa, etc.)
// ──────────────────────────────────────────────────────────────

export const products = sqliteTable('products', {
  id: text('id').primaryKey(), // ex: "broche-60x25"
  name: text('name').notNull(),
  category: text('category'), // "broche", "placa"...
  widthMm: real('width_mm').notNull(),
  heightMm: real('height_mm').notNull(),
  // SVG/DXF da base (vetor da forma do produto). Armazenado inline.
  baseSvg: text('base_svg').notNull(),
  // viewBox calculado: "0 0 W H"
  viewBox: text('view_box').notNull(),
  // Configurações específicas (área útil, regras de export) em JSON
  config: text('config', { mode: 'json' }).$type<ProductConfig>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/** Tipo do campo `config` */
export type ProductConfig = {
  /** Área útil onde elementos podem ser posicionados (mm) */
  usableArea?: { x: number; y: number; w: number; h: number };
  /** Margem mínima da borda (mm) */
  bleedMm?: number;
  /** Texturas/materiais compatíveis (ids em `textures`) */
  compatibleTextures?: string[];
};

/**
 * Máquinas compatíveis com cada produto (de `product.machines[]` do v1)
 */
export const productMachines = sqliteTable(
  'product_machines',
  {
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    machineId: text('machine_id')
      .notNull()
      .references(() => machines.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.productId, t.machineId] }) })
);

/**
 * Camadas de base do produto (ex: contorno externo, área de gravação).
 * NÃO confundir com layers de pedido.
 * Equivale ao `product-layers.json` do v1.
 */
export const productLayers = sqliteTable('product_layers', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  zIndex: integer('z_index').notNull().default(0),
  // SVG inline da camada
  svg: text('svg').notNull(),
  // Operação padrão dessa camada (FK → operations)
  defaultOperation: text('default_operation').references(() => operations.id),
});

// ──────────────────────────────────────────────────────────────
// 3. PADRÕES MESTRE (templates reutilizáveis)
// ──────────────────────────────────────────────────────────────

export const patterns = sqliteTable('patterns', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  name: text('name').notNull(),
  description: text('description'),
  // Wave (1 = estrutural/posicional, 2 = visual/estilizado)
  wave: integer('wave').notNull().default(1),
  // Tags livres (categorias) em JSON array: ["com-borda", "1-traco", "profissao"]
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  // Snapshot completo do canvas (Fabric.js JSON serializado)
  // Inclui: posições de slots, módulos, divisores, configurações visuais
  canvasJson: text('canvas_json', { mode: 'json' }).$type<FabricCanvasJson>().notNull(),
  // Material/textura padrão sugerido (FK → textures)
  defaultTextureId: text('default_texture_id').references(() => textures.id),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  isValidated: integer('is_validated', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

/** Estrutura JSON do canvas (Fabric.js + extensões Capi) */
export type FabricCanvasJson = {
  version: string;
  objects: FabricObject[];
  background?: string;
  // Extensão Capi: metadados que o Fabric não persiste
  capi?: {
    productId: string;
    units: 'mm';
    layers: LayerMeta[];
  };
};

export type FabricObject = {
  type: string;
  id: string;
  // ... campos Fabric padrão (left, top, width, height, etc.)
  // Extensão Capi:
  capiSlot?: SlotMeta;
};

/**
 * Metadados de camadas dentro do canvas
 * (uma camada pode conter múltiplos objetos Fabric)
 */
export type LayerMeta = {
  id: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  /** Tipo principal: visual (não-cortável) ou produção (corte/gravação) */
  kind: 'visual' | 'production';
  /** Operação atribuída (FK lógica → operations.id) */
  operation: string | null;
  /** Máquinas atribuídas (FK lógica → machines.id) — min 1, max 3 */
  machines: string[];
};

export type SlotMeta = {
  type: 'logo' | 'nome' | 'profissao' | 'custom';
  /** Área máxima do slot (mm) */
  maxArea: { w: number; h: number };
  /** Centralização automática */
  autoCenter: boolean;
  /** Auto-fit do texto (sem quebra de linha) */
  autoFit?: boolean;
};

/**
 * Slots estáticos pré-definidos do padrão (logo, nome, profissão).
 * Indexação separada pra busca rápida — mas a fonte da verdade é canvasJson.
 */
export const patternSlots = sqliteTable('pattern_slots', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id')
    .notNull()
    .references(() => patterns.id),
  slotType: text('slot_type').notNull(), // "logo" | "nome" | "profissao" | "custom"
  positionX: real('position_x').notNull(), // mm
  positionY: real('position_y').notNull(),
  maxWidth: real('max_width').notNull(),
  maxHeight: real('max_height').notNull(),
  defaultFontId: text('default_font_id').references(() => fonts.id),
  // Metadados extras em JSON (alinhamento, autofit, etc.)
  meta: text('meta', { mode: 'json' }),
});

// ──────────────────────────────────────────────────────────────
// 4. ARTES DO PEDIDO (instâncias de padrão preenchidas)
// ──────────────────────────────────────────────────────────────

/**
 * REGRA CRÍTICA (CLAUDE.md): salvar pedido NUNCA altera o padrão mestre.
 * O pedido referencia o padrão base + guarda os campos preenchidos +
 * overrides de ajuste fino.
 */
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  patternId: text('pattern_id')
    .notNull()
    .references(() => patterns.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  // Identificador humano (ex: "João Silva - Advogado")
  label: text('label').notNull(),
  // Campos preenchidos pelo operador
  fields: text('fields', { mode: 'json' }).$type<OrderFields>().notNull(),
  // Material/textura usado (pode override o do padrão)
  textureId: text('texture_id').references(() => textures.id),
  // Status simples no MVP: "pendente" | "aprovado"
  status: text('status').notNull().default('pendente'),
  // Snapshot final do canvas no momento do salvamento (com overrides aplicados)
  canvasJson: text('canvas_json', { mode: 'json' }).$type<FabricCanvasJson>().notNull(),
  // Caminhos dos arquivos exportados (relativo a `appData/exports/`)
  exportedPngPath: text('exported_png_path'),
  exportedSvgPaths: text('exported_svg_paths', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

export type OrderFields = {
  /** Logo do cliente: id de logos.id (banco crescente) ou inline SVG */
  logo?: { source: 'asset' | 'inline'; assetId?: string; inlineSvg?: string };
  /** Nome do cliente */
  nome?: string;
  /** Profissão */
  profissao?: string;
  /** Outros campos custom do padrão */
  [key: string]: unknown;
};

/**
 * Overrides finos: ajustes de posição/escala/fonte aplicados SOBRE o padrão.
 * Tabela separada permite reverter overrides sem perder os campos preenchidos.
 */
export const orderOverrides = sqliteTable('order_overrides', {
  id: text('id').primaryKey(),
  orderId: text('order_id')
    .notNull()
    .references(() => orders.id),
  // Slot ou objeto do canvas afetado
  targetId: text('target_id').notNull(),
  // Tipo do override: "position" | "scale" | "font" | "machine" | "operation" | "rotation"
  kind: text('kind').notNull(),
  // Valor antigo (do padrão) e novo (do pedido) em JSON
  before: text('before', { mode: 'json' }),
  after: text('after', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ──────────────────────────────────────────────────────────────
// 5. ASSETS (banco de recursos reutilizáveis)
// ──────────────────────────────────────────────────────────────

/** Texturas/materiais (PNG aplicado por cima da base SVG) */
export const textures = sqliteTable('textures', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  family: text('family'), // ex: "Acrílico Brilhoso"
  color: text('color'), // ex: "Preto", "Branco"
  // Caminho relativo no appData (ex: "textures/acrilico-brilhoso-preto.png")
  filePath: text('file_path').notNull(),
  thumbnailPath: text('thumbnail_path'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Fontes carregadas pelo usuário */
export const fonts = sqliteTable('fonts', {
  id: text('id').primaryKey(),
  family: text('family').notNull(), // nome PostScript da fonte
  displayName: text('display_name').notNull(),
  filePath: text('file_path').notNull(), // caminho do .ttf/.otf
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Banco de logos crescente — toda logo usada num pedido fica salva aqui.
 * Busca futura por nome/cliente reutiliza.
 */
export const logos = sqliteTable('logos', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // identificador (ex: nome do cliente)
  filePath: text('file_path').notNull(),
  /** Tipo: SVG/DXF (vetor) ou PNG/JPG (raster) */
  format: text('format').notNull(),
  /** Tags pra busca: ["cliente:joao", "profissao:advogado"] */
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  /** Última vez que foi usada num pedido */
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** SVGs base do Corel — matéria-prima crua pra criar padrões */
export const svgBases = sqliteTable('svg_bases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  productId: text('product_id').references(() => products.id),
  filePath: text('file_path').notNull(),
  /** Largura/altura nominal do SVG (mm) — extraídas no upload */
  widthMm: real('width_mm'),
  heightMm: real('height_mm'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ──────────────────────────────────────────────────────────────
// 6. CATEGORIAS / TAGS (gerenciamento manual)
// ──────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(), // "pattern" | "product" | "logo" | "svg"
  color: text('color'), // hex pra exibir chip colorido
});

// ──────────────────────────────────────────────────────────────
// 7. SETTINGS (configurações do app)
// ──────────────────────────────────────────────────────────────

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ──────────────────────────────────────────────────────────────
// 8. HISTÓRICO DE EXPORTS (rastreabilidade)
// ──────────────────────────────────────────────────────────────

export const exportHistory = sqliteTable('export_history', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id),
  // "preview-png" | "production-svg"
  kind: text('kind').notNull(),
  machineId: text('machine_id').references(() => machines.id),
  filePath: text('file_path').notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ──────────────────────────────────────────────────────────────
// 9. [FUTURO] — preparado mas não usado no MVP
// ──────────────────────────────────────────────────────────────

// export const customers = sqliteTable("customers", { ... }); // Fase 2
// export const orderQueue = sqliteTable("order_queue", { ... }); // Fase 2 (Make/Drive)
// export const orderStatusHistory = ... // Fase 2
```

---

## Seeds iniciais (a popular no primeiro boot)

Arquivo: `src/data/seed.ts`

```typescript
// Migrar dos JSONs do Capi v1:
// - data/machines.json → tabela machines + machine_operations
// - data/products.json → tabela products + product_machines
// - data/materials.json (texturas) → tabela textures
// - data/fonts.json → tabela fonts
// - data/patterns/*.json → tabela patterns + pattern_slots

const SEED_MACHINES = [
  { id: 'master-biro', label: 'Master Biro' },
  { id: 'fiber-laser', label: 'Fiber Laser' },
  { id: 'due-laser', label: 'Due Laser' },
];

const SEED_OPERATIONS = [
  { id: 'contorno', label: 'Contorno', defaultColor: '#000000' },
  { id: 'corte-laser', label: 'Corte Laser', defaultColor: '#2563eb' },
  { id: 'corte', label: 'Corte', defaultColor: '#000000' },
  { id: 'gravacao', label: 'Gravação', defaultColor: '#dc2626' },
  { id: 'marcacao', label: 'Marcação', defaultColor: '#2563eb' },
  { id: 'aplique', label: 'Aplique', defaultColor: '#7c3aed' },
  { id: 'gravacao-aplique', label: 'Gravação Aplique', defaultColor: '#d97706' },
];

// Compatibilidades do v1:
const SEED_MACHINE_OPS = {
  'master-biro': ['contorno', 'corte-laser', 'corte', 'marcacao', 'gravacao', 'aplique'],
  'fiber-laser': ['aplique', 'gravacao-aplique', 'gravacao', 'marcacao'],
  'due-laser': ['contorno', 'corte-laser', 'corte', 'marcacao', 'gravacao'],
};
```

---

## Migrations (Drizzle Kit)

```bash
# Gerar migration
npx drizzle-kit generate

# Aplicar (no boot do app, via tauri-plugin-sql)
npx drizzle-kit push:sqlite
```

Pasta de migrations: `src-tauri/migrations/` — embarcadas no binário e aplicadas via `tauri-plugin-sql` no boot.

---

## Validação de regras de negócio (a refletir nos repositórios)

Implementar como **constraints lógicas** na camada de repository (`src/data/repositories/`), não como triggers SQL — mais portável e testável:

1. **Camada com `kind: "production"` exige `operation` não-nulo e `machines.length >= 1`.**
2. **Salvar pedido nunca propaga alterações pra `patterns.canvasJson`** — só pra `orders.canvasJson` e `order_overrides`.
3. **Soft delete em cascata lógica** — deletar produto não apaga padrões/pedidos, só marca o produto como `deletedAt`.
4. **Logo automaticamente registrada em `logos`** quando usada num pedido pela primeira vez.

---

## Checklist de paridade com o v1

Tabelas que cobrem cada arquivo do v1:

| v1 (JSON)                             | v2 (tabela)                                        |
| ------------------------------------- | -------------------------------------------------- |
| `data/machines.json`                  | `machines` + `machine_operations`                  |
| `data/products.json`                  | `products` + `product_machines`                    |
| `data/product-layers.json`            | `product_layers`                                   |
| `data/patterns/*.json`                | `patterns` + `pattern_slots`                       |
| `data/materials.json`                 | `textures`                                         |
| `data/fonts.json`                     | `fonts`                                            |
| `data/custom-patterns.json`           | `patterns` (mesma tabela, diferenciada por origem) |
| `data/product-backgrounds.json`       | embarcado em `products.config`                     |
| `data/validated-scenarios-state.json` | flags `isValidated` em `patterns`                  |
| `data/settings.json`                  | `settings`                                         |
| Logos do usuário (assets)             | `logos`                                            |
| SVGs do Corel (assets)                | `svg_bases`                                        |

✅ 100% migrável.
