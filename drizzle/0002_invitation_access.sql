CREATE TABLE IF NOT EXISTS invite_codes (
  id TEXT PRIMARY KEY NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invite_codes_created ON invite_codes(created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invite_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  invite_id TEXT REFERENCES invite_codes(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invite_sessions_expiry ON invite_sessions(expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invite_sessions_invite ON invite_sessions(invite_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invite_login_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invite_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO invite_settings(key, value) VALUES ('site_access', 'invite');

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invite_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO invite_settings (key, value) VALUES ('site_access', 'invite');
