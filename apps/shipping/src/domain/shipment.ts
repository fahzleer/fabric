import { Data } from "effect";

export type ShipmentId = string & { readonly _brand: "ShipmentId" };
export type OrderId    = string & { readonly _brand: "OrderId" };

export const makeShipmentId = (): ShipmentId => crypto.randomUUID() as ShipmentId;

export class ShipmentNotFoundError extends Data.TaggedError("ShipmentNotFoundError")<{
  readonly shipmentId: ShipmentId;
}> {}

export class InvalidShipmentStateError extends Data.TaggedError("InvalidShipmentStateError")<{
  readonly shipmentId: ShipmentId;
  readonly currentStatus: ShipmentStatus;
}> {}

export type ShipmentStatus = "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed";
export type Carrier        = "thpost" | "kerry" | "flash" | "dhl" | "fedex";

export interface ShippingAddress {
  readonly recipientName: string;
  readonly street:        string;
  readonly city:          string;
  readonly province:      string;
  readonly postalCode:    string;
  readonly country:       string;
  readonly phone:         string;
}

export interface Shipment {
  readonly id:              ShipmentId;
  readonly orderId:         OrderId;
  readonly carrier:         Carrier;
  readonly trackingNumber:  string | null;
  readonly status:          ShipmentStatus;
  readonly address:         ShippingAddress;
  readonly estimatedDelivery: string | null;
  readonly createdAt:       string;
  readonly updatedAt:       string;
}

// ── Domain logic ──────────────────────────────────────────────────────────────

export const canTransitionTo = (from: ShipmentStatus, to: ShipmentStatus): boolean => {
  const allowed: Record<ShipmentStatus, ShipmentStatus[]> = {
    pending:          ["picked_up", "failed"],
    picked_up:        ["in_transit", "failed"],
    in_transit:       ["out_for_delivery", "failed"],
    out_for_delivery: ["delivered", "failed"],
    delivered:        [],
    failed:           [],
  };
  return (allowed[from] ?? []).includes(to);
};
