-- Onda 13 — Multi-broche empilhado.
--
-- Todo pedido vira multi-item. Pedido de 1 broche = prancha com 1 item.
-- Não existe modelo paralelo "pedido simples".
--
-- Mudanças nesta migration (banco vazio em dev — pode dropar e recriar):
--
--   1. orders perde 5 colunas: pattern_id, product_id, material_id, fields,
--      canvas_json. Esses 5 viram propriedade de cada item da prancha.
--      orders fica apenas com metadados do pedido (cliente, status, marketplace,
--      pasta, archived) + outputs da prancha inteira (exported_png_path,
--      exported_svg_paths).
--
--   2. Tabela nova order_items: cada linha = 1 broche na prancha.
--      position é a ordem na prancha (0-based, 0..4 = coluna 1, 5..9 = coluna 2).
--      product_id/pattern_id/material_id nullable (operador escolhe depois) —
--      espelha como orders.pattern_id/product_id viraram nullable na v9.
--
--   3. order_revisions perde fields/material_id/canvas_json (todos faziam
--      sentido só pra "uma arte por pedido"). Ganha items_json: snapshot JSON
--      do array de items daquela revisão. Mantém exported_png_path,
--      is_approved e a UNIQUE INDEX (order_id, number).
--
-- SQLite não suporta ALTER TABLE DROP COLUMN nem ALTER COLUMN. Usamos o swap
-- clássico (cria tabela nova, copia, dropa, renomeia). PRAGMA foreign_keys=OFF
-- garante que o swap não cascateia ações de delete.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- ── 1. order_items ──────────────────────────────────────────────────────────
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`position` integer NOT NULL,
	`product_id` text,
	`pattern_id` text,
	`material_id` text,
	`fields` text NOT NULL DEFAULT '{}',
	`canvas_json` text NOT NULL DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Acelera SELECT items ORDER BY position quando o editor carrega um pedido.
CREATE UNIQUE INDEX `idx_order_items_order_position` ON `order_items` (`order_id`, `position`);
--> statement-breakpoint

-- ── 2. orders: drop 5 colunas via swap ──────────────────────────────────────
CREATE TABLE `orders__new` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'novo' NOT NULL,
	`exported_png_path` text,
	`exported_svg_paths` text,
	`customer_name` text,
	`olist_order_id` text,
	`marketplace` text,
	`folder_path` text,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint

INSERT INTO `orders__new` (
	`id`, `label`, `status`, `exported_png_path`, `exported_svg_paths`,
	`customer_name`, `olist_order_id`, `marketplace`, `folder_path`, `archived`,
	`created_at`, `updated_at`, `deleted_at`
)
SELECT
	`id`, `label`, `status`, `exported_png_path`, `exported_svg_paths`,
	`customer_name`, `olist_order_id`, `marketplace`, `folder_path`, `archived`,
	`created_at`, `updated_at`, `deleted_at`
FROM `orders`;
--> statement-breakpoint

DROP TABLE `orders`;
--> statement-breakpoint

ALTER TABLE `orders__new` RENAME TO `orders`;
--> statement-breakpoint

-- Recria o índice parcial que existia na v9.
CREATE INDEX `idx_orders_active` ON `orders` (`status`, `updated_at`)
 WHERE `archived` = 0 AND `deleted_at` IS NULL;
--> statement-breakpoint

-- ── 3. order_revisions: swap pra trocar shape do snapshot ───────────────────
CREATE TABLE `order_revisions__new` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`number` integer NOT NULL,
	`items_json` text NOT NULL,
	`exported_png_path` text,
	`is_approved` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Banco vazio em dev: linhas legadas viram revisões com items_json='[]'.
-- Em prod isso ainda não rodou — não há dados a preservar.
INSERT INTO `order_revisions__new` (
	`id`, `order_id`, `number`, `items_json`, `exported_png_path`, `is_approved`, `created_at`
)
SELECT
	`id`, `order_id`, `number`, '[]', `exported_png_path`, `is_approved`, `created_at`
FROM `order_revisions`;
--> statement-breakpoint

DROP TABLE `order_revisions`;
--> statement-breakpoint

ALTER TABLE `order_revisions__new` RENAME TO `order_revisions`;
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_order_revisions_order_number` ON `order_revisions` (`order_id`, `number`);
--> statement-breakpoint

CREATE INDEX `idx_order_revisions_order_created` ON `order_revisions` (`order_id`, `created_at`);
--> statement-breakpoint

PRAGMA foreign_keys=ON;
