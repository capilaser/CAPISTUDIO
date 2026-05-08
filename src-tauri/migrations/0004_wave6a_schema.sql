CREATE TABLE `appliques` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`width_mm` real,
	`height_mm` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `engravings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`width_mm` real,
	`height_mm` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `markings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`file_path` text NOT NULL,
	`thumbnail_path` text,
	`width_mm` real,
	`height_mm` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `pattern_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern_id` text NOT NULL,
	`name` text NOT NULL,
	`z_index` integer DEFAULT 0 NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`svg_file_path` text,
	`material_id` text,
	`width_mm` real,
	`height_mm` real,
	`position_x_mm` real DEFAULT 0 NOT NULL,
	`position_y_mm` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `pattern_slots` ADD `parent_layer_id` text REFERENCES pattern_layers(id);