-- Onda 23.hardening — FK ON DELETE CASCADE em order_items + order_revisions.
--
-- Razão: order_items e order_revisions são "child" semanticamente de orders.
-- Hoje só temos soft-delete (deleted_at), então o problema é inerte. Mas se
-- algum cleanup futuro rodar DELETE FROM orders WHERE deleted_at < <epoch>,
-- as FKs com ON DELETE no action deixam linhas órfãs com pai inexistente.
--
-- SQLite não suporta ALTER FOREIGN KEY — precisa swap clássico (cria nova,
-- copia, dropa, renomeia). PRAGMA foreign_keys=OFF durante o swap.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- ── 1. order_items: swap das FKs ───────────────────────────────────────────
CREATE TABLE `order_items__new` (
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
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE CASCADE,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

INSERT INTO `order_items__new` (
	`id`, `order_id`, `position`, `product_id`, `pattern_id`, `material_id`,
	`fields`, `canvas_json`, `created_at`, `updated_at`
)
SELECT
	`id`, `order_id`, `position`, `product_id`, `pattern_id`, `material_id`,
	`fields`, `canvas_json`, `created_at`, `updated_at`
FROM `order_items`;
--> statement-breakpoint

DROP TABLE `order_items`;
--> statement-breakpoint

ALTER TABLE `order_items__new` RENAME TO `order_items`;
--> statement-breakpoint

CREATE UNIQUE INDEX `idx_order_items_order_position` ON `order_items` (`order_id`, `position`);
--> statement-breakpoint

-- ── 2. order_revisions: swap da FK ──────────────────────────────────────────
-- Mantém todas as colunas adicionadas até v12 (inclusive board_canvas_json
-- da migration 0011).
CREATE TABLE `order_revisions__new` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`number` integer NOT NULL,
	`items_json` text NOT NULL,
	`board_canvas_json` text NOT NULL DEFAULT '{}',
	`exported_png_path` text,
	`is_approved` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint

INSERT INTO `order_revisions__new` (
	`id`, `order_id`, `number`, `items_json`, `board_canvas_json`,
	`exported_png_path`, `is_approved`, `created_at`
)
SELECT
	`id`, `order_id`, `number`, `items_json`, `board_canvas_json`,
	`exported_png_path`, `is_approved`, `created_at`
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
