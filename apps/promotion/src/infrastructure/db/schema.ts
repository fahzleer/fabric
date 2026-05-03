import { pgTable, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const promotions = pgTable("promotions", {
  id:              text("id").primaryKey(),
  code:            text("code").notNull().unique(),
  description:     text("description").notNull(),
  discountType:    text("discount_type").notNull(),
  discountValue:   real("discount_value").notNull(),
  minimumCents:    integer("minimum_cents").notNull().default(0),
  maxUsageTotal:   integer("max_usage_total"),
  maxUsagePerUser: integer("max_usage_per_user").notNull().default(1),
  usageCount:      integer("usage_count").notNull().default(0),
  startsAt:        timestamp("starts_at", { mode: "string" }).notNull(),
  expiresAt:       timestamp("expires_at", { mode: "string" }),
  isActive:        boolean("is_active").notNull().default(true),
  createdAt:       timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt:       timestamp("updated_at", { mode: "string" }).notNull(),
});

export type PromotionRow = typeof promotions.$inferSelect;
