// ── Kafka Topic Registry ──────────────────────────────────────────────────────
//
// Single source of truth for all topic names across the platform.
// Import this instead of using raw strings in services.

export const TOPICS = {
  // ── Order service ─────────────────────────────────────────────────────────
  ORDER_PLACED:    "order.placed",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PAID:      "order.paid",
  ORDER_SHIPPED:   "order.shipped",
  ORDER_DELIVERED: "order.delivered",
  ORDER_CANCELLED: "order.cancelled",

  // ── Payment service ───────────────────────────────────────────────────────
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED:    "payment.failed",
  PAYMENT_REFUNDED:  "payment.refunded",

  // ── Shipping service ──────────────────────────────────────────────────────
  SHIPMENT_CREATED:    "shipment.created",
  SHIPMENT_UPDATED:    "shipment.updated",
  SHIPMENT_DELIVERED:  "shipment.delivered",

  // ── Customer service ──────────────────────────────────────────────────────
  CUSTOMER_REGISTERED: "customer.registered",
  CUSTOMER_UPDATED:    "customer.updated",

  // ── Product service ───────────────────────────────────────────────────────
  PRODUCT_CREATED:          "product.created",
  PRODUCT_UPDATED:          "product.updated",
  PRODUCT_DELETED:          "product.deleted",
  PRODUCT_INVENTORY_CHANGED: "product.inventory_changed",

  // ── Notification service (outbound) ───────────────────────────────────────
  NOTIFICATION_EMAIL: "notification.email",
  NOTIFICATION_SMS:   "notification.sms",
  NOTIFICATION_PUSH:  "notification.push",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

// ── Topic configuration (for auto-creation / admin scripts) ───────────────────

export interface TopicConfig {
  readonly name:              TopicName;
  readonly partitions:        number;
  readonly replicationFactor: number;
  readonly retentionMs:       number;
}

export const TOPIC_CONFIGS: TopicConfig[] = [
  // High-throughput order topics — 6 partitions
  { name: TOPICS.ORDER_PLACED,    partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },
  { name: TOPICS.ORDER_CONFIRMED, partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },
  { name: TOPICS.ORDER_PAID,      partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },
  { name: TOPICS.ORDER_SHIPPED,   partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },
  { name: TOPICS.ORDER_DELIVERED, partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },
  { name: TOPICS.ORDER_CANCELLED, partitions: 6, replicationFactor: 3, retentionMs: 7 * 24 * 60 * 60_000 },

  // Payment — 3 partitions, long retention for audit
  { name: TOPICS.PAYMENT_INITIATED, partitions: 3, replicationFactor: 3, retentionMs: 90 * 24 * 60 * 60_000 },
  { name: TOPICS.PAYMENT_SUCCEEDED, partitions: 3, replicationFactor: 3, retentionMs: 90 * 24 * 60 * 60_000 },
  { name: TOPICS.PAYMENT_FAILED,    partitions: 3, replicationFactor: 3, retentionMs: 90 * 24 * 60 * 60_000 },
  { name: TOPICS.PAYMENT_REFUNDED,  partitions: 3, replicationFactor: 3, retentionMs: 90 * 24 * 60 * 60_000 },

  // Shipping — 3 partitions
  { name: TOPICS.SHIPMENT_CREATED,   partitions: 3, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },
  { name: TOPICS.SHIPMENT_UPDATED,   partitions: 3, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },
  { name: TOPICS.SHIPMENT_DELIVERED, partitions: 3, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },

  // Customer — 3 partitions, long retention
  { name: TOPICS.CUSTOMER_REGISTERED, partitions: 3, replicationFactor: 3, retentionMs: 365 * 24 * 60 * 60_000 },
  { name: TOPICS.CUSTOMER_UPDATED,    partitions: 3, replicationFactor: 3, retentionMs: 365 * 24 * 60 * 60_000 },

  // Product — 6 partitions (catalog changes fan-out to search + importer)
  { name: TOPICS.PRODUCT_CREATED,           partitions: 6, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },
  { name: TOPICS.PRODUCT_UPDATED,           partitions: 6, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },
  { name: TOPICS.PRODUCT_DELETED,           partitions: 6, replicationFactor: 3, retentionMs: 30 * 24 * 60 * 60_000 },
  { name: TOPICS.PRODUCT_INVENTORY_CHANGED, partitions: 6, replicationFactor: 3, retentionMs: 14 * 24 * 60 * 60_000 },

  // Notifications — 6 partitions (fan-out heavy)
  { name: TOPICS.NOTIFICATION_EMAIL, partitions: 6, replicationFactor: 3, retentionMs: 3 * 24 * 60 * 60_000 },
  { name: TOPICS.NOTIFICATION_SMS,   partitions: 6, replicationFactor: 3, retentionMs: 3 * 24 * 60 * 60_000 },
  { name: TOPICS.NOTIFICATION_PUSH,  partitions: 6, replicationFactor: 3, retentionMs: 3 * 24 * 60 * 60_000 },
];
