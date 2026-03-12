import type { FirebaseOrderRecord, FirebaseProductRecord } from "@fabric/firebase";
import { OrderNotFoundError, ProductNotFoundError, ProductOutOfStockError } from "@fabric/types";
import { None, Some } from "@fabric/types";
import type { RepositoryError } from "@fabric/types";
import type { NonEmptyArray } from "@fabric/types";
import { isNonEmpty } from "@fabric/types";
import type { Result } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import type { OrderRepositoryPort } from "../../application/ports/order.repository.port";
import type {
  PaginatedResult,
  PaginationInput,
  StockReservationItem,
} from "../../application/ports/product.repository.port";
import { makeRepositoryError } from "../../application/ports/product.repository.port";
import type { Order, OrderSummary } from "../../domain/order/order.entity";
import { toOrderSummary } from "../../domain/order/order.entity";
import type { OrderNotFoundError as OrderNotFoundErrorType } from "../../domain/order/order.errors";
import type { OrderId, ShippingAddress } from "../../domain/order/order.value-objects";
import type { ProductNotFoundError as PNFError } from "../../domain/product/product.errors";
import type { ProductOutOfStockError as POSError } from "../../domain/product/product.errors";
import { makeProductId } from "../../domain/product/product.value-objects";
import type { ProductSize } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { firebaseQuery } from "../../shared/abort/abort-context";

type ReserveTxState = {
  receivedRealData: boolean;
  domainError: PNFError | POSError | null;
};

function resolveProductFromTx(
  current: FirebaseProductRecord | null,
  itemId: string,
  preReads: Map<string, FirebaseProductRecord>,
  state: ReserveTxState
): FirebaseProductRecord | null {
  if (current !== null) {
    state.receivedRealData = true;
    return current;
  }
  if (state.receivedRealData) return null;
  return preReads.get(itemId) ?? null;
}

function makeReserveStockTx(
  item: StockReservationItem,
  preReads: Map<string, FirebaseProductRecord>,
  state: ReserveTxState
) {
  return (current: FirebaseProductRecord | null): FirebaseProductRecord | undefined => {
    const product = resolveProductFromTx(current, item.id.value, preReads, state);
    if (product === null) {
      state.domainError = ProductNotFoundError(item.id.value);
      return undefined;
    }
    const currentQty = product.stock[item.size] ?? 0;
    if (currentQty < item.quantity) {
      state.domainError = ProductOutOfStockError(
        item.id.value,
        item.size,
        item.quantity,
        currentQty
      );
      return undefined;
    }
    return { ...product, stock: { ...product.stock, [item.size]: currentQty - item.quantity } };
  };
}

function fromRecord(record: FirebaseOrderRecord): Order {
  const lineEntries = Object.values(record.items).map((item) => ({
    productId: makeProductId(item.productId),
    productName: item.productName,
    unitPrice: {
      __brand: "ProductPrice" as const,
      amount: item.unitPriceCents / 100,
      currency: record.currency as Order["lines"][number]["unitPrice"]["currency"],
    },
    size: item.size as ProductSize,
    quantity: item.quantity,
  }));
  const lines = isNonEmpty(lineEntries)
    ? (lineEntries as unknown as NonEmptyArray<(typeof lineEntries)[number]>)
    : (lineEntries as unknown as NonEmptyArray<(typeof lineEntries)[number]>);
  return {
    id: { __brand: "OrderId" as const, value: record.id } as OrderId,
    userId: { __brand: "UserId" as const, value: record.userId } as UserId,
    cartId: record.cartId,
    lines,
    status: record.status as Order["status"],
    shippingAddress: record.shippingAddress as unknown as ShippingAddress,
    totalAmountInCents: record.totalCents,
    shippingCents: record.shippingCents,
    discountCents: record.discountCents,
    currency: record.currency,
    placedAt: Temporal.Instant.from(record.placedAt),
    updatedAt: Temporal.Instant.from(record.updatedAt),
    shippedAt: record.shippedAt ? Some(Temporal.Instant.from(record.shippedAt)) : None(),
    trackingNumber: record.trackingNumber ? Some(record.trackingNumber) : None(),
  };
}

function toRecord(order: Order): FirebaseOrderRecord {
  const items: FirebaseOrderRecord["items"] = {};
  for (const line of order.lines) {
    const key = `${line.productId.value}_${line.size}`;
    items[key] = {
      productId: line.productId.value,
      productName: line.productName,
      size: line.size,
      quantity: line.quantity,
      unitPriceCents: Math.round(line.unitPrice.amount * 100),
    };
  }
  return {
    id: order.id.value,
    userId: order.userId.value,
    cartId: order.cartId,
    status: order.status as FirebaseOrderRecord["status"],
    totalCents: order.totalAmountInCents,
    shippingCents: order.shippingCents,
    discountCents: order.discountCents,
    currency: order.currency,
    items,
    shippingAddress: order.shippingAddress as unknown as FirebaseOrderRecord["shippingAddress"],
    voucherCode: null,
    placedAt: order.placedAt.toString(),
    updatedAt: Temporal.Now.instant().toString(),
    confirmedAt: order.status === "confirmed" ? Temporal.Now.instant().toString() : null,
    shippedAt: order.shippedAt._tag === "Some" ? order.shippedAt.value.toString() : null,
    trackingNumber: order.trackingNumber._tag === "Some" ? order.trackingNumber.value : null,
    cancelledAt: order.status === "cancelled" ? Temporal.Now.instant().toString() : null,
    paymentId: null,
  };
}

