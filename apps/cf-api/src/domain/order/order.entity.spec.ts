import { describe, expect, it } from "bun:test";
import { None, Some } from "@fabric/types";
import { makeOrderId, makeProductId, makeUserId } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { Order, OrderLine } from "./order.entity";
import {
  calculateOrderTotal,
  getOrderLineTotal,
  isOrderShipped,
  markOrderAsShipped,
  toOrderSummary,
  transitionOrderStatus,
} from "./order.entity";

const makeLine = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  productId: makeProductId("prod-1"),
  productName: "Test Shirt",
  unitPrice: { __brand: "ProductPrice", displayAmount: 499, currency: "THB" },
  size: "M",
  quantity: 2,
  ...overrides,
});

const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: makeOrderId("order-1"),
  userId: makeUserId("user-1"),
  cartId: "cart-1",
  lines: [makeLine()],
  status: "pending",
  shippingAddress: {
    recipientName: "Alice",
    street: "123 Main St",
    district: "District",
    city: "Bangkok",
    province: "Bangkok",
    postalCode: "10100",
    country: "TH",
    phoneNumber: "0812345678",
  },
  totalAmountInCents: 99800,
  shippingCents: 0,
  discountCents: 0,
  currency: "THB",
  placedAt: Temporal.Now.instant(),
  updatedAt: Temporal.Now.instant(),
  shippedAt: None(),
  trackingNumber: None(),
  ...overrides,
});

describe("getOrderLineTotal", () => {
  it("multiplies unitPrice.displayAmount by quantity", () => {
    const line = makeLine({ quantity: 3 });
    expect(getOrderLineTotal(line)).toBe(1497);
  });

  it("returns unit price for quantity=1", () => {
    const line = makeLine({ quantity: 1 });
    expect(getOrderLineTotal(line)).toBe(499);
  });
});

describe("calculateOrderTotal", () => {
  it("sums all line totals", () => {
    const lines: OrderLine[] = [
      makeLine({ quantity: 2 }),
      makeLine({
        unitPrice: { __brand: "ProductPrice", displayAmount: 100, currency: "THB" },
        quantity: 3,
      }),
    ];
    expect(calculateOrderTotal(lines)).toBe(1298);
  });

  it("returns 0 for empty lines", () => {
    expect(calculateOrderTotal([])).toBe(0);
  });
});

describe("isOrderShipped", () => {
  it("returns false when shippedAt is None", () => {
    const order = makeOrder({ shippedAt: None() });
    expect(isOrderShipped(order)).toBe(false);
  });

  it("returns true when shippedAt is Some", () => {
    const order = makeOrder({ shippedAt: Some(Temporal.Now.instant()) });
    expect(isOrderShipped(order)).toBe(true);
  });
});

describe("transitionOrderStatus", () => {
  it("allows valid transition: pending → confirmed", () => {
    const order = makeOrder({ status: "pending" });
    const result = transitionOrderStatus(order, "confirmed");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("confirmed");
    }
  });

  it("allows pending → cancelled", () => {
    const order = makeOrder({ status: "pending" });
    const result = transitionOrderStatus(order, "cancelled");
    expect(result._tag).toBe("Ok");
  });

  it("follows full valid path: pending → confirmed → processing → shipped → delivered", () => {
    let order = makeOrder({ status: "pending" });

    const steps: Array<Order["status"]> = ["confirmed", "processing", "shipped", "delivered"];
    for (const next of steps) {
      const result = transitionOrderStatus(order, next);
      expect(result._tag).toBe("Ok");
      if (result._tag === "Ok") order = result.value;
    }
    expect(order.status).toBe("delivered");
  });

  it("rejects invalid transition: pending → shipped (skips step)", () => {
    const order = makeOrder({ status: "pending" });
    const result = transitionOrderStatus(order, "shipped");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("InvalidOrderStateTransitionError");
    }
  });

  it("rejects any transition from cancelled (terminal state)", () => {
    const order = makeOrder({ status: "cancelled" });
    const result = transitionOrderStatus(order, "confirmed");
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("OrderAlreadyCancelledError");
    }
  });

  it("rejects any transition from delivered except refunded", () => {
    const order = makeOrder({ status: "delivered" });
    const invalidNext: Array<Order["status"]> = ["confirmed", "processing", "shipped", "cancelled"];
    for (const next of invalidNext) {
      const result = transitionOrderStatus(order, next);
      expect(result._tag).toBe("Err");
    }
  });

  it("updates updatedAt on successful transition", () => {
    const before = Temporal.Now.instant();
    const order = makeOrder({ status: "pending" });
    const result = transitionOrderStatus(order, "confirmed");
    if (result._tag === "Ok") {
      expect(Temporal.Instant.compare(result.value.updatedAt, before)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("markOrderAsShipped", () => {
  it("sets status=shipped, shippedAt=Some, trackingNumber=Some", () => {
    const order = makeOrder({ status: "processing" });
    const result = markOrderAsShipped(order, "TH-TRACK-999");
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.status).toBe("shipped");
      expect(result.value.shippedAt._tag).toBe("Some");
      expect(result.value.trackingNumber._tag).toBe("Some");
      if (result.value.trackingNumber._tag === "Some") {
        expect(result.value.trackingNumber.value).toBe("TH-TRACK-999");
      }
    }
  });

  it("rejects if order is not in processing status", () => {
    const statuses: Array<Order["status"]> = [
      "pending",
      "confirmed",
      "shipped",
      "delivered",
      "cancelled",
    ];
    for (const status of statuses) {
      const order = makeOrder({ status });
      const result = markOrderAsShipped(order, "TRACK-001");
      expect(result._tag).toBe("Err");
      if (result._tag === "Err") {
        expect(result.error._tag).toBe("InvalidOrderStateTransitionError");
      }
    }
  });
});

describe("toOrderSummary", () => {
  it("sums item quantities across all lines", () => {
    const order = makeOrder({
      lines: [makeLine({ quantity: 2 }), makeLine({ quantity: 3 })],
    });
    const summary = toOrderSummary(order);
    expect(summary.itemCount).toBe(5);
  });

  it("copies basic fields correctly", () => {
    const order = makeOrder();
    const summary = toOrderSummary(order);
    expect(summary.id).toEqual(order.id);
    expect(summary.status).toBe("pending");
    expect(summary.totalAmountInCents).toBe(99800);
    expect(summary.currency).toBe("THB");
  });
});
