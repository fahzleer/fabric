import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type Shipment,
  type ShipmentId,
  type OrderId,
  type Carrier,
  type ShipmentStatus,
  type ShippingAddress,
  ShipmentNotFoundError,
  InvalidShipmentStateError,
  makeShipmentId,
  canTransitionTo,
} from "../domain/shipment.ts";
import { ShipmentRepository } from "../infrastructure/db/shipment.repository.ts";

const TOPIC = {
  CREATED:   "shipment.created",
  UPDATED:   "shipment.updated",
  DELIVERED: "shipment.delivered",
} as const;

export interface CreateShipmentInput {
  readonly orderId:  OrderId;
  readonly carrier:  Carrier;
  readonly address:  ShippingAddress;
}

export interface ShippingServiceShape {
  readonly create:      (input: CreateShipmentInput) => Effect.Effect<Shipment, never>;
  readonly setTracking: (id: ShipmentId, trackingNumber: string) => Effect.Effect<Shipment, ShipmentNotFoundError>;
  readonly transition:  (id: ShipmentId, next: ShipmentStatus) => Effect.Effect<Shipment, ShipmentNotFoundError | InvalidShipmentStateError>;
  readonly getById:     (id: ShipmentId) => Effect.Effect<Shipment, ShipmentNotFoundError>;
  readonly getByOrder:  (orderId: OrderId) => Effect.Effect<Shipment, ShipmentNotFoundError>;
}

export class ShippingService extends Context.Tag(
  "@fabric/shipping/ShippingService"
)<ShippingService, ShippingServiceShape>() {
  static readonly Default: Layer.Layer<ShippingService, never, KafkaProducer | ShipmentRepository> =
    Layer.effect(
      ShippingService,
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        const repo     = yield* ShipmentRepository;

        const publish = (topic: string, payload: unknown, key: string) =>
          producer.publish(topic, payload, { key }).pipe(Effect.catchAll(() => Effect.void));

        return {
          create: (input) =>
            Effect.gen(function* () {
              const now = new Date().toISOString();
              const shipment: Shipment = {
                id:                makeShipmentId(),
                orderId:           input.orderId,
                carrier:           input.carrier,
                trackingNumber:    null,
                status:            "pending",
                address:           input.address,
                estimatedDelivery: null,
                createdAt:         now,
                updatedAt:         now,
              };
              yield* repo.save(shipment);
              yield* publish(TOPIC.CREATED, shipment, shipment.id);
              return shipment;
            }),

          setTracking: (id, trackingNumber) =>
            Effect.gen(function* () {
              const s = yield* repo.findById(id);
              return yield* repo.update({ ...s, trackingNumber, updatedAt: new Date().toISOString() });
            }),

          transition: (id, next) =>
            Effect.gen(function* () {
              const s = yield* repo.findById(id);
              if (!canTransitionTo(s.status, next)) {
                return yield* Effect.fail(
                  new InvalidShipmentStateError({ shipmentId: id, currentStatus: s.status })
                );
              }
              const updated = yield* repo.update({ ...s, status: next, updatedAt: new Date().toISOString() });
              const topic   = next === "delivered" ? TOPIC.DELIVERED : TOPIC.UPDATED;
              yield* publish(topic, updated, id);
              return updated;
            }),

          getById:    (id) => repo.findById(id),
          getByOrder: (orderId) => repo.findByOrder(orderId),
        } satisfies ShippingServiceShape;
      })
    );
}
