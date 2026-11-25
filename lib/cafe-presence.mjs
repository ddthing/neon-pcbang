import { canWalkInSpace, entrance, relaxZones } from "./cafe-world.mjs";
import { cafeChatSpace, normalizeCafeChatText } from "./cafe-chat.mjs";
import { cafeDeliverySeatMutation, ensureV2OrderDetection, prepareCafeDeliveryReads } from "./cafe-delivery.mjs";

const lifetime = 40_000;
const chatLifetime = 15_000;
const chatBurstWindow = 30_000;
const chatMinInterval = 2_000;
const chatRepeatInterval = 10_000;
const chatBurstLimit = 5;
const seats = { hall: 88, solo: 1, duo: 2, team: 5, squad: 6 };
const cafeSpaces = new Set([...Object.keys(seats), "booth", "terrace"]);
const validActivities = new Set([
  "", "idle", "smoke", "coffee", "candy", "eat", "focus",
  "game:pvp", "game:tetris", "game:bungeoppang", "game:tycoon", "game:acidrain",
  "game:mines", "game:arcade", "game:merge", "game:sudoku",
]);

const v2SupportCache = new WeakMap();
async function checkV2VisitorSchema(db) {
  if (v2SupportCache.get(db) === true) return true;
  let supported = false;
  try {
    await db.prepare("SELECT zone, avatar, activity FROM cafe_visitors LIMIT 0").bind().all();
    supported = true;
  } catch {
    supported = false;
  }
  if (supported) v2SupportCache.set(db, true);
  return supported;
}

