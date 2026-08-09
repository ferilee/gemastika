ALTER TABLE `learning_resources` ADD `link_checked_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `link_check_status` text DEFAULT 'unknown' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `link_check_error` text DEFAULT '' NOT NULL;
