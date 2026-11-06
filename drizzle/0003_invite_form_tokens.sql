CREATE TABLE IF NOT EXISTS invite_form_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invite_form_tokens_expiry ON invite_form_tokens(expires_at);
