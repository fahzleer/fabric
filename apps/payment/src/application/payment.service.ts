import { Context, Effect, Layer } from "effect";
import { KafkaProducer } from "@fabric/kafka";
import {
  type Payment,
  type PaymentId,
  type OrderId,
  type PaymentMethod,
  PaymentNotFoundError,
  PaymentAlreadyProcessedError,
  PaymentGatewayError,
  makePaymentId,
  methodToProvider,
  isTerminal,
} from "../domain/payment.ts";
import { PaymentRepository } from "../infrastructure/db/payment.repository.ts";

// ── Kafka topics ──────────────────────────────────────────────────────────────

const TOPIC = {
  INITIATED:  "payment.initiated",
  SUCCEEDED:  "payment.succeeded",
  FAILED:     "payment.failed",
  REFUNDED:   "payment.refunded",
} as const;

// ── Service Shape ─────────────────────────────────────────────────────────────

export interface InitiatePaymentInput {
  readonly orderId:     OrderId;
  readonly amountCents: number;
  readonly currency:    string;
  readonly method:      PaymentMethod;
}

export interface PaymentServiceShape {
  readonly initiate:   (input: InitiatePaymentInput) => Effect.Effect<Payment, never>;
  readonly succeed:    (paymentId: PaymentId, providerRef: string) => Effect.Effect<Payment, PaymentNotFoundError | PaymentAlreadyProcessedError>;
  readonly fail:       (paymentId: PaymentId, reason: string) => Effect.Effect<Payment, PaymentNotFoundError | PaymentAlreadyProcessedError>;
  readonly refund:     (paymentId: PaymentId) => Effect.Effect<Payment, PaymentNotFoundError | PaymentAlreadyProcessedError | PaymentGatewayError>;
  readonly getById:    (id: PaymentId) => Effect.Effect<Payment, PaymentNotFoundError>;
  readonly getByOrder: (orderId: OrderId) => Effect.Effect<Payment, PaymentNotFoundError>;
}

export class PaymentService extends Context.Tag(
  "@fabric/payment/PaymentService"
)<PaymentService, PaymentServiceShape>() {
  static readonly Default: Layer.Layer<PaymentService, never, KafkaProducer | PaymentRepository> =
    Layer.effect(
      PaymentService,
      Effect.gen(function* () {
        const producer = yield* KafkaProducer;
        const repo     = yield* PaymentRepository;

        const publish = (topic: string, payload: unknown, key: string) =>
          producer.publish(topic, payload, { key }).pipe(Effect.catchAll(() => Effect.void));

        return {
          initiate: (input) =>
            Effect.gen(function* () {
              const now = new Date().toISOString();
              const payment: Payment = {
                id:            makePaymentId(),
                orderId:       input.orderId,
                amountCents:   input.amountCents,
                currency:      input.currency,
                method:        input.method,
                provider:      methodToProvider(input.method),
                status:        "pending",
                providerRef:   null,
                failureReason: null,
                createdAt:     now,
                updatedAt:     now,
              };
              yield* repo.save(payment);
              yield* publish(TOPIC.INITIATED, payment, payment.id);
              return payment;
            }),

          succeed: (paymentId, providerRef) =>
            Effect.gen(function* () {
              const p = yield* repo.findById(paymentId);
              if (isTerminal(p.status)) {
                return yield* Effect.fail(new PaymentAlreadyProcessedError({ paymentId }));
              }
              const updated = yield* repo.update({
                ...p,
                status:    "succeeded",
                providerRef,
                updatedAt: new Date().toISOString(),
              });
              yield* publish(TOPIC.SUCCEEDED, updated, paymentId);
              return updated;
            }),

          fail: (paymentId, reason) =>
            Effect.gen(function* () {
              const p = yield* repo.findById(paymentId);
              if (isTerminal(p.status)) {
                return yield* Effect.fail(new PaymentAlreadyProcessedError({ paymentId }));
              }
              const updated = yield* repo.update({
                ...p,
                status:        "failed",
                failureReason: reason,
                updatedAt:     new Date().toISOString(),
              });
              yield* publish(TOPIC.FAILED, updated, paymentId);
              return updated;
            }),

          refund: (paymentId) =>
            Effect.gen(function* () {
              const p = yield* repo.findById(paymentId);
              if (p.status !== "succeeded") {
                return yield* Effect.fail(new PaymentAlreadyProcessedError({ paymentId }));
              }
              const updated = yield* repo.update({
                ...p,
                status:    "refunded",
                updatedAt: new Date().toISOString(),
              });
              yield* publish(TOPIC.REFUNDED, updated, paymentId);
              return updated;
            }),

          getById:    (id) => repo.findById(id),
          getByOrder: (orderId) => repo.findByOrder(orderId),
        } satisfies PaymentServiceShape;
      })
    );
}
