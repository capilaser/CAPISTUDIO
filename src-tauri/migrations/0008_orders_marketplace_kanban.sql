-- Onda 11 Fase C — Kanban Dashboard.
--
-- 5 novas colunas em `orders`:
--   customer_name   — nome do cliente (preenchido no modal de criar pedido)
--   olist_order_id  — id do pedido no Olist/marketplace integrado (Fase 2)
--   marketplace     — 'shopee' | 'mercado_livre' | 'whatsapp' | NULL
--   folder_path     — pasta do pedido (preenchida no editor da Fase D)
--   archived        — 0/1, marcada como 1 pelo boot job após despacho
--
-- Expansão do domínio de `orders.status` para 6 valores Kanban:
--   'novo' | 'aguardando_info' | 'arte_enviada' | 'aprovado'
--   | 'em_producao' | 'enviado'
--
-- Migração dos status legados (Onda 11.A) → 'novo':
--   - 'pendente'         → 'novo' (default antigo de Fase A)
--   - 'enviado_cliente'  → 'novo' (Fase E reservada não foi implementada)
--
-- Relaxamento de NOT NULL em `orders.pattern_id` e `orders.product_id`:
--   Pedido nasce sem padrão/produto escolhidos — o editor da Fase D
--   preenche quando o operador seleciona. Sem placeholders no banco
--   (decisão (b) do plano da Fase C).
--
-- SQLite não suporta ALTER TABLE … DROP NOT NULL nem ALTER COLUMN.
-- Fazemos o swap clássico: cria nova, copia, dropa antiga, renomeia.
-- Preserva todos os índices e FKs originais.

-- 1. Colunas novas (ALTER permitido para ADD COLUMN).
ALTER TABLE `orders` ADD COLUMN `customer_name` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `olist_order_id` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `marketplace` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `folder_path` text;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `archived` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- 2. Migração de status legados → 'novo' antes do recreate
--    (linhas existentes precisam casar com o novo vocabulário).
UPDATE `orders` SET `status` = 'novo'
 WHERE `status` IN ('pendente', 'enviado_cliente');
--> statement-breakpoint

-- 3. Recreate de `orders` com pattern_id/product_id nullable.
--    A tabela tem FKs entrantes (order_revisions, order_overrides,
--    export_history). PRAGMA foreign_keys=OFF garante que o swap não
--    cascateia ações de delete e que rowids são preservados.
PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `orders__new` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text,
	`product_id` text,
	`label` text NOT NULL,
	`fields` text NOT NULL,
	`material_id` text,
	`status` text DEFAULT 'novo' NOT NULL,
	`canvas_json` text NOT NULL,
	`exported_png_path` text,
	`exported_svg_paths` text,
	`customer_name` text,
	`olist_order_id` text,
	`marketplace` text,
	`folder_path` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `orders__new` (
	`id`, `pattern_id`, `product_id`, `label`, `fields`, `material_id`,
	`status`, `canvas_json`, `exported_png_path`, `exported_svg_paths`,
	`customer_name`, `olist_order_id`, `marketplace`, `folder_path`, `archived`,
	`created_at`, `updated_at`, `deleted_at`
)
SELECT
	`id`, `pattern_id`, `product_id`, `label`, `fields`, `material_id`,
	`status`, `canvas_json`, `exported_png_path`, `exported_svg_paths`,
	`customer_name`, `olist_order_id`, `marketplace`, `folder_path`, `archived`,
	`created_at`, `updated_at`, `deleted_at`
FROM `orders`;
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint

ALTER TABLE `orders__new` RENAME TO `orders`;
--> statement-breakpoint

PRAGMA foreign_keys=ON;
--> statement-breakpoint

-- 4. Índice parcial pra acelerar listagem do Kanban (filtra arquivados).
--    Custo: zero (só indexa rows arquived=0). Ganho: query do board
--    não escaneia rows arquivadas conforme o histórico cresce.
CREATE INDEX `idx_orders_active` ON `orders` (`status`, `updated_at`)
 WHERE `archived` = 0 AND `deleted_at` IS NULL;
