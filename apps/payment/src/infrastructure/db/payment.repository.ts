import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "./database.ts";
import { payments } from "./schema.ts";
import {
  type Payment,
  type PaymentId,
  type OrderId,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentStatus,
  PaymentNotFoundError,
} from "../../domain/payment.ts";

export interface PaymentRepositoryShape {
  readonly save:        (payment: Payment) => Effect.Effect<void, never>;
  readonly findById:    (id: PaymentId) => Effect.Effect<Payment, PaymentNotFoundError>;
  readonly findByOrder: (orderId: OrderId) => Effect.Effect<Payment, PaymentNotFoundError>;
  readonly update:      (payment: Payment) => Effect.Effect<Payment, PaymentNotFoundError>;
}

export class PaymentRepository extends Context.Tag(
  "@fabric/payment/PaymentRepository"
)<PaymentRepository, PaymentRepositoryShape>() {
  static readonly Default: Layer.Layer<PaymentRepository, never, Database> =
    Layer.effect(
      PaymentRepository,
      Effect.gen(function* () {
        const db = yield* Database;

        const rowToPayment = (row: typeof payments.$inferSelect): Payment => ({
          id:            row.id as PaymentId,
          orderId:       row.orderId as OrderId,
          amountCents:   row.amountCents,
          currency:      row.currency,
          method:        row.method as PaymentMethod,
          provider:      row.provider as PaymentProvider,
          status:        row.status as PaymentStatus,
          providerRef:   row.providerRef,
          failureReason: row.failureReason,
          createdAt:     row.createdAt,
          updatedAt:     row.updatedAt,
        });

        return {
          save: (payment) =>
            Effect.tryPromise({
              try: () =>
                db.insert(payments).values({
                  id:            payment.id,
                  orderId:       payment.orderId,
                  amountCents:   payment.amountCents,
                  currency:      payment.currency,
                  method:        payment.method,
                  provider:      payment.provider,
                  status:        payment.status,
                  providerRef:   payment.providerRef,
                  failureReason: payment.failureReason,
                  createdAt:     payment.createdAt,
                  updatedAt:     payment.updatedAt,
                }),
              catch: () => new Error("insert failed"),
            }).pipe(Effect.asVoid, Effect.orDie),

          findById: (id) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(payments).where(eq(payments.id, id)).limit(1),
              catch: () => new PaymentNotFoundError({ paymentId: id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPayment(rows[0]))
                  : Effect.fail(new PaymentNotFoundError({ paymentId: id }))
              )
            ),

          findByOrder: (orderId) =>
            Effect.tryPromise({
              try: () =>
                db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1),
              catch: () => new PaymentNotFoundError({ paymentId: "" as PaymentId }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPayment(rows[0]))
                  : Effect.fail(new PaymentNotFoundError({ paymentId: "" as PaymentId }))
              )
            ),

          update: (payment) =>
            Effect.tryPromise({
              try: () =>
                db
                  .update(payments)
                  .set({
                    status:        payment.status,
                    providerRef:   payment.providerRef,
                    failureReason: payment.failureReason,
                    updatedAt:     payment.updatedAt,
                  })
                  .where(eq(payments.id, payment.id))
                  .returning(),
              catch: () => new PaymentNotFoundError({ paymentId: payment.id }),
            }).pipe(
              Effect.flatMap((rows) =>
                rows[0]
                  ? Effect.succeed(rowToPayment(rows[0]))
                  : Effect.fail(new PaymentNotFoundError({ paymentId: payment.id }))
              )
            ),
        } satisfies PaymentRepositoryShape;
      })
    );
}
