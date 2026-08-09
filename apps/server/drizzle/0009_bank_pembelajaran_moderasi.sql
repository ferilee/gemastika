ALTER TABLE `learning_resources` ADD `review_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `archived_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `learning_resources` ADD `archive_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `learning_resource_reports` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `resource_id` integer NOT NULL,
  `reporter_key` text NOT NULL,
  `reason` text NOT NULL,
  `detail` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'open' NOT NULL,
  `reviewed_by` text DEFAULT '' NOT NULL,
  `reviewed_at` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `learning_resource_reports_status_created_at` ON `learning_resource_reports` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `user_notifications` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `recipient_key` text NOT NULL,
  `type` text NOT NULL,
  `title` text NOT NULL,
  `message` text DEFAULT '' NOT NULL,
  `href` text DEFAULT '' NOT NULL,
  `read_at` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_notifications_recipient_created_at` ON `user_notifications` (`recipient_key`,`created_at`);
