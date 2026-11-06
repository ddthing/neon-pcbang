CREATE TABLE IF NOT EXISTS invite_code_vault (
  invite_id TEXT PRIMARY KEY NOT NULL REFERENCES invite_codes(id),
  sealed TEXT NOT NULL
);
