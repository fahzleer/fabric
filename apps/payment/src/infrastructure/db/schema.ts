import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const payments = pgTable("payments", {
  id:            text("id").primaryKey(),
  orderId:       text("order_id").notNull(),
  amountCents:   integer("amount_cents").notNull(),
  currency:      text("currency").notNull().default("THB"),
  method:        text("method").notNull(),
  provider:      text("provider").notNull(),
  status:        text("status").notNull().default("pending"),
  providerRef:   text("provider_ref"),
  failureReason: text("failure_reason"),
  createdAt:     timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt:     timestamp("updated_at", { mode: "string" }).notNull(),
});

export type PaymentRow = typeof payments.$inferSelect;
