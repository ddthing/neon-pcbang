const stampMinutes = 30;
const couponStamps = 10;
const sessionGap = 16000;
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function fingerprint(token) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
      !["sync", "stamp", "order"].includes(action)) return reply({ error: "request" }, 400);
  const [visitorId, memberId] = await Promise.all([fingerprint(visitor), fingerprint(member)]);
  const day = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const available = "stamps - (? * (SELECT COUNT(*) FROM cafe_orders WHERE member_id = ? AND coupon = 1))";
  const ops = [];
  const seat = "SELECT seat FROM cafe_visitors WHERE id = ? AND expires > ? AND seat IS NOT NULL";

  if (body.active === true && action === "sync") {
    // The server counts only time bracketed by two recent, seated heartbeats.
    const gap = `CASE WHEN excluded.active_at - cafe_loyalty.active_at BETWEEN 0 AND ${sessionGap}
      THEN excluded.active_at - cafe_loyalty.active_at ELSE 0 END`;
    ops.push(db.prepare(`INSERT INTO cafe_loyalty(member_id, day, active_at)
      SELECT ?, ?, ? WHERE EXISTS (${seat})
      ON CONFLICT(member_id) DO UPDATE SET
      total_ms = cafe_loyalty.total_ms + (${gap}),
      day_ms = CASE WHEN cafe_loyalty.day = excluded.day THEN cafe_loyalty.day_ms + (${gap}) ELSE 0 END,
      day = excluded.day, active_at = excluded.active_at
      WHERE excluded.active_at >= cafe_loyalty.active_at`)
      .bind(memberId, day, now, visitorId, now));
  }
  if (action === "stamp") {
    ops.push(db.prepare(`UPDATE cafe_loyalty SET stamps = stamps + 1, claim_day = ?
      WHERE member_id = ? AND day = ? AND day_ms >= ? AND claim_day <> ?`)
      .bind(day, memberId, day, stampMinutes * 60000, day));
  }

  let orderIndex = -1;
  if (action === "order") {
    if (typeof body.id !== "string" || !uuid.test(body.id) ||
        !Array.isArray(body.items) || body.items.length > 15) return reply({ error: "order" }, 400);
    const catalog = new Map(menu.categories.flatMap((group) => group.items)
      .filter((item) => item.available !== false).map((item) => [item.id, item]));
    const seen = new Set();
    const items = [];
    for (const line of body.items) {
      const item = catalog.get(line?.id);
      if (!item || seen.has(item.id) || !Number.isInteger(line.count) || line.count < 1 || line.count > 9) {
        return reply({ error: "item" }, 400);
      }
      seen.add(item.id);
      items.push({ name: item.name, count: line.count });
    }
    const coupon = body.coupon === true ? 1 : 0;
    if (coupon) items.push({ name: menu.reward.name, count: 1 });
    const quantity = items.reduce((sum, item) => sum + item.count, 0);
    if (!quantity || quantity > 30) return reply({ error: "quantity" }, 400);
    ops.push(db.prepare(`INSERT OR IGNORE INTO cafe_orders(id, member_id, seat, items, quantity, coupon, created_at, ready_at)
      SELECT ?, ?, visitor.seat, ?, ?, ?, ?, ? FROM (${seat}) AS visitor
      WHERE NOT EXISTS (SELECT 1 FROM cafe_orders WHERE member_id = ? AND ready_at > ?)
      AND (? = 0 OR EXISTS (SELECT 1 FROM cafe_loyalty WHERE member_id = ? AND ${available} >= ?))`)
      .bind(body.id, memberId, JSON.stringify(items), quantity, coupon, now, now + 5200, visitorId, now,
        memberId, now, coupon, memberId, couponStamps, memberId, couponStamps));
    orderIndex = ops.length;
    ops.push(db.prepare(`SELECT id, seat, items, created_at, ready_at FROM cafe_orders WHERE id = ? AND member_id = ?`)
      .bind(body.id, memberId));
  }

  const loyaltyIndex = ops.length;
  ops.push(db.prepare(`SELECT day, day_ms, total_ms, claim_day, ${available} AS balance
    FROM cafe_loyalty WHERE member_id = ?`).bind(couponStamps, memberId, memberId));
  ops.push(db.prepare(`SELECT id, items, quantity, created_at, ready_at FROM cafe_orders
    WHERE created_at > ? ORDER BY created_at DESC LIMIT 10`).bind(now - 20 * 60000));
  try {
    const results = await db.batch(ops);
    const loyalty = results[loyaltyIndex].results[0];
    const row = orderIndex < 0 ? null : results[orderIndex].results[0];
    const order = row ? { id: row.id, seat: row.seat, items: JSON.parse(row.items), readyAt: row.ready_at } : null;
    return reply({
      now, order, rejected: action === "order" && !order,
      loyalty: {
        today: loyalty?.day === day ? loyalty.day_ms : 0, total: loyalty?.total_ms ?? 0,
        claimed: loyalty?.claim_day === day, balance: loyalty?.balance ?? 0,
        threshold: stampMinutes * 60000, couponStamps,
      },
      orders: results.at(-1).results.map((entry) => ({
        number: entry.id.slice(0, 8), items: JSON.parse(entry.items), quantity: entry.quantity,
        createdAt: entry.created_at, readyAt: entry.ready_at,
      })),
    });
  } catch (error) {
    console.error("Snack service unavailable", error instanceof Error ? error.message : "D1 error");
    return reply({ error: "unavailable" }, 503);
  }
}
