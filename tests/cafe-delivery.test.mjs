import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { cafeDeliverySeatMutation, cafeDeliveryTimings, readCafeDelivery } from "../lib/cafe-delivery.mjs";
import { snacks } from "../lib/cafe-snacks.mjs";

const menu = JSON.parse(readFileSync(new URL("../public/snack-menu.json", import.meta.url), "utf8"));
const baseTime = 1800000000000;
const fingerprint = (token) => createHash("sha256").update(token).digest("hex");

function makeDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../drizzle/0000_strange_moira_mactaggert.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0001_corner_snacks.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../drizzle/0005_cafe_delivery.sql", import.meta.url), "utf8"));
  let queue = Promise.resolve();
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          const bound = sqlite.prepare(sql);
          return {
            sql,
            values,
            async first() { return bound.get(...values) ?? null; },
            async all() { return { results: bound.all(...values) }; },
            async run() {
              const info = bound.run(...values);
              return { success: true, meta: { changes: Number(info.changes) } };
            },
          };
        },
      };
    },
    async batch(statements) {
      const operation = queue.then(async () => {
        sqlite.exec("BEGIN");
        try {
          const rows = [];
          for (const statement of statements) {
            await statement.run();
            rows.push((await statement.all()).results);
          }
          sqlite.exec("COMMIT");
          return rows.map((results) => ({ results, success: true }));
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  return { db, sqlite };
}

function putVisitor(sqlite, token, seat) {
  const id = fingerprint(token);
  sqlite.prepare("INSERT INTO cafe_visitors " +
    "(id,name,color,x,y,facing,seat,wave,expires) VALUES(?,?,?,?,?,?,?,?,?)")
    .run(id, "배달 손님", 0, 33.5, 81.5, 1, seat, 0, baseTime + 60000);
  return id;
}

function orderRequest(visitor, member, id, action = "order", coupon = false) {
  return new Request("https://pcbang.example.test/api/snacks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action, visitor, member, id, coupon,
      ...(action === "order" ? { items: [{ id: "ramyeon", count: 1 }] } : {}),
    }),
  });
}

async function placeOrder(db, visitor, member, now = baseTime, coupon = false) {
  const response = await snacks(orderRequest(visitor, member, randomUUID(), "order", coupon), db, menu, now);
  assert.equal(response.status, 200);
  return response.json();
}

async function leaveSeat(db, sqlite, visitorId, now) {
  await db.batch([
    db.prepare("UPDATE cafe_visitors SET seat=NULL WHERE id=?").bind(visitorId),
    cafeDeliverySeatMutation(db, visitorId, now),
  ]);
}

test("a submitted order receives a single attendant timeline and an occupied seat tray", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    const seat = "hall:4";
    const visitorId = putVisitor(sqlite, visitor, seat);
    const result = await placeOrder(db, visitor, randomUUID());
    assert.equal(result.order.status, "preparing");
    assert.equal(result.order.seat, seat);
    assert.equal(result.order.startAt, baseTime + cafeDeliveryTimings.preparationMs);
    assert.equal(result.order.readyAt, result.order.startAt + cafeDeliveryTimings.travelLegMs);
    assert.equal(result.order.returnAt, result.order.readyAt + cafeDeliveryTimings.travelLegMs);
    assert.equal(result.order.items[0].id, "ramyeon");
    assert.equal(result.orders[0].status, "preparing");
    const outgoing = await readCafeDelivery(db, result.order.startAt);
    assert.equal(outgoing.delivery.seat, seat);
    assert.equal(outgoing.trays.length, 0);
    const arrived = await readCafeDelivery(db, result.order.readyAt);
    assert.equal(arrived.delivery.key, String(sqlite.prepare("SELECT rowid FROM cafe_orders").get().rowid));
    assert.equal(arrived.trays.length, 1);
    assert.equal(arrived.trays[0].seat, seat);
    assert.equal(arrived.trays[0].items[0].id, "ramyeon");
    assert.equal(visitorId.length, 64);
  } finally { sqlite.close(); }
});

test("simultaneous guests receive FIFO outbound slots", async () => {
  const { db, sqlite } = makeDb();
  try {
    const first = randomUUID();
    const second = randomUUID();
    putVisitor(sqlite, first, "hall:1");
    putVisitor(sqlite, second, "hall:2");
    const orders = await Promise.all([
      placeOrder(db, first, randomUUID()), placeOrder(db, second, randomUUID()),
    ]);
    const [prior, next] = orders.sort((a, b) => a.order.startAt - b.order.startAt);
    assert.equal(prior.order.startAt, baseTime + cafeDeliveryTimings.preparationMs);
    assert.equal(next.order.startAt, prior.order.returnAt + cafeDeliveryTimings.preparationMs);
    assert.ok(next.order.createdAt < next.order.startAt);
    assert.equal((await db.prepare("SELECT COUNT(*) AS total FROM cafe_orders").bind().first()).total, 2);
  } finally { sqlite.close(); }
});

