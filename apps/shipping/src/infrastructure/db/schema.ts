import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import type { ShippingAddress } from "../../domain/shipment.ts";

export const shipments = pgTable("shipments", {
  id:                text("id").primaryKey(),
  orderId:           text("order_id").notNull().unique(),
  carrier:           text("carrier").notNull(),
  trackingNumber:    text("tracking_number"),
  status:            text("status").notNull().default("pending"),
  address:           jsonb("address").notNull().$type<ShippingAddress>(),
  estimatedDelivery: text("estimated_delivery"),
  createdAt:         timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt:         timestamp("updated_at", { mode: "string" }).notNull(),
});

export type ShipmentRow = typeof shipments.$inferSelect;
