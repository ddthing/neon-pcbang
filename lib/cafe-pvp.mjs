// Seat-to-Seat Real-Time Multiplayer PvP Engine (Omok 15x15 & Alkkagi Stone Flick Physics)
const matchTtlMs = 15 * 60_000;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const initializedPvpDbs = new WeakSet();

function reply(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function fingerprint(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensurePvpTable(db) {
  if (initializedPvpDbs.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cafe_pvp_matches (
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
    )`).bind(),
    db.prepare(`CREATE INDEX IF NOT EXISTS cafe_pvp_matches_active ON cafe_pvp_matches(status, expires_at, updated_at DESC)`).bind(),
  ]);
  initializedPvpDbs.add(db);
}

export function createInitialPvpState(game) {
  if (game === "alkkagi") {
    return {
      stones: [
        // Host (Black: owner="host") top formation
        ...[18, 34, 50, 66, 82].map((x, i) => ({ id: "h" + i, owner: "host", x, y: i % 2 ? 22 : 18, vx: 0, vy: 0, alive: true })),
        // Guest (White: owner="guest") bottom formation
        ...[18, 34, 50, 66, 82].map((x, i) => ({ id: "g" + i, owner: "guest", x, y: i % 2 ? 78 : 82, vx: 0, vy: 0, alive: true })),
      ],
      lastShot: null,
      moveCount: 0,
    };
  }
  return {
    size: 15,
    board: new Array(225).fill(0), // 0 empty, 1 host(black), 2 guest(white)
    lastMove: -1,
    moveCount: 0,
  };
}

export function checkOmokWinner(board, index, player) {
  const size = 15;
  const r0 = Math.floor(index / size);
  const c0 = index % size;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = r0 + dr * sign;
      let c = c0 + dc * sign;
      while (r >= 0 && r < size && c >= 0 && c < size && board[r * size + c] === player) {
        count++;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

// Deterministic 2D stone physics step for Alkkagi (board 0..100 x 0..100, radius = 4.2)
export function simulateAlkkagiShot(stonesInput, stoneId, rawVx, rawVy) {
  const R = 4.2;
  const stones = stonesInput.map((s) => ({ ...s, vx: 0, vy: 0 }));
  const shooter = stones.find((s) => s.id === stoneId && s.alive);
  if (!shooter) return { error: "stone" };
  const speed = Math.hypot(rawVx, rawVy);
  if (!Number.isFinite(speed) || speed < 0.2) return { error: "power" };
  const maxSpeed = 3.8;
  const scale = speed > maxSpeed ? maxSpeed / speed : 1;
  shooter.vx = rawVx * scale;
  shooter.vy = rawVy * scale;

  for (let tick = 0; tick < 160; tick++) {
    let moving = false;
    for (const s of stones) {
      if (!s.alive) continue;
      if (Math.hypot(s.vx, s.vy) > 0.03) {
        moving = true;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.962;
        s.vy *= 0.962;
        if (s.x < 3 || s.x > 97 || s.y < 3 || s.y > 97) {
          s.alive = false;
          s.vx = s.vy = 0;
        }
      } else {
        s.vx = s.vy = 0;
      }
    }
    // Pairwise elastic collisions
    for (let i = 0; i < stones.length; i++) {
      const a = stones[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < stones.length; j++) {
        const b = stones[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < R * 2) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (R * 2 - dist) * 0.52;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const rel = dvx * nx + dvy * ny;
          if (rel > 0) {
            const impulse = rel * 0.94;
            a.vx -= impulse * nx;
            a.vy -= impulse * ny;
            b.vx += impulse * nx;
            b.vy += impulse * ny;
            moving = true;
          }
        }
      }
    }
    if (!moving) break;
  }

  for (const s of stones) {
    s.x = Math.round(s.x * 100) / 100;
    s.y = Math.round(s.y * 100) / 100;
    s.vx = s.vy = 0;
  }
  const hostAlive = stones.filter((s) => s.owner === "host" && s.alive).length;
  const guestAlive = stones.filter((s) => s.owner === "guest" && s.alive).length;
  let winner = null;
  if (hostAlive === 0 && guestAlive === 0) winner = "draw";
  else if (guestAlive === 0) winner = "host";
  else if (hostAlive === 0) winner = "guest";
  return { stones, winner };
}

function serializeMatch(row, myId) {
  if (!row) return null;
  return {
    id: row.id,
    game: row.game,
    status: row.status,
    hostName: row.host_name,
    hostSeat: row.host_seat || "",
    guestName: row.guest_name || "",
    guestSeat: row.guest_seat || "",
    role: row.host_id === myId ? "host" : row.guest_id === myId ? "guest" : "spectator",
    turn: row.turn,
    winner: row.winner || null,
    state: JSON.parse(row.state_json),
    updatedAt: row.updated_at,
  };
}

export async function pvpArena(request, db, now = Date.now()) {
  if (!db) return reply({ error: "unavailable" }, 503);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return reply({ error: "origin" }, 403);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "size" }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: "request" }, 400);
  }

  const { token, action } = body ?? {};
  if (typeof token !== "string" || !uuid.test(token) ||
      !["lobby", "create", "join", "move", "leave"].includes(action)) {
    return reply({ error: "request" }, 400);
  }

  try {
    await ensurePvpTable(db);
    const myId = await fingerprint(token);
    const rawName = typeof body.name === "string" ? body.name.trim().slice(0, 12) : "";
    const myName = /^[\p{L}\p{N} _·-]{1,12}$/u.test(rawName) ? rawName : "손님 " + myId.slice(0, 4).toUpperCase();
    const mySeat = typeof body.seat === "string" ? body.seat.slice(0, 16) : "";

    await db.prepare("DELETE FROM cafe_pvp_matches WHERE expires_at <= ?").bind(now).run();

    if (action === "create") {
      const game = body.game === "alkkagi" ? "alkkagi" : "omok";
      const matchId = crypto.randomUUID();
      const targetSeat = typeof body.targetSeat === "string" ? body.targetSeat.slice(0, 16) : "";
      const initial = createInitialPvpState(game);
      if (targetSeat) initial.invitedSeat = targetSeat;
      await db.batch([
        db.prepare("DELETE FROM cafe_pvp_matches WHERE host_id = ? AND status = 'waiting'").bind(myId),
        db.prepare(`INSERT INTO cafe_pvp_matches
          (id, game, status, host_id, host_name, host_seat, turn, state_json, created_at, updated_at, expires_at)
          VALUES (?, ?, 'waiting', ?, ?, ?, 'host', ?, ?, ?, ?)`)
          .bind(matchId, game, myId, myName, mySeat, JSON.stringify(initial), now, now, now + matchTtlMs),
      ]);
      const created = await db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId).first();
      return reply({ now, match: serializeMatch(created, myId) });
    }

    if (action === "join") {
      const matchId = typeof body.matchId === "string" && uuid.test(body.matchId) ? body.matchId : "";
      if (!matchId) return reply({ error: "match" }, 400);
      await db.prepare(`UPDATE cafe_pvp_matches
        SET status = 'playing', guest_id = ?, guest_name = ?, guest_seat = ?, updated_at = ?, expires_at = ?
        WHERE id = ? AND status = 'waiting' AND host_id <> ?`)
        .bind(myId, myName, mySeat, now, now + matchTtlMs, matchId, myId).run();
      const joined = await db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId).first();
      if (!joined) return reply({ error: "not_found" }, 404);
      return reply({ now, match: serializeMatch(joined, myId) });
    }

    if (action === "move") {
      const matchId = typeof body.matchId === "string" && uuid.test(body.matchId) ? body.matchId : "";
      const row = await db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId).first();
      if (!row || row.status !== "playing") return reply({ error: "state" }, 409);
      const role = row.host_id === myId ? "host" : row.guest_id === myId ? "guest" : "";
      if (!role || row.turn !== role) return reply({ error: "turn", match: serializeMatch(row, myId) }, 409);

      const state = JSON.parse(row.state_json);
      let winner = null;
      const nextTurn = role === "host" ? "guest" : "host";

      if (row.game === "omok") {
        const index = Number(body.index);
        if (!Number.isInteger(index) || index < 0 || index >= 225 || state.board[index] !== 0) {
          return reply({ error: "cell", match: serializeMatch(row, myId) }, 400);
        }
        const stoneVal = role === "host" ? 1 : 2;
        state.board[index] = stoneVal;
        state.lastMove = index;
        state.moveCount = (state.moveCount || 0) + 1;
        if (checkOmokWinner(state.board, index, stoneVal)) winner = role;
        else if (state.moveCount >= 225) winner = "draw";
      } else {
        const stoneId = typeof body.stoneId === "string" ? body.stoneId : "";
        const targetStone = state.stones.find((s) => s.id === stoneId && s.owner === role && s.alive);
        if (!targetStone) return reply({ error: "stone", match: serializeMatch(row, myId) }, 400);
        const sim = simulateAlkkagiShot(state.stones, stoneId, Number(body.vx), Number(body.vy));
        if (sim.error) return reply({ error: sim.error }, 400);
        state.stones = sim.stones;
        state.lastShot = { stoneId, vx: Number(body.vx), vy: Number(body.vy), by: role };
        state.moveCount = (state.moveCount || 0) + 1;
        winner = sim.winner;
      }

      const nextStatus = winner ? "finished" : "playing";
      await db.prepare(`UPDATE cafe_pvp_matches
        SET state_json = ?, turn = ?, status = ?, winner = ?, updated_at = ?, expires_at = ?
        WHERE id = ? AND updated_at = ?`)
        .bind(JSON.stringify(state), nextTurn, nextStatus, winner, now, now + matchTtlMs, matchId, row.updated_at).run();
      const updated = await db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId).first();
      return reply({ now, match: serializeMatch(updated, myId) });
    }

    if (action === "leave") {
      const matchId = typeof body.matchId === "string" && uuid.test(body.matchId) ? body.matchId : "";
      if (matchId) {
        const row = await db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId).first();
        if (row) {
          if (row.status === "waiting" && row.host_id === myId) {
            await db.prepare("DELETE FROM cafe_pvp_matches WHERE id = ?").bind(matchId).run();
          } else if (row.status === "playing" && (row.host_id === myId || row.guest_id === myId)) {
            const forfeitWinner = row.host_id === myId ? "guest" : "host";
            await db.prepare("UPDATE cafe_pvp_matches SET status = 'finished', winner = ?, updated_at = ? WHERE id = ?")
              .bind(forfeitWinner, now, matchId).run();
          }
        }
      }
      return reply({ now, ok: true });
    }

    // Default: "lobby" (+ optional current match sync)
    const matchId = typeof body.matchId === "string" && uuid.test(body.matchId) ? body.matchId : "";
    const ops = [
      db.prepare(`SELECT id, game, status, host_id, host_name, host_seat, guest_id, guest_name, guest_seat, turn, winner, state_json, updated_at
        FROM cafe_pvp_matches WHERE expires_at > ? AND status IN ('waiting', 'playing')
        ORDER BY updated_at DESC LIMIT 12`).bind(now),
    ];
    if (matchId) {
      ops.push(db.prepare("SELECT * FROM cafe_pvp_matches WHERE id = ?").bind(matchId));
    }
    const res = await db.batch(ops);
    const rooms = res[0].results.map((r) => ({
      id: r.id,
      game: r.game,
      status: r.status,
      hostName: r.host_name,
      hostSeat: r.host_seat || "",
      guestName: r.guest_name || "",
      isMine: r.host_id === myId || r.guest_id === myId,
      invitedSeat: JSON.parse(r.state_json).invitedSeat || "",
    }));
    const match = matchId ? serializeMatch(res[1]?.results?.[0], myId) : null;
    return reply({ now, rooms, match });
  } catch (error) {
    console.error("PvP error", error instanceof Error ? error.message : "D1");
    return reply({ error: "unavailable" }, 503);
  }
}
