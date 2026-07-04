import { describe, expect, mock, test } from "bun:test";
import type { Email } from "@fabric/types";
import { None } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type { ActivityRepositoryPort } from "../../application/ports/activity.repository.port";
import type { CartRepositoryPort } from "../../application/ports/cart.repository.port";
import type { EventPublisherPort } from "../../application/ports/event-publisher.port";
import type { MerchantRepositoryPort } from "../../application/ports/merchant.repository.port";
import type { OrderRepositoryPort } from "../../application/ports/order.repository.port";
import type { PaymentPort } from "../../application/ports/payment.port";
import type { PricingPort } from "../../application/ports/pricing.port";
import type { ProductRepositoryPort } from "../../application/ports/product.repository.port";
import type { VoucherRepositoryPort } from "../../application/ports/voucher.repository.port";
import type { Cart } from "../../domain/cart/cart.entity";
import type { CartId, CartItemQuantity } from "../../domain/cart/cart.value-objects";
import type { CustomerRef, Order } from "../../domain/order/order.entity";
import type { OrderId, OrderStatus, ShippingAddress } from "../../domain/order/order.value-objects";
import type { ProductId, ProductPrice } from "../../domain/product/product.value-objects";
import type { UserId } from "../../domain/user/user.value-objects";
import { OrderService } from "./order.service";

const now = Temporal.Now.instant();

const USER_ID = { __brand: "UserId" as const, value: "user-001" } as UserId;
const GUEST_EMAIL = { __brand: "Email" as const, value: "guest@example.com" } as Email;
const SHIPPING: ShippingAddress = {
  recipientName: "Test User",
  street: "1 Test Street",
  district: "Bang Rak",
  city: "Bangkok",
  province: "Bangkok",
  postalCode: "10100",
  country: "TH",
  phoneNumber: "0812345678",
};

function makeCartItem(productId: string, priceCents: number, qty = 1) {
  return {
    productId: { __brand: "ProductId" as const, value: productId } as ProductId,
    productName: "Test Item",
    unitPrice: {
      __brand: "ProductPrice" as const,
      amount: priceCents / 100,
      currency: "THB",
    } as unknown as ProductPrice,
    size: "M" as const,
    quantity: {
      __brand: "CartItemQuantity" as const,
      value: qty,
    } as unknown as CartItemQuantity,
  };
}

function makeCart(items: ReturnType<typeof makeCartItem>[]): Cart {
  return {
    id: { __brand: "CartId" as const, value: "cart-001" } as CartId,
    userId: USER_ID as unknown as Cart["userId"],
    items: items as Cart["items"],
    createdAt: now,
    updatedAt: now,
  };
}

function makeOrder(status: OrderStatus = "pending", customerRef: CustomerRef = USER_ID): Order {
  return {
    id: { __brand: "OrderId" as const, value: "order-001" } as OrderId,
    customerRef,
    cartId: "cart-001",
    lines: [] as unknown as Order["lines"],
    status,
    shippingAddress: SHIPPING,
    totalAmountInCents: 100000,
    shippingCents: 4900,
    discountCents: 0,
    currency: "THB",
    placedAt: now,
    updatedAt: now,
    shippedAt: None(),
    trackingNumber: None(),
  };
}

