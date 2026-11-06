CREATE TABLE IF NOT EXISTS cafe_loyalty (
  member_id TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  day_ms INTEGER NOT NULL DEFAULT 0,
  total_ms INTEGER NOT NULL DEFAULT 0,
  active_at INTEGER NOT NULL DEFAULT 0,
  claim_day TEXT NOT NULL DEFAULT '',
  stamps INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cafe_orders (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL,
  seat TEXT NOT NULL,
  items TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  coupon INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  ready_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_orders_recent ON cafe_orders(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_orders_member ON cafe_orders(member_id, coupon, ready_at);
