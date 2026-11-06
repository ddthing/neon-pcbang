import { canWalk, entrance } from "./cafe-world.mjs";

const lifetime = 40_000;
const seats = { hall: 88, solo: 1, duo: 2, team: 5, squad: 6 };

function validSeat(seat) {
  if (typeof seat !== "string") return false;
  const match = /^(hall|solo|duo|team|squad):(0|[1-9][0-9]?)$/.exec(seat);
  return Boolean(match && Number(match[2]) < seats[match[1]]);
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function presence(request, db) {
  if (!db) return json({ error: "unavailable" }, 503);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "origin" }, 403);

  let input;
  try {
    const body = await request.text();
    if (body.length > 1024) return json({ error: "size" }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: "request" }, 400);
  }
  const token = input?.token;
  const action = input?.action;
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token) ||
      !["sync", "wave", "reserve", "release"].includes(action)) return json({ error: "request" }, 400);
  if (action === "reserve" && !validSeat(input.seat)) return json({ error: "seat" }, 400);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  const name = typeof input.name === "string" ? input.name.slice(0, 12).trim() : "";
  const nickname = /^[\p{L}\p{N} _·-]{1,12}$/u.test(name) ? name : "손님 " + id.slice(0, 4).toUpperCase();
  const color = Number.isInteger(input.color) && input.color >= 0 && input.color < 4 ? input.color : 0;
  const position = Number.isFinite(input.x) && Number.isFinite(input.y) && canWalk(input.x, input.y) ? input : entrance;
  const facing = input.facing === -1 ? -1 : 1;
  const operations = [
    db.prepare("DELETE FROM cafe_visitors WHERE expires <= ?").bind(now),
    db.prepare(`INSERT INTO cafe_visitors (id, name, color, x, y, facing, wave, expires)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, x=excluded.x, y=excluded.y,
      facing=excluded.facing, wave=MAX(cafe_visitors.wave, excluded.wave), expires=excluded.expires`)
      .bind(id, nickname, color, position.x, position.y, facing, action === "wave" ? now : 0, now + lifetime),
  ];
  if (action === "reserve") {
    operations.push(db.prepare(`UPDATE cafe_visitors SET seat=? WHERE id=?
      AND NOT EXISTS (SELECT 1 FROM cafe_visitors WHERE seat=? AND id<>?)`)
      .bind(input.seat, id, input.seat, id));
  } else if (action === "release") {
    operations.push(db.prepare("UPDATE cafe_visitors SET seat=NULL WHERE id=?").bind(id));
  }
  operations.push(db.prepare(`SELECT id, name, color, x, y, facing, seat, wave FROM cafe_visitors
    WHERE expires > ? ORDER BY (id=?) DESC, expires DESC LIMIT 120`).bind(now, id));
  try {
    const result = await db.batch(operations);
    const visitors = result.at(-1).results;
    const mine = visitors.find((visitor) => visitor.id === id);
    return json({ now, id, mine: mine?.seat ?? null, visitors }, action === "reserve" && mine?.seat !== input.seat ? 409 : 200);
  } catch (error) {
    console.error("Cafe presence unavailable", error instanceof Error ? error.message : "D1 error");
    return json({ error: "unavailable" }, 503);
  }
}
