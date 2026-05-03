// ── Shipment domain events ────────────────────────────────────────────────────

export type Carrier        = "thpost" | "kerry" | "flash" | "dhl" | "fedex";
export type ShipmentStatus = "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed";

export interface ShipmentCreatedEvent {
  readonly _type:    "shipment.created";
  readonly id:       string;
  readonly orderId:  string;
  readonly carrier:  Carrier;
  readonly createdAt: string;
}

export interface ShipmentUpdatedEvent {
  readonly _type:          "shipment.updated";
  readonly id:             string;
  readonly orderId:        string;
  readonly status:         ShipmentStatus;
  readonly trackingNumber?: string;
  readonly updatedAt:      string;
}

export interface ShipmentDeliveredEvent {
  readonly _type:       "shipment.delivered";
  readonly id:          string;
  readonly orderId:     string;
  readonly deliveredAt: string;
}

export type ShipmentEvent =
  | ShipmentCreatedEvent
  | ShipmentUpdatedEvent
  | ShipmentDeliveredEvent;