function validSeat(seat) {
  if (typeof seat !== "string") return false;
  const match = /^(hall|solo|duo|team|squad):(0|[1-9][0-9]?)$/.exec(seat);
  return Boolean(match && Number(match[2]) < seats[match[1]]);
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function readBodyBounded(request, maximumBytes) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximumBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function chatPayload(messages = []) {
  return messages.map((message) => ({
    id: message.id,
    sender: message.sender,
    text: message.text,
    expiresAt: message.expires_at,
    space: message.space,
  }));
}

export async function presence(request, db, options = {}, now = Date.now()) {
  if (!db) return json({ error: "unavailable" }, 503);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "origin" }, 403);

  let input;
  try {
    const body = await readBodyBounded(request, 1024);
    if (body === null) return json({ error: "size" }, 413);
    input = JSON.parse(body);
  } catch {
    return json({ error: "request" }, 400);
  }
  const token = input?.token;
  const action = input?.action;
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token) ||
      !["sync", "wave", "reserve", "release", "say"].includes(action)) return json({ error: "request" }, 400);
  if (action === "reserve" && !validSeat(input.seat)) return json({ error: "seat" }, 400);

  const requestedZone = (input.zone === "booth" || input.zone === "terrace") ? input.zone : "hall";
  const expectedSpace = input.space === "lobby" ? "hall" : input.space;
  let message;
  if (action === "say") {
    const checked = normalizeCafeChatText(input.text);
    if (checked.error) return json({ error: checked.error }, 400);
    if (!cafeSpaces.has(expectedSpace)) return json({ error: "chat_invalid" }, 400);
    message = checked;
  }
  const v2 = await checkV2VisitorSchema(db);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const name = typeof input.name === "string" ? input.name.slice(0, 12).trim() : "";
  const nickname = /^[\p{L}\p{N} _·-]{1,12}$/u.test(name) ? name : "손님 " + id.slice(0, 4).toUpperCase();
  const color = Number.isInteger(input.color) && input.color >= 0 && input.color < 8 ? input.color : 0;
  const avatar = typeof input.avatar === "string" && /^[0-9a-f]{6}$/i.test(input.avatar) ? input.avatar.toLowerCase() : "";
  const activity = typeof input.activity === "string" && validActivities.has(input.activity) ? input.activity : "";

  const walkSpace = v2 ? requestedZone : "hall";
  const fallbackPoint = walkSpace === "booth" ? relaxZones.booth.door
    : walkSpace === "terrace" ? relaxZones.terrace.door : entrance;
  const position = Number.isFinite(input.x) && Number.isFinite(input.y) && canWalkInSpace(input.x, input.y, walkSpace)
    ? input : fallbackPoint;
  const facing = input.facing === -1 ? -1 : 1;

  const operations = [
    db.prepare("DELETE FROM cafe_visitors WHERE expires <= ?").bind(now),
  ];

  if (v2) {
    // When reserving a seat, automatically bring the visitor back out of break zones to their seat space
    const effectiveZone = action === "reserve" ? "hall" : requestedZone;
    operations.push(
      db.prepare(`INSERT INTO cafe_visitors (id, name, color, x, y, facing, wave, zone, avatar, activity, expires)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, x=excluded.x, y=excluded.y,
        facing=excluded.facing, wave=MAX(cafe_visitors.wave, excluded.wave),
        zone=excluded.zone, avatar=excluded.avatar, activity=excluded.activity, expires=excluded.expires`)
        .bind(id, nickname, color, position.x, position.y, facing, action === "wave" ? now : 0, effectiveZone, avatar, activity, now + lifetime),
    );
  } else {
    operations.push(
      db.prepare(`INSERT INTO cafe_visitors (id, name, color, x, y, facing, wave, expires)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, x=excluded.x, y=excluded.y,
        facing=excluded.facing, wave=MAX(cafe_visitors.wave, excluded.wave), expires=excluded.expires`)
        .bind(id, nickname, color, position.x, position.y, facing, action === "wave" ? now : 0, now + lifetime),
    );
  }

  if (action === "reserve") {
    operations.push(db.prepare(`UPDATE cafe_visitors SET seat=? WHERE id=?
      AND NOT EXISTS (SELECT 1 FROM cafe_visitors WHERE seat=? AND id<>?)`)
      .bind(input.seat, id, input.seat, id));
    operations.push(cafeDeliverySeatMutation(db, id, now));
  } else if (action === "release") {
    operations.push(db.prepare("UPDATE cafe_visitors SET seat=NULL WHERE id=?").bind(id));
    operations.push(cafeDeliverySeatMutation(db, id, now));
  }

  const visitorSelect = v2
    ? db.prepare(`SELECT id, name, color, x, y, facing, seat, wave, zone, avatar, activity FROM cafe_visitors
        WHERE expires > ? ORDER BY (id=?) DESC, expires DESC LIMIT 120`).bind(now, id)
    : db.prepare(`SELECT id, name, color, x, y, facing, seat, wave FROM cafe_visitors
        WHERE expires > ? ORDER BY (id=?) DESC, expires DESC LIMIT 120`).bind(now, id);

  const spaceExpr = v2
    ? `(CASE WHEN zone IN ('booth', 'terrace') THEN zone WHEN seat IS NULL OR seat LIKE 'hall:%' THEN 'hall' ELSE substr(seat, 1, instr(seat, ':') - 1) END)`
    : `(CASE WHEN seat IS NULL OR seat LIKE 'hall:%' THEN 'hall' ELSE substr(seat, 1, instr(seat, ':') - 1) END)`;
  const visitorSpaceExpr = spaceExpr.replaceAll("zone", "v.zone").replaceAll("seat", "v.seat");

  let chatWriteIndex = -1;
  let chatRateIndex = -1;
  let chatRateReadIndex = -1;
  let chatSnapshotIndex = -1;
  let chatTextHash = "";
  if (action === "say" && message) {
    let actor = null;
    try { actor = await options.resolveChatActor?.(); } catch {}
    const actorId = typeof actor === "string" && actor ? actor : "visitor:" + id;
    const filteredTextHash = Array.from(new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(message.filteredText),
    )), (byte) => byte.toString(16).padStart(2, "0")).join("");
    chatTextHash = filteredTextHash;
    const nonce = crypto.randomUUID();
    operations.push(
      db.prepare("DELETE FROM cafe_chat_messages WHERE expires_at <= ?").bind(now),
      db.prepare("DELETE FROM cafe_chat_rate_limits WHERE expires_at <= ?").bind(now),
    );
    chatRateIndex = operations.length;
    operations.push(db.prepare(`INSERT INTO cafe_chat_rate_limits
        (actor_id, last_sent_at, window_started_at, window_count, last_text_hash, last_nonce, expires_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(actor_id) DO UPDATE SET
        window_started_at = CASE
          WHEN excluded.last_sent_at - cafe_chat_rate_limits.window_started_at >= ?
          THEN excluded.last_sent_at ELSE cafe_chat_rate_limits.window_started_at END,
        window_count = CASE
          WHEN excluded.last_sent_at - cafe_chat_rate_limits.window_started_at >= ?
          THEN 1 ELSE cafe_chat_rate_limits.window_count + 1 END,
        last_sent_at = excluded.last_sent_at,
        last_text_hash = excluded.last_text_hash,
        last_nonce = excluded.last_nonce,
        expires_at = excluded.expires_at
      WHERE cafe_chat_rate_limits.last_sent_at <= excluded.last_sent_at - ?
        AND (excluded.last_sent_at - cafe_chat_rate_limits.window_started_at >= ?
          OR cafe_chat_rate_limits.window_count < ?)
        AND (cafe_chat_rate_limits.last_text_hash <> excluded.last_text_hash
          OR excluded.last_sent_at - cafe_chat_rate_limits.last_sent_at >= ?)
        AND EXISTS (SELECT 1 FROM cafe_visitors v
          WHERE v.id = ? AND v.expires > ?
            AND ${visitorSpaceExpr} = ?)`)
      .bind(actorId, now, now, filteredTextHash, nonce, now + 60_000,
        chatBurstWindow, chatBurstWindow, chatMinInterval, chatBurstWindow,
        chatBurstLimit, chatRepeatInterval, id, now, expectedSpace));
    chatRateReadIndex = operations.length;
    operations.push(db.prepare(`SELECT last_sent_at, window_started_at, window_count, last_text_hash
      FROM cafe_chat_rate_limits WHERE actor_id=?`).bind(actorId));
    chatWriteIndex = operations.length;
    operations.push(db.prepare(`INSERT INTO cafe_chat_messages (id, space, sender, text, created_at, expires_at)
      SELECT ?, ${visitorSpaceExpr}, v.id, ?, ?, ?
      FROM cafe_visitors v
      WHERE v.id = ? AND v.expires > ?
        AND ${visitorSpaceExpr} = ?
        AND EXISTS (SELECT 1 FROM cafe_chat_rate_limits
                    WHERE actor_id = ? AND last_nonce = ?)`)
      .bind(nonce, message.text, now, now + chatLifetime, id, now, expectedSpace, actorId, nonce));
  }
  operations.push(visitorSelect);
  chatSnapshotIndex = operations.length;
  operations.push(db.prepare(`SELECT id, space, sender, text, expires_at FROM cafe_chat_messages
    WHERE expires_at > ? AND space = (SELECT ${spaceExpr} FROM cafe_visitors WHERE id=?)
    ORDER BY created_at DESC LIMIT 20`).bind(now, id));
  const deliveryReadStart = operations.length;
  await ensureV2OrderDetection(db);
  const deliveryReads = prepareCafeDeliveryReads(db, now);
  operations.push(...deliveryReads.statements);
  try {
    const result = await db.batch(operations);
    const visitors = result[chatSnapshotIndex - 1].results;
    const mine = visitors.find((visitor) => visitor.id === id);
    const chat = chatPayload(result[chatSnapshotIndex].results.reverse());
    const deliveryData = deliveryReads.read(result.slice(deliveryReadStart, deliveryReadStart + 2));
    const presenceData = { now, id, mine: mine?.seat ?? null, zone: mine?.zone ?? "hall", visitors, chat, ...deliveryData };
    if (action === "say" && message && !result[chatRateIndex].meta.changes) {
      if (cafeChatSpace(mine?.seat, mine?.zone) !== expectedSpace) {
        return json({ ...presenceData, error: "chat_room_changed" }, 409);
      }
      const record = result[chatRateReadIndex].results[0];
      const minimumWait = (record?.last_sent_at ?? now) + chatMinInterval - now;
      const windowWait = (record?.window_started_at ?? now) + chatBurstWindow - now;
      const repeatedWait = record?.last_text_hash === chatTextHash
        ? (record.last_sent_at + chatRepeatInterval - now) : 0;
      const wait = Math.max(1, minimumWait,
        record?.window_count >= chatBurstLimit && windowWait > 0 ? windowWait : 0,
        repeatedWait);
      return json({ ...presenceData, error: "chat_cooldown", retryAfterMs: wait }, 429);
    }
    if (action === "say" && message && !result[chatWriteIndex].meta.changes) {
      return json({ ...presenceData, error: "chat_room_changed" }, 409);
    }
    return json(presenceData, action === "reserve" && mine?.seat !== input.seat ? 409 : 200);
  } catch (error) {
    console.error("Cafe presence unavailable", error instanceof Error ? error.message : "D1 error");
    return json({ error: "unavailable" }, 503);
  }
}
