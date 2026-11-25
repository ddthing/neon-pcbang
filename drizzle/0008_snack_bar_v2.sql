ALTER TABLE cafe_loyalty ADD COLUMN points INTEGER NOT NULL DEFAULT 150;
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN gift_from TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN gift_note TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN eaten_at INTEGER;
