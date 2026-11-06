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