function makePorts(
  overrides: {
    cartItems?: ReturnType<typeof makeCartItem>[];
    cartFindErr?: boolean;
    productPriceCents?: number;
    productFindErr?: boolean;
    pricingErr?: boolean;
    atomicErr?: string;
    voucherNotFound?: boolean;
  } = {}
) {
  const items = overrides.cartItems ?? [makeCartItem("prod-001", 50000)];
  const cart = makeCart(items);

  const cartRepo = {
    findById: mock(async () =>
      overrides.cartFindErr
        ? { _tag: "Err" as const, error: { _tag: "CartNotFoundError", message: "not found" } }
        : { _tag: "Ok" as const, value: cart }
    ),
    save: mock(async () => ({ _tag: "Ok" as const, value: cart })),
  } as unknown as CartRepositoryPort;

  const productRepo = {
    findById: mock(async () =>
      overrides.productFindErr
        ? { _tag: "Err" as const, error: { _tag: "ProductNotFoundError", message: "not found" } }
        : {
            _tag: "Ok" as const,
            value: {
              id: { value: "prod-001" },
              name: { value: "Test Item" },
              price: { amount: (overrides.productPriceCents ?? 50000) / 100, currency: "THB" },
            },
          }
    ),
  } as unknown as ProductRepositoryPort;

  const pricing = {
    calculateCheckout: mock(async () =>
      overrides.pricingErr
        ? { _tag: "Err" as const, error: { _tag: "ServiceUnavailable", message: "pricing down" } }
        : {
            _tag: "Ok" as const,
            value: {
              subtotalCents: 50000,
              discountCents: 0,
              shippingCents: 4900,
              totalCents: 54900,
              currency: "THB",
              lines: [],
            },
          }
    ),
  } as unknown as PricingPort;

  const voucherRepo = {
    findByCode: mock(async () =>
      overrides.voucherNotFound
        ? { _tag: "Err" as const, error: { _tag: "VoucherNotFound", message: "not found" } }
        : {
            _tag: "Ok" as const,
            value: {
              code: "SAVE10",
              discountType: { _tag: "PercentOff", pct: 10 },
              maxUsages: 100,
              currentUsages: 0,
              minOrderCents: 0,
              validUntilEpoch: Math.floor(Date.now() / 1000) + 86400,
              currentEpoch: Math.floor(Date.now() / 1000),
            },
          }
    ),
  } as unknown as VoucherRepositoryPort;

  const orderRepo = {
    findById: mock(async () => ({ _tag: "Ok" as const, value: makeOrder() })),
    save: mock(async () => ({ _tag: "Ok" as const, value: makeOrder() })),
    atomicReserveAndSave: mock(async (order: Order) =>
      overrides.atomicErr
        ? { _tag: "Err" as const, error: { _tag: overrides.atomicErr, message: "atomic failed" } }
        : { _tag: "Ok" as const, value: order }
    ),
    findByUserId: mock(async () => ({
      _tag: "Ok" as const,
      value: { items: [], total: 0, page: 1, perPage: 10 },
    })),
  } as unknown as OrderRepositoryPort;

  const payment = { initiatePayment: mock(async () => undefined) } as unknown as PaymentPort;
  const eventPublisher = { publish: mock(async () => undefined) } as unknown as EventPublisherPort;
  const activityRepo = {
    track: mock(async () => ({ _tag: "Ok" as const, value: undefined })),
  } as unknown as ActivityRepositoryPort;
  const merchantRepo = {
    findByUserId: mock(async () => ({
      _tag: "Err" as const,
      error: { _tag: "RepositoryError", message: "not needed in tests" },
    })),
  } as unknown as MerchantRepositoryPort;

  return {
    cartRepo,
    productRepo,
    pricing,
    voucherRepo,
    orderRepo,
    payment,
    eventPublisher,
    activityRepo,
    merchantRepo,
    cart,
  };
}

function makeService(ports: ReturnType<typeof makePorts>) {
  return new OrderService(
    ports.orderRepo,
    ports.cartRepo,
    ports.payment,
    ports.productRepo,
    ports.pricing,
    ports.voucherRepo,
    ports.eventPublisher,
    ports.activityRepo,
    ports.merchantRepo
  );
}

describe("OrderService.placeOrder — critical paths", () => {
  test("1. price mismatch → throws PriceChangedError (presentDomainError)", async () => {
    const ports = makePorts({
      cartItems: [makeCartItem("prod-001", 50000)],
      productPriceCents: 60000,
    });
    const svc = makeService(ports);

    await expect(svc.placeOrder(USER_ID, "cart-001", SHIPPING, "tok_test")).rejects.toThrow();
  });

  test("2. pricing service unavailable → subtotal fallback (shippingCents=0)", async () => {
    const ports = makePorts({ pricingErr: true });
    const svc = makeService(ports);

    const order = await svc.placeOrder(USER_ID, "cart-001", SHIPPING, "tok_test");

    expect(order.shippingCents).toBe(0);
    expect(order.discountCents).toBe(0);
    expect(order.totalAmountInCents).toBe(50000);
  });

  test("3. atomicReserveAndSave out-of-stock → throws ProductOutOfStockError", async () => {
    const ports = makePorts({ atomicErr: "ProductOutOfStockError" });
    const svc = makeService(ports);

    await expect(svc.placeOrder(USER_ID, "cart-001", SHIPPING, "tok_test")).rejects.toThrow();
  });

  test("4. happy path: card payment → Ok(order) with payment initiated", async () => {
    const ports = makePorts({});
    const svc = makeService(ports);

    const order = await svc.placeOrder(USER_ID, "cart-001", SHIPPING, "tok_visa", "card");

    expect(order.status).toBe("pending");
    expect(ports.payment.initiatePayment).toHaveBeenCalledTimes(1);
    expect(ports.eventPublisher.publish).toHaveBeenCalledTimes(1);
  });

  test("5. crypto payment → confirmed immediately, no payment.initiatePayment call", async () => {
    const ports = makePorts({});
    (ports.orderRepo.atomicReserveAndSave as ReturnType<typeof mock>).mockImplementation(
      async () => ({
        _tag: "Ok",
        value: makeOrder("confirmed"),
      })
    );
    const svc = makeService(ports);

    const _order = await svc.placeOrder(USER_ID, "cart-001", SHIPPING, undefined, "crypto");

    expect(ports.payment.initiatePayment).not.toHaveBeenCalled();
    expect(ports.eventPublisher.publish).toHaveBeenCalledTimes(1);
  });
});

