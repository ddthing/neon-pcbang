CREATE TABLE `cafe_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`facing` integer NOT NULL,
	`seat` text,
	`wave` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cafe_visitors_seat` ON `cafe_visitors` (`seat`);--> statement-breakpoint
CREATE INDEX `cafe_visitors_expires` ON `cafe_visitors` (`expires`);