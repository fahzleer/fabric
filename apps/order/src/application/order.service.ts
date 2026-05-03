import { Context, Effect, Layer } from "effect";
import {
  type Order,
  type OrderId,
  type UserId,
  type OrderStatus,
  type PaymentMethod,
  type ShippingAddress,
  type OrderItem,
  InvalidOrderStateError,
  OrderAlreadyPaidError,
  OrderNotFoundError,
  canTransitionTo,
  makeOrderId,
} from "../domain/order.ts";
import { OrderRepository, type AdminStats } from "../infrastructure/db/order.repository.ts";

// ── Service Shape ─────────────────────────────────────────────────────────────

export interface PlaceOrderInput {
  readonly userId:          UserId;
  readonly items:           OrderItem[];
  readonly paymentMethod:   PaymentMethod;
  readonly shippingAddress: ShippingAddress;
  readonly currency?:       string;
}

export interface OrderServiceShape {
  readonly placeOrder:     (input: PlaceOrderInput) => Effect.Effect<Order, never>;
  readonly getOrder:       (orderId: OrderId, requestingUserId: UserId | undefined) => Effect.Effect<Order, OrderNotFoundError>;
  readonly listUserOrders: (userId: UserId)                             => Effect.Effect<Order[], never>;
  readonly listAllOrders:  (limit?: number)                            => Effect.Effect<Order[], never>;
  readonly confirmOrder:   (orderId: OrderId)                          => Effect.Effect<Order, OrderNotFoundError | InvalidOrderStateError>;
  readonly cancelOrder:    (orderId: OrderId, requestingUserId: UserId) => Effect.Effect<Order, OrderNotFoundError | InvalidOrderStateError>;
  readonly markPaid:       (orderId: OrderId)                          => Effect.Effect<Order, OrderNotFoundError | InvalidOrderStateError | OrderAlreadyPaidError>;
  readonly transitionStatus: (orderId: OrderId, next: OrderStatus)     => Effect.Effect<Order, OrderNotFoundError | InvalidOrderStateError>;
  readonly adminStats:     ()                                          => Effect.Effect<AdminStats, never>;
}

// ── Service Tag ───────────────────────────────────────────────────────────────

export class OrderService extends Context.Tag("@fabric/order/OrderService")<
  OrderService,
  OrderServiceShape
>() {
  static readonly Default: Layer.Layer<OrderService, never, OrderRepository> = Layer.effect(
    OrderService,
    Effect.gen(function* () {
      const repo = yield* OrderRepository;

      // ── helpers ───────────────────────────────────────────────────────────

      const transition = (
        orderId: OrderId,
        next: OrderStatus
      ): Effect.Effect<Order, OrderNotFoundError | InvalidOrderStateError> =>
        Effect.gen(function* () {
          const order = yield* repo.findById(orderId);
          if (!canTransitionTo(order, next)) {
            return yield* Effect.fail(
              new InvalidOrderStateError({ orderId, currentStatus: order.status })
            );
          }
          const jobName: Record<OrderStatus, string> = {
            confirmed: "order.confirmed",
            paid:      "order.paid",
            cancelled: "order.cancelled",
            shipped:   "order.shipped",
            delivered: "order.delivered",
            pending:   "order.pending",
          };
          const now = new Date().toISOString();
          const version = yield* repo.nextVersion(orderId);
          yield* repo.transitionOrder({
            event:        { aggregateId: orderId, version, type: `Order${next.charAt(0).toUpperCase()}${next.slice(1)}` as never, payload: {} },
            statusUpdate: { id: orderId, status: next, updatedAt: now },
            jobName:      jobName[next] ?? "order.transition",
          });
          return { ...order, status: next, updatedAt: now };
        });

      // ── implementation ────────────────────────────────────────────────────

      return {
        placeOrder: (input) =>
          Effect.gen(function* () {
            const totalCents = input.items.reduce(
              (sum, i) => sum + i.unitPriceCents * i.quantity,
              0
            );
            const now      = new Date().toISOString();
            const orderId  = makeOrderId();
            const currency = input.currency ?? "THB";

            const order: Order = {
              id:              orderId,
              userId:          input.userId,
              items:           input.items,
              totalCents,
              currency,
              status:          "pending",
              paymentMethod:   input.paymentMethod,
              shippingAddress: input.shippingAddress,
              createdAt:       now,
              updatedAt:       now,
            };

            yield* repo.createOrder({
              event: {
                aggregateId: orderId,
                type:        "OrderPlaced",
                payload: {
                  userId:          input.userId,
                  items:           input.items,
                  totalCents,
                  currency,
                  paymentMethod:   input.paymentMethod,
                  shippingAddress: input.shippingAddress,
                },
              },
              projection: {
                id:              orderId,
                userId:          input.userId,
                status:          "pending",
                totalCents,
                currency,
                paymentMethod:   input.paymentMethod,
                shippingAddress: input.shippingAddress,
                items:           input.items,
                createdAt:       now,
              },
            });

            return order;
          }),

        getOrder: (orderId, requestingUserId) =>
          Effect.gen(function* () {
            const order = yield* repo.findById(orderId);
            if (requestingUserId !== undefined && order.userId !== requestingUserId) {
              return yield* Effect.fail(new OrderNotFoundError({ orderId }));
            }
            return order;
          }),

        listUserOrders:  (userId)        => repo.findByUserId(userId),
        listAllOrders:   (limit)         => repo.findAll(limit),
        adminStats:      ()              => repo.getAdminStats(),
        confirmOrder:    (orderId)       => transition(orderId, "confirmed"),
        transitionStatus:(orderId, next) => transition(orderId, next),

        cancelOrder: (orderId, requestingUserId) =>
          Effect.gen(function* () {
            const order = yield* repo.findById(orderId);
            if (order.userId !== requestingUserId) {
              return yield* Effect.fail(new OrderNotFoundError({ orderId }));
            }
            return yield* transition(orderId, "cancelled");
          }),

        markPaid: (orderId) =>
          Effect.gen(function* () {
            const order = yield* repo.findById(orderId);
            if (order.status === "paid") {
              return yield* Effect.fail(new OrderAlreadyPaidError({ orderId }));
            }
            return yield* transition(orderId, "paid");
          }),
      } satisfies OrderServiceShape;
    })
  );
}
