const preparationMs = 1800;
const travelLegMs = 9000;
const trayLifetimeMs = 6 * 3600000;
const activeSeatSql = "SELECT 1 FROM cafe_visitors WHERE id = o.visitor_id AND seat = o.seat AND expires > ?";

function readSharedRows(results) {
  const delivery = results[0].results[0];
  const trays = results[1].results.map((row) => ({
    key: String(row.queue_key),
    seat: row.seat,
    items: JSON.parse(row.items),
    readyAt: row.ready_at,
  }));
  return {
    delivery: delivery ? {
      key: String(delivery.queue_key),
      seat: delivery.seat,
      startAt: delivery.start_at,
      readyAt: delivery.ready_at,
      returnAt: delivery.return_at,
    } : null,
    trays,
  };
}

/**
 * Appends the shared clerk animation and occupied-seat tray reads to a D1 batch.
 * A queued owner must still occupy the order's seat. A clerk already in transit
 * finishes the return trip before the next order starts.
 */
export function prepareCafeDeliveryReads(db, now = Date.now()) {
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
      db.prepare("SELECT o.rowid AS queue_key, o.seat, o.items, o.ready_at FROM cafe_orders AS o " +
        "WHERE o.left_at IS NULL AND o.start_at > 0 AND o.ready_at <= ? " +
        "AND o.ready_at > ? AND EXISTS (" + activeSeatSql + ") " +
        "ORDER BY o.ready_at DESC, o.rowid DESC LIMIT 120")
        .bind(now, now - trayLifetimeMs, now),
    ],
    read: readSharedRows,
  };
}

export async function readCafeDelivery(db, now = Date.now()) {
  const query = prepareCafeDeliveryReads(db, now);
  return query.read(await db.batch(query.statements));
}

/**
 * Run after a presence reservation update in the same D1 batch.
 * Returning to the original seat later never resurrects food from an old visit.
 */
export function cafeDeliverySeatMutation(db, visitorId, now = Date.now()) {
  return db.prepare("UPDATE cafe_orders SET left_at = ? WHERE visitor_id = ? AND left_at IS NULL " +
    "AND NOT EXISTS (SELECT 1 FROM cafe_visitors " +
    "WHERE id = ? AND seat = cafe_orders.seat AND expires > ?)")
    .bind(now, visitorId, visitorId, now);
}

export const cafeDeliveryTimings = Object.freeze({ preparationMs, travelLegMs });