export class FirebaseOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: Database) {}

  async findById(id: OrderId): Promise<Result<Order, OrderNotFoundErrorType | RepositoryError>> {
    try {
      const snap = await firebaseQuery(this.db.ref(`orders/${id.value}`).once("value"));
      if (!snap.exists()) {
        return { _tag: "Err", error: OrderNotFoundError(id.value) };
      }
      return { _tag: "Ok", value: fromRecord(snap.val() as FirebaseOrderRecord) };
    } catch (cause) {
      return { _tag: "Err", error: makeRepositoryError(`Failed to find order ${id.value}`, cause) };
    }
  }

  async findByUserId(
    userId: UserId,
    pagination: PaginationInput
  ): Promise<Result<PaginatedResult<OrderSummary>, RepositoryError>> {
    try {
      const snap = await firebaseQuery(
        this.db.ref("orders").orderByChild("userId").equalTo(userId.value).once("value")
      );
      const orders: Order[] = [];
      snap.forEach((child) => {
        orders.push(fromRecord(child.val() as FirebaseOrderRecord));
      });
      orders.sort((a, b) => Temporal.Instant.compare(b.placedAt, a.placedAt));
      const total = orders.length;
      const offset = (pagination.page - 1) * pagination.perPage;
      const pageItems = orders.slice(offset, offset + pagination.perPage).map(toOrderSummary);
      return {
        _tag: "Ok",
        value: {
          items: pageItems,
          total,
          page: pagination.page,
          perPage: pagination.perPage,
        },
      };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to find orders for user ${userId.value}`, cause),
      };
    }
  }

  async save(order: Order): Promise<Result<Order, RepositoryError>> {
    try {
      await this.db.ref(`orders/${order.id.value}`).set(toRecord(order));
      return { _tag: "Ok", value: order };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(`Failed to save order ${order.id.value}`, cause),
      };
    }
  }

  async atomicReserveAndSave(
    order: Order,
    stockItems: readonly StockReservationItem[]
  ): Promise<Result<Order, PNFError | POSError | RepositoryError>> {
    try {
      const existingSnap = await this.db
        .ref("orders")
        .orderByChild("cartId")
        .equalTo(order.cartId)
        .once("value");
      let existingOrder: Order | undefined;
      existingSnap.forEach((child) => {
        const rec = child.val() as FirebaseOrderRecord;
        if (rec.userId === order.userId.value) {
          existingOrder = fromRecord(rec);
        }
      });
      if (existingOrder !== undefined) {
        return { _tag: "Ok", value: existingOrder };
      }

      const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
      const preReads = new Map<string, FirebaseProductRecord>();
      for (const item of stockItems) {
        const preSnap = await this.db.ref(`product_current/${item.id.value}`).once("value");
        if (!preSnap.exists()) {
          return { _tag: "Err", error: ProductNotFoundError(item.id.value) };
        }
        preReads.set(item.id.value, preSnap.val() as FirebaseProductRecord);
      }

      const reserved: Array<{ id: string; size: string; qty: number }> = [];
      for (const item of stockItems) {
        await yieldToEventLoop();
        const state: ReserveTxState = { receivedRealData: false, domainError: null };
        await this.db
          .ref(`product_current/${item.id.value}`)
          .transaction(makeReserveStockTx(item, preReads, state));
        if (state.domainError !== null) {
          await Promise.allSettled(
            reserved.map((r) =>
              this.db
                .ref(`product_current/${r.id}`)
                .transaction((current: FirebaseProductRecord | null) => {
                  if (current === null) return current;
                  return {
                    ...current,
                    stock: { ...current.stock, [r.size]: (current.stock[r.size] ?? 0) + r.qty },
                  };
                })
            )
          );
          return { _tag: "Err", error: state.domainError };
        }
        reserved.push({ id: item.id.value, size: item.size, qty: item.quantity });
      }

      try {
        await this.db.ref(`orders/${order.id.value}`).set(toRecord(order));
      } catch (saveCause) {
        await Promise.allSettled(
          reserved.map((r) =>
            this.db
              .ref(`product_current/${r.id}`)
              .transaction((current: FirebaseProductRecord | null) => {
                if (current === null) return current;
                return {
                  ...current,
                  stock: { ...current.stock, [r.size]: (current.stock[r.size] ?? 0) + r.qty },
                };
              })
          )
        );
        return {
          _tag: "Err",
          error: makeRepositoryError(
            `Failed to save order ${order.id.value} — stock rolled back`,
            saveCause
          ),
        };
      }

      return { _tag: "Ok", value: order };
    } catch (cause) {
      return {
        _tag: "Err",
        error: makeRepositoryError(
          `Failed to atomically reserve and save order ${order.id.value}`,
          cause
        ),
      };
    }
  }
}
