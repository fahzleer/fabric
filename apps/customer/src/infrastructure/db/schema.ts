import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id:        text("id").primaryKey(),
  email:     text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName:  text("last_name").notNull(),
  phone:     text("phone").notNull().default(""),
  address:   jsonb("address"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export type CustomerRow = typeof customers.$inferSelect;
