CREATE TABLE `learning_resource_collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_resource_collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_id` integer NOT NULL,
	`resource_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_resource_collection_items_collection_resource_unique` ON `learning_resource_collection_items` (`collection_id`,`resource_id`);
