import { describe, expect, test } from "bun:test";
import { None } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Database } from "firebase-admin/database";
import type { Order } from "../../domain/order/order.entity";
import type { OrderId } from "../../domain/order/order.value-objects";
import type { ProductId } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { FirebaseOrderRepository } from "./firebase-order.repository";

interface StockReserveItem {
  id: ProductId;
  size: string;
  quantity: number;
}

interface MockProductCurrentRecord {
  stock: Record<string, number>;
  id: string;
  name: string;
  priceInCents: number;
  currency: string;
  category: string;
  status: string;
  ownerId: string;
  rev: number;
}

const now = Temporal.Now.instant();

const ORDER: Order = {
  id: { __brand: "OrderId" as const, value: "order-001" } as OrderId,
  customerRef: { __brand: "UserId" as const, value: "user-001" } as UserId,
  cartId: "cart-001",
  lines: [
    {
      productId: { __brand: "ProductId" as const, value: "prod-001" } as ProductId,
      productName: "Test Shirt",
      unitPrice: {
        __brand: "ProductPrice" as const,
        cents: 50000,
        currency: "THB",
      } as unknown as Order["lines"][number]["unitPrice"],
      size: "M" as const,
      quantity: 1,
    },
    {
      productId: { __brand: "ProductId" as const, value: "prod-002" } as ProductId,
      productName: "Test Hoodie",
      unitPrice: {
        __brand: "ProductPrice" as const,
        cents: 80000,
        currency: "THB",
      } as unknown as Order["lines"][number]["unitPrice"],
      size: "L" as const,
      quantity: 2,
    },
  ] as unknown as Order["lines"],
  status: "pending",
  shippingAddress: {
    recipientName: "Test User",
    street: "1 Test St",
    district: "Bang Rak",
    city: "Bangkok",
    province: "Bangkok",
    postalCode: "10100",
    country: "TH",
    phoneNumber: "0812345678",
  } as Order["shippingAddress"],
  totalAmountInCents: 210000,
  shippingCents: 4900,
  discountCents: 0,
  currency: "THB",
  placedAt: now,
  updatedAt: now,
  shippedAt: None(),
  trackingNumber: None(),
};

const STOCK_ITEMS: StockReserveItem[] = [
  {
    id: { __brand: "ProductId" as const, value: "prod-001" } as ProductId,
    size: "M",
    quantity: 1,
  },
  {
    id: { __brand: "ProductId" as const, value: "prod-002" } as ProductId,
    size: "L",
    quantity: 2,
  },
];

const EXISTING_ORDER_RECORD = {
  id: "order-001",
  userId: "user-001",
  guestEmail: null,
  cartId: "cart-001",
  status: "pending",
  totalCents: 210000,
  shippingCents: 4900,
  discountCents: 0,
  currency: "THB",
  items: {
    "prod-001_M": {
      productId: "prod-001",
      productName: "Test Shirt",
      size: "M",
      quantity: 1,
      unitPriceCents: 50000,
    },
  },
  shippingAddress: {
    street: "1 Test St",
    city: "Bangkok",
    country: "TH",
    province: "Bangkok",
    postalCode: "10100",
  },
  voucherCode: null,
  placedAt: now.toString(),
  updatedAt: now.toString(),
  confirmedAt: null,
  shippedAt: null,
  trackingNumber: null,
  cancelledAt: null,
  paymentId: null,
};

function makeDb(opts: {
  hasExistingOrder?: boolean;
  secondItemOutOfStock?: boolean;
  orderSaveFails?: boolean;
}) {
  const txCallsPerPath: Record<string, number> = {};
  let orderSaveCalls = 0;

  const db = {
    ref(path: string) {
      if (path === "orders") {
        return {
          orderByChild: () => ({
            equalTo: () => ({
              once: async () => ({
                forEach: opts.hasExistingOrder
                  ? (cb: (snap: { val: () => typeof EXISTING_ORDER_RECORD }) => void) =>
                      cb({ val: () => EXISTING_ORDER_RECORD })
                  : () => undefined,
              }),
            }),
          }),
        };
      }

      if (path.startsWith("product_current/")) {
        const productId = path.replace("product_current/", "");
        const baseRecord: MockProductCurrentRecord = {
          stock: { M: 10, L: 10 },
          id: productId,
          name: "T",
          priceInCents: 1000,
          currency: "THB",
          category: "apparel",
          status: "active",
          ownerId: "u1",
          rev: 1,
        };
        return {
          async once(_event: string) {
            return { exists: () => true, val: () => ({ ...baseRecord }) };
          },
          async transaction(
            cb: (current: MockProductCurrentRecord | null) => MockProductCurrentRecord | null
          ) {
            txCallsPerPath[path] = (txCallsPerPath[path] ?? 0) + 1;
            const callCount = txCallsPerPath[path] as number;
            if (
              opts.secondItemOutOfStock &&
              path === "product_current/prod-002" &&
              callCount === 1
            ) {
              cb({ ...baseRecord, stock: { L: 0, M: 10 } });
            } else {
              cb({ ...baseRecord });
            }
            return { committed: true };
          },
        };
      }

      if (path.startsWith("orders/")) {
        return {
          async set(_record: unknown) {
            orderSaveCalls++;
            if (opts.orderSaveFails) throw new Error("Firebase write failed");
          },
        };
      }

      return {};
    },
  } as unknown as Database;

  return { db, txCallsPerPath, getOrderSaveCalls: () => orderSaveCalls };
}

describe("FirebaseOrderRepository.atomicReserveAndSave", () => {
  test("1. success: reserves stock for each item and saves order → Ok(order)", async () => {
    const { db, txCallsPerPath } = makeDb({});
    const repo = new FirebaseOrderRepository(db);

    const result = await repo.atomicReserveAndSave(ORDER, STOCK_ITEMS);

    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.id.value).toBe("order-001");
    }
    expect(txCallsPerPath["product_current/prod-001"]).toBe(1);
    expect(txCallsPerPath["product_current/prod-002"]).toBe(1);
  });

  test("2. idempotency: existing order for same cartId → returns existing, no stock transactions", async () => {
    const { db, txCallsPerPath } = makeDb({ hasExistingOrder: true });
    const repo = new FirebaseOrderRepository(db);

    const result = await repo.atomicReserveAndSave(ORDER, STOCK_ITEMS);

    expect(result._tag).toBe("Ok");
    expect(txCallsPerPath["product_current/prod-001"]).toBeUndefined();
    expect(txCallsPerPath["product_current/prod-002"]).toBeUndefined();
  });

  test("3. out-of-stock on 2nd item: rolls back 1st reservation → Err(ProductOutOfStockError)", async () => {
    const { db, txCallsPerPath } = makeDb({ secondItemOutOfStock: true });
    const repo = new FirebaseOrderRepository(db);

    const result = await repo.atomicReserveAndSave(ORDER, STOCK_ITEMS);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ProductOutOfStockError");
    }
    expect(txCallsPerPath["product_current/prod-001"]).toBe(2);
  });

  test("4. P0: order save throws → ALL reserved stock rolled back → Err(RepositoryError)", async () => {
    const { db, txCallsPerPath } = makeDb({ orderSaveFails: true });
    const repo = new FirebaseOrderRepository(db);

    const result = await repo.atomicReserveAndSave(ORDER, STOCK_ITEMS);

    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("RepositoryError");
    }
    expect(txCallsPerPath["product_current/prod-001"]).toBe(2);
    expect(txCallsPerPath["product_current/prod-002"]).toBe(2);
  });
});
