CREATE TABLE `attendances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agenda_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`agenda_id`) REFERENCES `agendas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendances_agenda_member_unique` ON `attendances` (`agenda_id`,`member_id`);--> statement-breakpoint
ALTER TABLE `members` ADD `xp` integer DEFAULT 0 NOT NULL;