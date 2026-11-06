import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const visitors = sqliteTable("cafe_visitors", {
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  color: integer().notNull(),
  x: real().notNull(),
  y: real().notNull(),
  facing: integer().notNull(),
  seat: text(),
  wave: integer().notNull().default(0),
  expires: integer().notNull(),
}, (table) => [
  uniqueIndex("cafe_visitors_seat").on(table.seat),
  index("cafe_visitors_expires").on(table.expires),
]);

export const loyalty = sqliteTable("cafe_loyalty", {
  memberId: text("member_id").primaryKey().notNull(),
  day: text().notNull(),
  dayMs: integer("day_ms").notNull().default(0),
  totalMs: integer("total_ms").notNull().default(0),
  activeAt: integer("active_at").notNull().default(0),
  claimDay: text("claim_day").notNull().default(""),
  stamps: integer().notNull().default(0),
});

export const orders = sqliteTable("cafe_orders", {
  id: text().primaryKey().notNull(),
  memberId: text("member_id").notNull(),
  seat: text().notNull(),
  items: text().notNull(),
  quantity: integer().notNull(),
  coupon: integer().notNull().default(0),
  createdAt: integer("created_at").notNull(),
  readyAt: integer("ready_at").notNull(),
  visitorId: text("visitor_id"),
  startAt: integer("start_at").notNull().default(0),
  returnAt: integer("return_at").notNull().default(0),
  leftAt: integer("left_at"),
}, (table) => [
  index("cafe_orders_recent").on(table.createdAt),
  index("cafe_orders_member").on(table.memberId, table.coupon, table.readyAt),
  index("cafe_orders_attendant").on(table.startAt, table.returnAt, table.leftAt),
  index("cafe_orders_visitor").on(table.visitorId, table.leftAt, table.readyAt),
  index("cafe_orders_return").on(table.returnAt),
]);
