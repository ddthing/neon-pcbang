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
  zone: text().notNull().default("hall"),
  avatar: text().notNull().default(""),
  activity: text().notNull().default(""),
  expires: integer().notNull(),
}, (table) => [
  uniqueIndex("cafe_visitors_seat").on(table.seat),
  index("cafe_visitors_expires").on(table.expires),
  index("cafe_visitors_zone_expires").on(table.zone, table.expires),
]);

export const loyalty = sqliteTable("cafe_loyalty", {
  memberId: text("member_id").primaryKey().notNull(),
  day: text().notNull(),
  dayMs: integer("day_ms").notNull().default(0),
  totalMs: integer("total_ms").notNull().default(0),
  activeAt: integer("active_at").notNull().default(0),
  claimDay: text("claim_day").notNull().default(""),
  stamps: integer().notNull().default(0),
  points: integer("points").notNull().default(150),
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
  optionsJson: text("options_json").notNull().default("{}"),
  giftFrom: text("gift_from").notNull().default(""),
  giftNote: text("gift_note").notNull().default(""),
  eatenAt: integer("eaten_at"),
}, (table) => [
  index("cafe_orders_recent").on(table.createdAt),
  index("cafe_orders_member").on(table.memberId, table.coupon, table.readyAt),
  index("cafe_orders_attendant").on(table.startAt, table.returnAt, table.leftAt),
  index("cafe_orders_visitor").on(table.visitorId, table.leftAt, table.readyAt),
  index("cafe_orders_return").on(table.returnAt),
]);

export const leaderboard = sqliteTable("cafe_leaderboard", {
  id: text().primaryKey().notNull(),
  game: text().notNull(),
  mode: text().notNull().default("standard"),
  memberId: text("member_id").notNull(),
  nickname: text().notNull(),
  score: integer().notNull(),
  metric: text().notNull().default(""),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  uniqueIndex("cafe_leaderboard_member_game").on(table.game, table.mode, table.memberId),
  index("cafe_leaderboard_top").on(table.game, table.mode, table.score, table.updatedAt),
]);

export const pvpMatches = sqliteTable("cafe_pvp_matches", {
  id: text().primaryKey().notNull(),
  game: text().notNull(),
  status: text().notNull(),
  hostId: text("host_id").notNull(),
  hostName: text("host_name").notNull(),
  hostSeat: text("host_seat"),
  guestId: text("guest_id"),
  guestName: text("guest_name"),
  guestSeat: text("guest_seat"),
  turn: text().notNull(),
  winner: text(),
  stateJson: text("state_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, (table) => [
  index("cafe_pvp_matches_active").on(table.status, table.expiresAt, table.updatedAt),
]);
