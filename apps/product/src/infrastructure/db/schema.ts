import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id:          text("id").primaryKey(),
  merchantId:  text("merchant_id").notNull(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents:  integer("price_cents").notNull(),
  currency:    text("currency").notNull().default("THB"),
  category:    text("category").notNull().default(""),
  tags:        jsonb("tags").notNull().default("[]"),
  inventory:   jsonb("inventory").notNull().default("{}"),
  imageUrls:   jsonb("image_urls").notNull().default("[]"),
  isActive:    boolean("is_active").notNull().default(true),
  createdAt:   timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt:   timestamp("updated_at", { mode: "string" }).notNull(),
});

export type ProductRow = typeof products.$inferSelect;
