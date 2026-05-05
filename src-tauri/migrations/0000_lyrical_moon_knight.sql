CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `export_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`kind` text NOT NULL,
	`machine_id` text,
	`file_path` text NOT NULL,
	`file_size_bytes` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fonts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`family` text NOT NULL,
	`source` text NOT NULL,
	`file` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `logos` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_path` text NOT NULL,
	`format` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `machine_operations` (
	`machine_id` text NOT NULL,
	`operation_id` text NOT NULL,
	PRIMARY KEY(`machine_id`, `operation_id`),
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operation_id`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `material_families` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`brushed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`label` text NOT NULL,
	`swatch` text NOT NULL,
	`png_path` text NOT NULL,
	`fallback_stops` text,
	FOREIGN KEY (`family_id`) REFERENCES `material_families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operations` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`default_color` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`before` text,
	`after` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`fields` text NOT NULL,
	`material_id` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`canvas_json` text NOT NULL,
	`exported_png_path` text,
	`exported_svg_paths` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pattern_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text NOT NULL,
	`slot_type` text NOT NULL,
	`position_x` real NOT NULL,
	`position_y` real NOT NULL,
	`max_width` real NOT NULL,
	`max_height` real NOT NULL,
	`default_font_id` text,
	`meta` text,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_font_id`) REFERENCES `fonts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`wave` integer DEFAULT 1 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`canvas_json` text NOT NULL,
	`default_material_id` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_validated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`z_index` integer DEFAULT 0 NOT NULL,
	`svg` text,
	`default_operation` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_operation`) REFERENCES `operations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_machines` (
	`product_id` text NOT NULL,
	`machine_id` text NOT NULL,
	PRIMARY KEY(`product_id`, `machine_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`icon` text,
	`status` text DEFAULT 'published' NOT NULL,
	`canvas_mm` text NOT NULL,
	`view_box` text NOT NULL,
	`allowed_slot_types` text NOT NULL,
	`constraints` text NOT NULL,
	`version_rev` integer DEFAULT 1 NOT NULL,
	`base_svg` text,
	`config` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slot_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`is_text` integer NOT NULL,
	`default_max_width_mm` real,
	`default_max_height_mm` real
);
--> statement-breakpoint
CREATE TABLE `svg_bases` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`product_id` text,
	`file_path` text NOT NULL,
	`width_mm` real,
	`height_mm` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
