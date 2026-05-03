import { Context, Effect, Layer } from "effect";
import { KafkaConsumer, KafkaProducer, type KafkaMessage } from "@fabric/kafka";
import { EmailAdapter }  from "../adapters/email.adapter.ts";
import { SmsAdapter }    from "../adapters/sms.adapter.ts";
import { PushAdapter }   from "../adapters/push.adapter.ts";

// ── Notification Service ──────────────────────────────────────────────────────

export interface NotificationServiceShape {
  readonly startListening: () => Effect.Effect<void, never>;
  readonly handle:         (topic: string, data: unknown) => Effect.Effect<void, never>;
}

// ── Template helpers ──────────────────────────────────────────────────────────

type OrderData    = { orderId?: string; userId?: string; totalAmountInCents?: number };
type ShipmentData = { orderId?: string; trackingNumber?: string };
type CustomerData = { email?: string; name?: string; phone?: string };

function orderEmail(data: OrderData): { subject: string; text: string } {
  return {
    subject: `Your order #${data.orderId ?? ""} has been placed`,
    text:    `Thank you! Your order (${data.orderId ?? ""}) was placed successfully.`,
  };
}

function shipmentEmail(data: ShipmentData): { subject: string; text: string } {
  return {
    subject: `Your order #${data.orderId ?? ""} has shipped`,
    text:    `Your order is on its way! Tracking: ${data.trackingNumber ?? "pending"}.`,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export class NotificationService extends Context.Tag(
  "@fabric/notification/NotificationService"
)<NotificationService, NotificationServiceShape>() {
  static readonly Default: Layer.Layer<
    NotificationService,
    never,
    KafkaConsumer | KafkaProducer | EmailAdapter | SmsAdapter | PushAdapter
  > = Layer.effect(
    NotificationService,
    Effect.gen(function* () {
      const consumer = yield* KafkaConsumer;
      const email    = yield* EmailAdapter;
      const sms      = yield* SmsAdapter;
      const push     = yield* PushAdapter;

      const TOPICS = [
        "order.placed",
        "order.confirmed",
        "order.paid",
        "order.cancelled",
        "payment.succeeded",
        "payment.failed",
        "shipment.created",
        "shipment.delivered",
        "customer.registered",
      ];

      const dispatch = (topic: string, data: unknown): Effect.Effect<void, never> => {
        const d = data as Record<string, unknown>;

        switch (topic) {
          case "order.placed": {
            const od = d as OrderData;
            const to = String(d["userEmail"] ?? "");
            if (!to) return Effect.void;
            const tpl = orderEmail(od);
            return Effect.all([
              email.send({ to, ...tpl }),
              sms.send({ to: String(d["userPhone"] ?? ""), body: tpl.text }),
            ], { discard: true });
          }

          case "order.paid": {
            const od = d as OrderData;
            const to = String(d["userEmail"] ?? "");
            if (!to) return Effect.void;
            return email.send({
              to,
              subject: `Payment confirmed for order #${od.orderId ?? ""}`,
              text:    `Your payment was successful. Order total: ${((od.totalAmountInCents ?? 0) / 100).toFixed(2)} THB.`,
            });
          }

          case "order.cancelled": {
            const to = String(d["userEmail"] ?? "");
            if (!to) return Effect.void;
            return email.send({
              to,
              subject: `Order #${String(d["orderId"] ?? "")} cancelled`,
              text:    `Your order has been cancelled. Contact support if this was unexpected.`,
            });
          }

          case "shipment.created":
          case "shipment.delivered": {
            const sd = d as ShipmentData;
            const to = String(d["userEmail"] ?? "");
            if (!to) return Effect.void;
            const tpl = shipmentEmail(sd);
            return email.send({ to, ...tpl });
          }

          case "customer.registered": {
            const cd = d as CustomerData;
            const to = cd.email ?? "";
            if (!to) return Effect.void;
            return email.send({
              to,
              subject: "Welcome to Fabric!",
              text:    `Hi ${cd.name ?? "there"}, your account has been created successfully.`,
            });
          }

          default:
            return Effect.sync(() =>
              console.log(`[notification] unhandled topic: ${topic}`, d)
            );
        }
      };

      void push; // FCM available for future push notifications

      const handleEvent = <T>(msg: KafkaMessage<T>): Effect.Effect<void, never> =>
        dispatch(msg.topic, msg.value);

      return {
        startListening: () =>
          consumer.subscribe(TOPICS, handleEvent).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() =>
                console.error("[notification] consumer error:", e.message)
              )
            )
          ),

        handle: (topic, data) => dispatch(topic, data),
      } satisfies NotificationServiceShape;
    })
  );
}
