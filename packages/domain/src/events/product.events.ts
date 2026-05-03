// ── Product domain events ─────────────────────────────────────────────────────

export interface ProductCreatedEvent {
  readonly _type:       "product.created";
  readonly id:          string;
  readonly name:        string;
  readonly description: string;
  readonly priceCents:  number;
  readonly currency:    string;
  readonly category:    string;
  readonly tags:        string[];
  readonly inventory:   Record<string, number>; // { "S": 10, "M": 5 }
  readonly imageUrls:   string[];
  readonly createdAt:   string;
}

export interface ProductUpdatedEvent {
  readonly _type:      "product.updated";
  readonly id:         string;
  readonly name?:      string;
  readonly priceCents?: number;
  readonly inventory?:  Record<string, number>;
  readonly updatedAt:  string;
}

export interface ProductDeletedEvent {
  readonly _type:     "product.deleted";
  readonly id:        string;
  readonly deletedAt: string;
}

export interface InventoryChangedEvent {
  readonly _type:      "product.inventory_changed";
  readonly productId:  string;
  readonly sku:        string;
  readonly delta:      number;  // positive = restock, negative = sold
  readonly remaining:  number;
  readonly reason:     "sale" | "restock" | "adjustment";
  readonly updatedAt:  string;
}

export type ProductEvent =
  | ProductCreatedEvent
  | ProductUpdatedEvent
  | ProductDeletedEvent
  | InventoryChangedEvent;
