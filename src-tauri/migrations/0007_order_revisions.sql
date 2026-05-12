CREATE TABLE `order_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`number` integer NOT NULL,
	`fields` text NOT NULL,
	`material_id` text,
	`canvas_json` text NOT NULL,
	`exported_png_path` text,
	`is_approved` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_order_revisions_order_number` ON `order_revisions` (`order_id`, `number`);
--> statement-breakpoint
CREATE INDEX `idx_order_revisions_order_created` ON `order_revisions` (`order_id`, `created_at`);
