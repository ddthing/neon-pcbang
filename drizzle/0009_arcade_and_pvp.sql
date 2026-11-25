CREATE TABLE IF NOT EXISTS cafe_leaderboard (
  id TEXT PRIMARY KEY NOT NULL,
  game TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'standard',
  member_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score INTEGER NOT NULL,
  metric TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS cafe_leaderboard_member_game ON cafe_leaderboard(game, mode, member_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_leaderboard_top ON cafe_leaderboard(game, mode, score DESC, updated_at ASC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cafe_pvp_matches (
  id TEXT PRIMARY KEY NOT NULL,
  game TEXT NOT NULL,
  status TEXT NOT NULL,
  host_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  host_seat TEXT,
  guest_id TEXT,
  guest_name TEXT,
  guest_seat TEXT,
  turn TEXT NOT NULL,
  winner TEXT,
  state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cafe_pvp_matches_active ON cafe_pvp_matches(status, expires_at, updated_at DESC);
