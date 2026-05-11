ALTER TABLE `appliques` ADD `operation` text DEFAULT 'corte' NOT NULL;--> statement-breakpoint
ALTER TABLE `appliques` ADD `machines` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `engravings` ADD `operation` text DEFAULT 'gravacao' NOT NULL;--> statement-breakpoint
ALTER TABLE `engravings` ADD `machines` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `markings` ADD `category_id` text REFERENCES categories(id);--> statement-breakpoint
ALTER TABLE `markings` ADD `operation` text DEFAULT 'marcacao' NOT NULL;--> statement-breakpoint
ALTER TABLE `markings` ADD `machines` text DEFAULT '[]' NOT NULL;