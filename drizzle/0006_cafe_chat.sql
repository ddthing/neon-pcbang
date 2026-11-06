CREATE TABLE IF NOT EXISTS cafe_chat_rate_limits (
  actor_id TEXT PRIMARY KEY NOT NULL,
  last_sent_at INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  window_count INTEGER NOT NULL,
  last_text_hash TEXT NOT NULL,
  last_nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_chat_rate_limits_expiry ON cafe_chat_rate_limits(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cafe_chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  space TEXT NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_chat_messages_space_expiry ON cafe_chat_messages(space, expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_chat_messages_expiry ON cafe_chat_messages(expires_at);
