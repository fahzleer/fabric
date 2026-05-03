import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "./database.ts";
import { shipments } from "./schema.ts";
import {
  type Shipment,
  type ShipmentId,
  type OrderId,
  type Carrier,
  type ShipmentStatus,
  type ShippingAddress,
  ShipmentNotFoundError,
} from "../../domain/shipment.ts";

export interface ShipmentRepositoryShape {
  readonly save:        (shipment: Shipment) => Effect.Effect<void, never>;
  readonly findById:    (id: ShipmentId) => Effect.Effect<Shipment, ShipmentNotFoundError>;
  readonly findByOrder: (orderId: OrderId) => Effect.Effect<Shipment, ShipmentNotFoundError>;
  readonly update:      (shipment: Shipment) => Effect.Effect<Shipment, ShipmentNotFoundError>;
}

export class ShipmentRepository extends Context.Tag(
  "@fabric/shipping/ShipmentRepository"
)<ShipmentRepository, ShipmentRepositoryShape>() {
  static readonly Default: Layer.Layer<ShipmentRepository, never, Database> =
    Layer.effect(
      ShipmentRepository,
      Effect.gen(function* () {
        const db = yield* Database;

        const rowToShipment = (row: typeof shipments.$inferSelect): Shipment => ({
          id:                row.id as ShipmentId,
          orderId:           row.orderId as OrderId,
          carrier:           row.carrier as Carrier,
          trackingNumber:    row.trackingNumber,
          status:            row.status as ShipmentStatus,
          address:           row.address as ShippingAddress,
          estimatedDelivery: row.estimatedDelivery,
          createdAt:         row.createdAt,
          updatedAt:         row.updatedAt,
        });

        return {
          save: (shipment) =>
            Effect.tryPromise({
              try: () =>
                db.insert(shipments).values({
                  id:                shipment.id,
                  orderId:           shipment.orderId,
                  carrier:           shipment.carrier,
                  trackingNumber:    shipment.trackingNumber,
                  status:            shipment.status,
                  address:           shipment.address,
                  estimatedDelivery: shipment.estimatedDelivery,
                  createdAt:         shipment.createdAt,
                  updatedAt:         shipment.updatedAt,
                }),
              catch: () => new Error("insert failed"),
            }).pipe(Effect.asVoid, Effect.orDie),

          findById: (id) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(shipments).where(eq(shipments.id, id)).limit(1),
              catch: () => new ShipmentNotFoundError({ shipmentId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToShipment(rows[0]))
                  : Effect.fail(new ShipmentNotFoundError({ shipmentId: id }))
              )
            ),

          findByOrder: (orderId) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(shipments).where(eq(shipments.orderId, orderId)).limit(1),
              catch: () => new ShipmentNotFoundError({ shipmentId: "" as ShipmentId }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToShipment(rows[0]))
                  : Effect.fail(new ShipmentNotFoundError({ shipmentId: "" as ShipmentId }))
              )
            ),

          update: (shipment) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(shipments)
                  .set({
                    trackingNumber:    shipment.trackingNumber,
                    status:            shipment.status,
                    estimatedDelivery: shipment.estimatedDelivery,
                    updatedAt:         shipment.updatedAt,
                  })
                  .where(eq(shipments.id, shipment.id))
                  .returning(),
              catch: () => new ShipmentNotFoundError({ shipmentId: shipment.id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToShipment(rows[0]))
                  : Effect.fail(new ShipmentNotFoundError({ shipmentId: shipment.id }))
              )
            ),
        } satisfies ShipmentRepositoryShape;
      })
    );
}
