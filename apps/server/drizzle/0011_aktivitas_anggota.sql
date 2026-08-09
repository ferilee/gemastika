CREATE TABLE `member_activity_daily` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `member_key` text NOT NULL,
  `activity_date` text NOT NULL,
  `visit_count` integer DEFAULT 0 NOT NULL,
  `last_visited_at` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_activity_daily_member_date_unique` ON `member_activity_daily` (`member_key`,`activity_date`);
