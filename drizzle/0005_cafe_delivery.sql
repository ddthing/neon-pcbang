ALTER TABLE cafe_orders ADD COLUMN visitor_id TEXT;
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN start_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN return_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE cafe_orders ADD COLUMN left_at INTEGER;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_orders_attendant ON cafe_orders(start_at, return_at, left_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_orders_visitor ON cafe_orders(visitor_id, left_at, ready_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_orders_return ON cafe_orders(return_at);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS cafe_visitors_expire_delivery
BEFORE DELETE ON cafe_visitors
WHEN OLD.seat IS NOT NULL
BEGIN
  UPDATE cafe_orders
  SET left_at = OLD.expires
  WHERE visitor_id = OLD.id AND seat = OLD.seat AND left_at IS NULL;
END;
