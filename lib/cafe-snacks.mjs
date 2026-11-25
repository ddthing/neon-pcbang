import { cafeDeliveryTimings, ensureV2OrderDetection } from "./cafe-delivery.mjs";
import { normalizeCafeChatText } from "./cafe-chat.mjs";

const stampMinutes = 30;
const couponStamps = 10;
const sessionGap = 16000;
const recentOrderMs = 6 * 3600000;
const giftCostPoints = 30;
const eatBonusPoints = 15;
const { preparationMs, travelLegMs } = cafeDeliveryTimings;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const v2SnackCache = new WeakMap();
async function checkV2SnackSchema(db) {
  if (v2SnackCache.has(db)) return v2SnackCache.get(db);
  let supported = false;
  try {
    await db.prepare("SELECT points FROM cafe_loyalty LIMIT 0").bind().all();
    const ordersV2 = await ensureV2OrderDetection(db);
    supported = ordersV2;
  } catch {
    supported = false;
  }
  v2SnackCache.set(db, supported);
  return supported;
}

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function fingerprint(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeOptions(item, selected) {
  if (!Array.isArray(selected) || !Array.isArray(item.toppings)) return [];
  const allowed = new Set(item.toppings);
  return [...new Set(selected.filter((opt) => typeof opt === "string" && allowed.has(opt)))].slice(0, 3);
}

export async function snacks(request, db, menu, now = Date.now()) {
  if (!db) return reply({ error: "unavailable" }, 503);
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") return reply({ error: "origin" }, 403);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "size" }, 413);
    body = JSON.parse(raw);
  } catch { return reply({ error: "request" }, 400); }
  const { visitor, member, action } = body ?? {};
  if (![visitor, member].every((value) => typeof value === "string" && uuid.test(value)) ||
      !["sync", "stamp", "order", "eat", "gift", "earn"].includes(action)) return reply({ error: "request" }, 400);

  const v2 = await checkV2SnackSchema(db);
  if (!v2 && ["eat", "gift", "earn"].includes(action)) return reply({ error: "unavailable" }, 400);

  const [visitorId, memberId] = await Promise.all([fingerprint(visitor), fingerprint(member)]);
  const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const available = "stamps - (? * (SELECT COUNT(*) FROM cafe_orders WHERE member_id = ? AND coupon = 1 " +
    "AND (left_at IS NULL OR left_at >= ready_at)))";
  const ops = [];
  const seat = "SELECT id, seat FROM cafe_visitors WHERE id = ? AND expires > ? AND seat IS NOT NULL";

  // Ensure loyalty wallet exists when v2 is active
  if (v2) {
    ops.push(db.prepare(`INSERT OR IGNORE INTO cafe_loyalty(member_id, day, active_at, points)
      VALUES (?, ?, ?, 150)`).bind(memberId, day, 0));
  }

  if (body.active === true && action === "sync") {
    const gap = `CASE WHEN excluded.active_at - cafe_loyalty.active_at BETWEEN 0 AND ${sessionGap}
      THEN excluded.active_at - cafe_loyalty.active_at ELSE 0 END`;
    if (v2) {
      // Award +2 G-Points per heartbeat (~10-15 pts/min seated)
      ops.push(db.prepare(`INSERT INTO cafe_loyalty(member_id, day, active_at, points)
        SELECT ?, ?, ?, 150 WHERE EXISTS (${seat})
        ON CONFLICT(member_id) DO UPDATE SET
        total_ms = cafe_loyalty.total_ms + (${gap}),
        day_ms = CASE WHEN cafe_loyalty.day = excluded.day THEN cafe_loyalty.day_ms + (${gap}) ELSE 0 END,
        points = cafe_loyalty.points + CASE WHEN (${gap}) > 0 THEN 2 ELSE 0 END,
        day = excluded.day, active_at = excluded.active_at
        WHERE excluded.active_at >= cafe_loyalty.active_at`)
        .bind(memberId, day, now, visitorId, now));
    } else {
      ops.push(db.prepare(`INSERT INTO cafe_loyalty(member_id, day, active_at)
        SELECT ?, ?, ? WHERE EXISTS (${seat})
        ON CONFLICT(member_id) DO UPDATE SET
        total_ms = cafe_loyalty.total_ms + (${gap}),
        day_ms = CASE WHEN cafe_loyalty.day = excluded.day THEN cafe_loyalty.day_ms + (${gap}) ELSE 0 END,
        day = excluded.day, active_at = excluded.active_at
        WHERE excluded.active_at >= cafe_loyalty.active_at`)
        .bind(memberId, day, now, visitorId, now));
    }
  }
  if (action === "stamp") {
    ops.push(db.prepare(v2
      ? `UPDATE cafe_loyalty SET stamps = stamps + 1, points = points + 50, claim_day = ?
         WHERE member_id = ? AND day = ? AND day_ms >= ? AND claim_day <> ?`
      : `UPDATE cafe_loyalty SET stamps = stamps + 1, claim_day = ?
         WHERE member_id = ? AND day = ? AND day_ms >= ? AND claim_day <> ?`)
      .bind(day, memberId, day, stampMinutes * 60000, day));
  }
  if (action === "eat" && v2) {
    const orderId = typeof body.orderId === "string" && uuid.test(body.orderId) ? body.orderId : "";
    if (!orderId) return reply({ error: "request" }, 400);
    ops.push(db.prepare(`UPDATE cafe_orders SET eaten_at = ?
      WHERE id = ? AND visitor_id = ? AND eaten_at IS NULL AND ready_at <= ? AND left_at IS NULL`)
      .bind(now, orderId, visitorId, now));
    ops.push(db.prepare(`UPDATE cafe_loyalty SET points = points + ?
      WHERE member_id = ? AND EXISTS (SELECT 1 FROM cafe_orders WHERE id = ? AND eaten_at = ?)`)
      .bind(eatBonusPoints, memberId, orderId, now));
  }
  if (action === "earn" && v2) {
    const bonus = Number.isInteger(body.amount) ? Math.max(5, Math.min(80, body.amount)) : 20;
    ops.push(db.prepare(`UPDATE cafe_loyalty SET points = MIN(99999, points + ?), active_at = ?
      WHERE member_id = ? AND ? - active_at >= 4000`)
      .bind(bonus, now, memberId, now));
  }

  let orderIndex = -1;
  let orderLookupIndex = -1;
  let giftInsertIndex = -1;
  const catalog = new Map(menu.categories.flatMap((group) => group.items)
    .filter((item) => item.available !== false).map((item) => [item.id, item]));

  if (action === "order") {
    if (typeof body.id !== "string" || !uuid.test(body.id) ||
        !Array.isArray(body.items) || body.items.length > 15) return reply({ error: "order" }, 400);
    const seen = new Set();
    const items = [];
    const optionsMap = {};
    for (const line of body.items) {
      const item = catalog.get(line?.id);
      if (!item || seen.has(item.id) || !Number.isInteger(line.count) || line.count < 1 || line.count > 9) {
        return reply({ error: "item" }, 400);
      }
      seen.add(item.id);
      const opts = sanitizeOptions(item, line.options);
      if (opts.length) optionsMap[item.id] = opts;
      items.push({ id: item.id, name: item.name, count: line.count, ...(opts.length ? { options: opts } : {}) });
    }
    const coupon = body.coupon === true ? 1 : 0;
    if (coupon) items.push({ id: menu.reward.id, name: menu.reward.name, count: 1 });
    const quantity = items.reduce((sum, item) => sum + item.count, 0);
    if (!quantity || quantity > 30) return reply({ error: "quantity" }, 400);
    const queue = "SELECT COALESCE(MAX(CASE WHEN return_at > 0 THEN return_at " +
      "ELSE ready_at + ? + ? END), 0) AS free_at FROM cafe_orders " +
      "WHERE (return_at > ? AND (left_at IS NULL OR left_at >= start_at)) " +
      "OR (return_at = 0 AND ready_at > ?)";

    if (v2) {
      ops.push(db.prepare("INSERT OR IGNORE INTO cafe_orders " +
        "(id, member_id, seat, items, quantity, coupon, created_at, ready_at, visitor_id, start_at, return_at, options_json) " +
        "SELECT ?, ?, visitor.seat, ?, ?, ?, ?, MAX(?, queue.free_at) + ? + ?, visitor.id, " +
        "MAX(?, queue.free_at) + ?, MAX(?, queue.free_at) + ? + ? + ?, ? " +
        "FROM (" + seat + ") AS visitor CROSS JOIN (" + queue + ") AS queue " +
        "WHERE NOT EXISTS (SELECT 1 FROM cafe_orders WHERE member_id = ? AND ready_at > ? " +
        "AND (left_at IS NULL OR left_at >= ready_at)) " +
        "AND NOT EXISTS (SELECT 1 FROM cafe_orders WHERE visitor_id = visitor.id " +
        "AND left_at IS NULL AND return_at > ?) " +
        "AND (? = 0 OR EXISTS (SELECT 1 FROM cafe_loyalty WHERE member_id = ? AND " + available + " >= ?))")
        .bind(body.id, memberId, JSON.stringify(items), quantity, coupon, now,
          now, preparationMs, travelLegMs, now, preparationMs, now, preparationMs, travelLegMs, travelLegMs,
          JSON.stringify(optionsMap),
          visitorId, now, travelLegMs, travelLegMs, now, now,
          memberId, now, now, coupon, memberId, couponStamps, memberId, couponStamps));
    } else {
      ops.push(db.prepare("INSERT OR IGNORE INTO cafe_orders " +
        "(id, member_id, seat, items, quantity, coupon, created_at, ready_at, visitor_id, start_at, return_at) " +
        "SELECT ?, ?, visitor.seat, ?, ?, ?, ?, MAX(?, queue.free_at) + ? + ?, visitor.id, " +
        "MAX(?, queue.free_at) + ?, MAX(?, queue.free_at) + ? + ? + ? " +
        "FROM (" + seat + ") AS visitor CROSS JOIN (" + queue + ") AS queue " +
        "WHERE NOT EXISTS (SELECT 1 FROM cafe_orders WHERE member_id = ? AND ready_at > ? " +
        "AND (left_at IS NULL OR left_at >= ready_at)) " +
        "AND NOT EXISTS (SELECT 1 FROM cafe_orders WHERE visitor_id = visitor.id " +
        "AND left_at IS NULL AND return_at > ?) " +
        "AND (? = 0 OR EXISTS (SELECT 1 FROM cafe_loyalty WHERE member_id = ? AND " + available + " >= ?))")
        .bind(body.id, memberId, JSON.stringify(items), quantity, coupon, now,
          now, preparationMs, travelLegMs, now, preparationMs, now, preparationMs, travelLegMs, travelLegMs,
          visitorId, now, travelLegMs, travelLegMs, now, now,
          memberId, now, now, coupon, memberId, couponStamps, memberId, couponStamps));
    }
    orderIndex = ops.length;
    const cols = v2
      ? "id, seat, items, created_at, start_at, ready_at, return_at, left_at, gift_from, gift_note, eaten_at"
      : "id, seat, items, created_at, start_at, ready_at, return_at, left_at";
    ops.push(db.prepare(`SELECT ${cols} FROM cafe_orders WHERE member_id = ? AND (id = ? OR ` +
      "(ready_at > ? AND (left_at IS NULL OR left_at >= ready_at))) " +
      "ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, created_at DESC LIMIT 1")
      .bind(memberId, body.id, now, body.id));
  } else if (action === "gift" && v2) {
    // Gift a snack to another seated visitor using 30 G-Points!
    const targetSeat = typeof body.targetSeat === "string" ? body.targetSeat : "";
    const giftItem = catalog.get(body.itemId);
    const giftId = typeof body.id === "string" && uuid.test(body.id) ? body.id : "";
    if (!targetSeat || !giftItem || !giftId) return reply({ error: "gift_invalid" }, 400);
    let giftNote = "";
    if (typeof body.note === "string" && body.note.trim()) {
      const checked = normalizeCafeChatText(body.note.slice(0, 36));
      if (checked.error) return reply({ error: "gift_note_blocked" }, 400);
      giftNote = checked.text;
    }
    const senderName = typeof body.senderName === "string" && body.senderName.trim()
      ? body.senderName.trim().slice(0, 12) : "익명 단골";
    const items = [{ id: giftItem.id, name: giftItem.name, count: 1 }];
    const queue = "SELECT COALESCE(MAX(CASE WHEN return_at > 0 THEN return_at " +
      "ELSE ready_at + ? + ? END), 0) AS free_at FROM cafe_orders " +
      "WHERE (return_at > ? AND (left_at IS NULL OR left_at >= start_at)) " +
      "OR (return_at = 0 AND ready_at > ?)";
    const targetSql = "SELECT id, seat FROM cafe_visitors WHERE seat = ? AND expires > ? AND id <> ?";
    giftInsertIndex = ops.length;
    ops.push(db.prepare("INSERT OR IGNORE INTO cafe_orders " +
      "(id, member_id, seat, items, quantity, coupon, created_at, ready_at, visitor_id, start_at, return_at, gift_from, gift_note) " +
      "SELECT ?, ?, target.seat, ?, 1, 0, ?, MAX(?, queue.free_at) + ? + ?, target.id, " +
      "MAX(?, queue.free_at) + ?, MAX(?, queue.free_at) + ? + ? + ?, ?, ? " +
      "FROM (" + targetSql + ") AS target CROSS JOIN (" + queue + ") AS queue " +
      "WHERE EXISTS (SELECT 1 FROM cafe_loyalty WHERE member_id = ? AND points >= ?)")
      .bind(giftId, "gift:" + memberId.slice(0, 16), JSON.stringify(items), now,
        now, preparationMs, travelLegMs, now, preparationMs, now, preparationMs, travelLegMs, travelLegMs,
        senderName, giftNote,
        targetSeat, now, visitorId, travelLegMs, travelLegMs, now, now,
        memberId, giftCostPoints));
    ops.push(db.prepare("UPDATE cafe_loyalty SET points = points - ? WHERE member_id = ? " +
      "AND EXISTS (SELECT 1 FROM cafe_orders WHERE id = ?)")
      .bind(giftCostPoints, memberId, giftId));
  } else {
    orderLookupIndex = ops.length;
    const cols = v2
      ? "id, seat, items, created_at, start_at, ready_at, return_at, left_at, gift_from, gift_note, eaten_at"
      : "id, seat, items, created_at, start_at, ready_at, return_at, left_at";
    ops.push(db.prepare(`SELECT ${cols} FROM cafe_orders WHERE (member_id = ? OR visitor_id = ?) AND created_at > ? ` +
      "ORDER BY created_at DESC, rowid DESC LIMIT 1")
      .bind(memberId, visitorId, now - recentOrderMs));
  }

  const loyaltyIndex = ops.length;
  ops.push(db.prepare(v2
    ? `SELECT day, day_ms, total_ms, claim_day, points, ${available} AS balance FROM cafe_loyalty WHERE member_id = ?`
    : `SELECT day, day_ms, total_ms, claim_day, ${available} AS balance FROM cafe_loyalty WHERE member_id = ?`)
    .bind(couponStamps, memberId, memberId));

  const boardCols = v2
    ? "id, seat, items, quantity, created_at, start_at, ready_at, left_at, gift_from"
    : "id, items, quantity, created_at, start_at, ready_at, left_at";
  ops.push(db.prepare(`SELECT ${boardCols} FROM cafe_orders
    WHERE created_at > ? ORDER BY created_at DESC LIMIT 12`).bind(now - 20 * 60000));

  try {
    const results = await db.batch(ops);
    const loyalty = results[loyaltyIndex].results[0];
    if (action === "gift") {
      const inserted = giftInsertIndex >= 0 && (results[giftInsertIndex]?.meta?.changes ?? 0) > 0;
      if (!inserted) {
        const pts = loyalty?.points ?? 150;
        return reply({ error: pts < giftCostPoints ? "insufficient_points" : "target_not_seated" }, 400);
      }
    }
    const row = orderIndex >= 0 ? results[orderIndex].results[0]
      : orderLookupIndex >= 0 ? results[orderLookupIndex].results[0] : null;
    const order = row ? {
      id: row.id,
      seat: row.seat,
      items: JSON.parse(row.items),
      createdAt: row.created_at,
      startAt: row.start_at > 0 ? row.start_at : row.created_at,
      readyAt: row.ready_at,
      returnAt: row.return_at > 0 ? row.return_at : row.ready_at,
      eatenAt: row.eaten_at ?? null,
      giftFrom: row.gift_from || "",
      giftNote: row.gift_note || "",
      status: deliveryStatus(row, now),
    } : null;
    return reply({
      now, order,
      rejected: action === "order" && (!order || order.id !== body.id),
      gifted: action === "gift" ? results[1]?.meta?.changes > 0 || (results[1]?.results !== undefined) : undefined,
      loyalty: {
        today: loyalty?.day === day ? loyalty.day_ms : 0,
        total: loyalty?.total_ms ?? 0,
        claimed: loyalty?.claim_day === day,
        balance: loyalty?.balance ?? 0,
        points: loyalty?.points ?? 150,
        threshold: stampMinutes * 60000,
        couponStamps,
      },
      orders: results.at(-1).results.map((entry) => ({
        number: entry.id.slice(0, 8),
        seat: entry.seat || "",
        items: JSON.parse(entry.items),
        quantity: entry.quantity,
        giftFrom: entry.gift_from || "",
        createdAt: entry.created_at,
        startAt: entry.start_at > 0 ? entry.start_at : entry.created_at,
        readyAt: entry.ready_at,
        status: deliveryStatus(entry, now),
      })),
    });
  } catch (error) {
    console.error("Snack service unavailable", error instanceof Error ? error.message : "D1 error");
    return reply({ error: "unavailable" }, 503);
  }
}

function deliveryStatus(order, now) {
  if (order.left_at !== null && order.left_at !== undefined && order.left_at < order.ready_at) return "canceled";
  if (order.eaten_at) return "eaten";
  const startAt = order.start_at > 0 ? order.start_at : order.created_at;
  if (now < startAt) return startAt - now <= preparationMs ? "preparing" : "queued";
  return now < order.ready_at ? "delivering" : "delivered";
}
