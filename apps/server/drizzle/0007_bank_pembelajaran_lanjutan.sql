ALTER TABLE `learning_resources` ADD `tags` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `storage_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `thumbnail_storage_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `view_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `download_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `learning_resource_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`version` integer NOT NULL,
	`resource_url` text DEFAULT '' NOT NULL,
	`file_name` text DEFAULT '' NOT NULL,
	`storage_key` text DEFAULT '' NOT NULL,
	`change_note` text DEFAULT '' NOT NULL,
	`created_by_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_resource_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`user_key` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_resource_favorites_resource_user_unique` ON `learning_resource_favorites` (`resource_id`,`user_key`);
--> statement-breakpoint
CREATE TABLE `learning_resource_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`resource_id` integer NOT NULL,
	`user_key` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_resource_ratings_resource_user_unique` ON `learning_resource_ratings` (`resource_id`,`user_key`);