test("a same member cannot order twice before delivery and paid coupons remain debited", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    const member = randomUUID();
    putVisitor(sqlite, visitor, "hall:3");
    sqlite.prepare("INSERT INTO cafe_loyalty(member_id,day,stamps,active_at) VALUES(?,?,?,?)")
      .run(fingerprint(member), "2027-01-15", 11, baseTime);
    const order = (await placeOrder(db, visitor, member, baseTime, true)).order;
    const rejected = await snacks(
      orderRequest(visitor, member, randomUUID(), "order", true), db, menu, baseTime + 1,
    );
    const blocked = await rejected.json();
    assert.equal(blocked.rejected, true);
    assert.equal(blocked.order.id, order.id);
    const switchedMember = await snacks(
      orderRequest(visitor, randomUUID(), randomUUID()), db, menu, order.readyAt + 1,
    );
    assert.equal((await switchedMember.json()).rejected, true);
    const delivered = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, order.readyAt + 1,
    );
    assert.equal((await delivered.json()).order.status, "delivered");
    await leaveSeat(db, sqlite, fingerprint(visitor), order.readyAt + 2);
    assert.equal((await db.prepare("SELECT stamps FROM cafe_loyalty WHERE member_id=?")
      .bind(fingerprint(member)).first()).stamps, 11);
    assert.equal((await readCafeDelivery(db, order.readyAt + 2)).trays.length, 0);
  } finally { sqlite.close(); }
});

test("leaving cancels a queued tray, while an active attendant completes the return", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    const member = randomUUID();
    const visitorId = putVisitor(sqlite, visitor, "hall:9");
    const order = (await placeOrder(db, visitor, member)).order;
    const leftAt = baseTime + 300;
    await leaveSeat(db, sqlite, visitorId, leftAt);
    const canceled = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, leftAt + 1,
    );
    assert.equal((await canceled.json()).order.status, "canceled");
    assert.equal((await readCafeDelivery(db, order.startAt)).delivery, null);
    assert.equal((await readCafeDelivery(db, order.readyAt)).trays.length, 0);

    const activeVisitor = randomUUID();
    const activeId = putVisitor(sqlite, activeVisitor, "hall:12");
    const active = (await placeOrder(db, activeVisitor, randomUUID(), baseTime + 1000)).order;
    const departAt = active.startAt + 1;
    assert.equal((await readCafeDelivery(db, departAt)).delivery.seat, "hall:12");
    await leaveSeat(db, sqlite, activeId, departAt + 1);
    assert.equal((await readCafeDelivery(db, departAt + 2)).delivery.seat, "hall:12");
    assert.equal((await readCafeDelivery(db, departAt + 2)).trays.length, 0);
    assert.equal((await readCafeDelivery(db, active.returnAt)).delivery, null);
  } finally { sqlite.close(); }
});

test("a delivered tray restores on sync until the visitor changes seats", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    const member = randomUUID();
    const visitorId = putVisitor(sqlite, visitor, "hall:15");
    const order = (await placeOrder(db, visitor, member)).order;
    const delivered = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, order.readyAt,
    );
    assert.equal((await delivered.json()).order.status, "delivered");
    assert.equal((await readCafeDelivery(db, order.readyAt)).trays.length, 1);
    sqlite.prepare("UPDATE cafe_visitors SET seat=? WHERE id=?").run("hall:16", visitorId);
    await db.batch([cafeDeliverySeatMutation(db, visitorId, order.readyAt + 1)]);
    const moved = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, order.readyAt + 2,
    );
    assert.equal((await moved.json()).order.status, "delivered");
    assert.equal((await readCafeDelivery(db, order.readyAt + 2)).trays.length, 0);
  } finally { sqlite.close(); }
});

test("an expired visitor lease cannot restore an old tray after reclaiming the same seat", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    const member = randomUUID();
    const visitorId = putVisitor(sqlite, visitor, "hall:19");
    const order = (await placeOrder(db, visitor, member)).order;
    const priorOwnerOrder = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, order.readyAt,
    );
    assert.equal((await priorOwnerOrder.json()).order.status, "delivered");
    assert.equal((await readCafeDelivery(db, order.readyAt)).trays.length, 1);

    const leaseExpiry = baseTime + 60000;
    await db.batch([
      db.prepare("DELETE FROM cafe_visitors WHERE expires <= ?").bind(leaseExpiry),
      db.prepare("INSERT INTO cafe_visitors " +
        "(id,name,color,x,y,facing,seat,wave,expires) VALUES(?,?,?,?,?,?,?,?,?) " +
        "ON CONFLICT(id) DO UPDATE SET seat=excluded.seat, expires=excluded.expires")
        .bind(visitorId, "다시 온 손님", 0, 33.5, 81.5, 1, "hall:19", 0, leaseExpiry + 60000),
    ]);
    const returned = await snacks(
      orderRequest(visitor, member, randomUUID(), "sync"), db, menu, leaseExpiry + 1,
    );
    assert.equal((await returned.json()).order.status, "delivered");
    assert.equal((await readCafeDelivery(db, leaseExpiry + 1)).trays.length, 0);
  } finally { sqlite.close(); }
});

test("legacy queued orders conservatively reserve their estimated return slot", async () => {
  const { db, sqlite } = makeDb();
  try {
    const visitor = randomUUID();
    putVisitor(sqlite, visitor, "hall:20");
    const legacyReadyAt = baseTime + 3000;
    sqlite.prepare("INSERT INTO cafe_orders " +
      "(id,member_id,seat,items,quantity,coupon,created_at,ready_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(randomUUID(), fingerprint(randomUUID()), "hall:18",
        JSON.stringify([{ name: "컵라면", count: 1 }]), 1, 0,
        baseTime - 4000, legacyReadyAt);
    const order = (await placeOrder(db, visitor, randomUUID())).order;
    assert.ok(order.startAt >= legacyReadyAt + cafeDeliveryTimings.travelLegMs * 2 +
      cafeDeliveryTimings.preparationMs);
    assert.equal((await readCafeDelivery(db, order.startAt)).delivery.seat, "hall:20");
  } finally { sqlite.close(); }
});
