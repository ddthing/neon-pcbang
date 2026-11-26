const validGames = new Set([
  "pvp", "tetris", "bungeoppang", "tycoon", "acidrain",
  "mines", "arcade", "merge", "sudoku", "solitaire", "knit",
]);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const initializedDbs = new WeakSet();

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function fingerprint(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureTable(db) {
  if (initializedDbs.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cafe_leaderboard (
      id TEXT PRIMARY KEY NOT NULL,
      game TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'standard',
      member_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      score INTEGER NOT NULL,
      metric TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    )`).bind(),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS cafe_leaderboard_member_game ON cafe_leaderboard(game, mode, member_id)`).bind(),
    db.prepare(`CREATE INDEX IF NOT EXISTS cafe_leaderboard_top ON cafe_leaderboard(game, mode, score DESC, updated_at ASC)`).bind(),
  ]);
  initializedDbs.add(db);
}

export async function arcadeLeaderboard(request, db, now = Date.now()) {
  if (!db) return reply({ error: "unavailable" }, 503);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return reply({ error: "origin" }, 403);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply({ error: "size" }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: "request" }, 400);
  }

  const game = typeof body?.game === "string" && validGames.has(body.game) ? body.game : "";
  const mode = typeof body?.mode === "string" && /^[a-z0-9_-]{1,18}$/i.test(body.mode) ? body.mode.toLowerCase() : "standard";
  const action = body?.action === "submit" ? "submit" : "list";
  if (!game) return reply({ error: "game" }, 400);

  try {
    await ensureTable(db);
    const lowerIsBetter = game === "mines";
    const ops = [];

    if (action === "submit") {
      if (typeof body.member !== "string" || !uuid.test(body.member)) return reply({ error: "member" }, 400);
      const score = Number(body.score);
      if (!Number.isInteger(score) || score < 1 || score > 9_999_999) return reply({ error: "score" }, 400);
      const memberId = await fingerprint(body.member);
      const rawName = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 12) : "";
      const nickname = /^[\p{L}\p{N} _·-]{1,12}$/u.test(rawName) ? rawName : "단골 " + memberId.slice(0, 4).toUpperCase();
      const metric = typeof body.metric === "string" ? body.metric.slice(0, 24) : "";

      ops.push(db.prepare(`INSERT INTO cafe_leaderboard (id, game, mode, member_id, nickname, score, metric, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game, mode, member_id) DO UPDATE SET
          nickname = excluded.nickname,
          metric = CASE WHEN ${lowerIsBetter ? "excluded.score < cafe_leaderboard.score" : "excluded.score > cafe_leaderboard.score"}
            THEN excluded.metric ELSE cafe_leaderboard.metric END,
          updated_at = CASE WHEN ${lowerIsBetter ? "excluded.score < cafe_leaderboard.score" : "excluded.score > cafe_leaderboard.score"}
            THEN excluded.updated_at ELSE cafe_leaderboard.updated_at END,
          score = ${lowerIsBetter ? "MIN(cafe_leaderboard.score, excluded.score)" : "MAX(cafe_leaderboard.score, excluded.score)"}`)
        .bind(crypto.randomUUID(), game, mode, memberId, nickname, score, metric, now));
    }

    ops.push(db.prepare(`SELECT nickname, score, metric, updated_at FROM cafe_leaderboard
      WHERE game = ? AND mode = ?
      ORDER BY score ${lowerIsBetter ? "ASC" : "DESC"}, updated_at ASC LIMIT 10`)
      .bind(game, mode));

    const results = await db.batch(ops);
    const entries = results.at(-1).results.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      score: row.score,
      metric: row.metric,
      updatedAt: row.updated_at,
    }));
    return reply({ game, mode, lowerIsBetter, entries });
  } catch (error) {
    console.error("Leaderboard error", error instanceof Error ? error.message : "D1");
    return reply({ error: "unavailable" }, 503);
  }
}
