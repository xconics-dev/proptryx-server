import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const test_table = pgTable("test_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  org_id: varchar("org_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TestTable = typeof test_table.$inferSelect;
