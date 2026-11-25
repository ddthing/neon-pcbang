const preparationMs = 1800;
const travelLegMs = 9000;
const trayLifetimeMs = 6 * 3600000;
const activeSeatSql = "SELECT 1 FROM cafe_visitors WHERE id = o.visitor_id AND seat = o.seat AND expires > ?";

const v2DeliveryCache = new WeakMap();
function hasV2OrderColumns(db) {
  return v2DeliveryCache.get(db) === true;
}
export async function ensureV2OrderDetection(db) {
  if (v2DeliveryCache.has(db)) return v2DeliveryCache.get(db);
  let supported = false;
  try {
    await db.prepare("SELECT options_json, gift_from, gift_note, eaten_at FROM cafe_orders LIMIT 0").bind().all();
    supported = true;
  } catch {
    supported = false;
  }
  v2DeliveryCache.set(db, supported);
  return supported;
}

function readSharedRows(results) {
  const delivery = results[0].results[0];
  const cooking = results[2]?.results?.[0] ?? null;
  const trays = results[1].results.map((row) => ({
    key: String(row.queue_key),
    id: row.id,
    seat: row.seat,
    items: JSON.parse(row.items),
    readyAt: row.ready_at,
    giftFrom: row.gift_from || "",
    giftNote: row.gift_note || "",
  }));
  return {
    delivery: delivery ? {
      key: String(delivery.queue_key),
      seat: delivery.seat,
      startAt: delivery.start_at,
      readyAt: delivery.ready_at,
      returnAt: delivery.return_at,
    } : null,
    cooking: Boolean(cooking),
    trays,
  };
}

export function prepareCafeDeliveryReads(db, now = Date.now()) {
  const v2 = hasV2OrderColumns(db);
  const eatenFilter = v2 ? "AND o.eaten_at IS NULL " : "";
  const extraCols = v2 ? ", o.id, o.gift_from, o.gift_note" : ", o.id";
  return {
    statements: [
      db.prepare("SELECT o.rowid AS queue_key, o.seat, o.start_at, o.ready_at, o.return_at " +
        "FROM cafe_orders AS o WHERE o.left_at IS NULL AND o.start_at <= ? AND o.return_at > ? " +
        "AND EXISTS (" + activeSeatSql + ") " +
        "UNION ALL " +
        "SELECT o.rowid AS queue_key, o.seat, o.start_at, o.ready_at, o.return_at " +
        "FROM cafe_orders AS o WHERE o.left_at >= o.start_at AND o.start_at <= ? AND o.return_at > ? " +
        "ORDER BY start_at, queue_key LIMIT 1")
        .bind(now + preparationMs, now, now, now, now),
      db.prepare("SELECT o.rowid AS queue_key, o.seat, o.items, o.ready_at" + extraCols + " FROM cafe_orders AS o " +
        "WHERE o.left_at IS NULL AND o.start_at > 0 AND o.ready_at <= ? " +
        "AND o.ready_at > ? " + eatenFilter + "AND EXISTS (" + activeSeatSql + ") " +
        "ORDER BY o.ready_at DESC, o.rowid DESC LIMIT 120")
        .bind(now, now - trayLifetimeMs, now),
    ],
    read: readSharedRows,
  };
}

export async function readCafeDelivery(db, now = Date.now()) {
  await ensureV2OrderDetection(db);
  const query = prepareCafeDeliveryReads(db, now);
  return query.read(await db.batch(query.statements));
}

export function cafeDeliverySeatMutation(db, visitorId, now = Date.now()) {
  return db.prepare("UPDATE cafe_orders SET left_at = ? WHERE visitor_id = ? AND left_at IS NULL " +
    "AND NOT EXISTS (SELECT 1 FROM cafe_visitors " +
    "WHERE id = ? AND seat = cafe_orders.seat AND expires > ?)")
    .bind(now, visitorId, visitorId, now);
}

export const cafeDeliveryTimings = Object.freeze({ preparationMs, travelLegMs });
