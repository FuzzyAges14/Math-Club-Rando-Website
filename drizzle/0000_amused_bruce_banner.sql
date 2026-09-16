CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` text NOT NULL,
	`student_name` text NOT NULL,
	`email` text NOT NULL,
	`grade` text NOT NULL,
	`subject` text NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `slots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_slot_id_unique` ON `bookings` (`slot_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`date` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`volunteer_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`join_url` text NOT NULL,
	FOREIGN KEY (`volunteer_id`) REFERENCES `volunteers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_volunteer_time_idx` ON `slots` (`volunteer_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `volunteers` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`bio` text NOT NULL,
	`subjects` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `volunteers_username_unique` ON `volunteers` (`username`);