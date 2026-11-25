ALTER TABLE cafe_visitors ADD COLUMN zone TEXT NOT NULL DEFAULT 'hall';
--> statement-breakpoint
ALTER TABLE cafe_visitors ADD COLUMN avatar TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE cafe_visitors ADD COLUMN activity TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_visitors_zone_expires ON cafe_visitors(zone, expires);