describe("OrderService.previewCheckout — graceful degradation", () => {
  test("6. empty cart → throws EmptyOrderError", async () => {
    const ports = makePorts({ cartItems: [] });
    const svc = makeService(ports);

    await expect(svc.previewCheckout(USER_ID, "cart-001", "TH", "Bangkok")).rejects.toThrow();
  });

  test("7. pricing service down → subtotal-only fallback, taxCents=0", async () => {
    const ports = makePorts({ pricingErr: true });
    const svc = makeService(ports);

    const preview = await svc.previewCheckout(USER_ID, "cart-001", "TH", "Bangkok");

    expect(preview.shippingCents).toBe(0);
    expect(preview.discountCents).toBe(0);
    expect(preview.voucherError).toBeNull();
  });

  test("8. voucher not found → voucherError set, calculates without voucher (1 pricing call)", async () => {
    const ports = makePorts({ voucherNotFound: true });
    const svc = makeService(ports);

    const preview = await svc.previewCheckout(USER_ID, "cart-001", "TH", "Bangkok", "BAD_CODE");

    expect(preview.voucherError).toContain("BAD_CODE");
    expect(ports.pricing.calculateCheckout).toHaveBeenCalledTimes(1);
  });
});

describe("OrderService.confirmOrder / failOrder", () => {
  test("9. confirmOrder: pending → confirmed, order saved", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending"),
    }));
    const svc = makeService(ports);

    await svc.confirmOrder("order-001");

    expect(ports.orderRepo.save).toHaveBeenCalledTimes(1);
  });

  test("9b. confirmOrder: already confirmed → idempotent, no double-save", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("confirmed"),
    }));
    const svc = makeService(ports);

    await svc.confirmOrder("order-001");

    expect(ports.orderRepo.save).not.toHaveBeenCalled();
  });

  test("10. failOrder: pending → cancelled, order saved", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending"),
    }));
    const svc = makeService(ports);

    await svc.failOrder("order-001", "Payment declined");

    expect(ports.orderRepo.save).toHaveBeenCalledTimes(1);
  });
});

describe("OrderService.placeOrder — guest checkout", () => {
  test("11. guest happy path: inline items resolve via productRepo, no cartRepo lookup", async () => {
    const ports = makePorts({});
    const svc = makeService(ports);

    const order = await svc.placeOrder(
      GUEST_EMAIL,
      "local",
      SHIPPING,
      "tok_test",
      "card",
      undefined,
      undefined,
      [{ productId: "prod-001", size: "M", quantity: 1 }]
    );

    expect(order.customerRef).toEqual(GUEST_EMAIL);
    expect((ports.cartRepo.findById as ReturnType<typeof mock>).mock.calls.length).toBe(0);
    expect(ports.payment.initiatePayment).toHaveBeenCalledTimes(1);
    // no server-side cart to clear for a guest
    expect((ports.cartRepo.save as ReturnType<typeof mock>).mock.calls.length).toBe(0);
  });

  test("12. guest with no inline items → EmptyOrderError", async () => {
    const ports = makePorts({});
    const svc = makeService(ports);

    await expect(
      svc.placeOrder(GUEST_EMAIL, "local", SHIPPING, "tok_test", "card")
    ).rejects.toThrow();
  });

  test("13. guest item references unknown product → propagates ProductNotFoundError", async () => {
    const ports = makePorts({ productFindErr: true });
    const svc = makeService(ports);

    await expect(
      svc.placeOrder(GUEST_EMAIL, "local", SHIPPING, "tok_test", "card", undefined, undefined, [
        { productId: "prod-ghost", size: "M", quantity: 1 },
      ])
    ).rejects.toThrow();
  });
});

describe("OrderService.getOrder — ownership by CustomerRef", () => {
  test("14. authenticated user can read their own order", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending", USER_ID),
    }));
    const svc = makeService(ports);

    const order = await svc.getOrder(USER_ID, "order-001");

    expect(order.customerRef).toEqual(USER_ID);
  });

  test("15. guest can read their own order by matching email", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending", GUEST_EMAIL),
    }));
    const svc = makeService(ports);

    const order = await svc.getOrder(GUEST_EMAIL, "order-001");

    expect(order.customerRef).toEqual(GUEST_EMAIL);
  });

  test("16. mismatched guest email → OrderNotFoundError", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending", GUEST_EMAIL),
    }));
    const svc = makeService(ports);
    const otherGuest = { __brand: "Email" as const, value: "someone-else@example.com" } as Email;

    await expect(svc.getOrder(otherGuest, "order-001")).rejects.toThrow();
  });

  test("17. authenticated user cannot read a guest order", async () => {
    const ports = makePorts({});
    (ports.orderRepo.findById as ReturnType<typeof mock>).mockImplementation(async () => ({
      _tag: "Ok",
      value: makeOrder("pending", GUEST_EMAIL),
    }));
    const svc = makeService(ports);

    await expect(svc.getOrder(USER_ID, "order-001")).rejects.toThrow();
  });
});
