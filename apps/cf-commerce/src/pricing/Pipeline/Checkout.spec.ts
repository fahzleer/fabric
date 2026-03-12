import { describe, expect, test } from "bun:test";
import { Either } from "effect";
import { type CheckoutRequest, checkoutFlow } from "./Checkout.ts";

const ITEM = {
  productId: "prod-001",
  productName: "Test T-Shirt",
  priceCents: 50000,
  quantity: 2,
  size: "M",
};

const BASE_REQ: CheckoutRequest = {
  items: [ITEM],
  voucher: Either.left("NoVoucher" as const),
  shippingAddress: { country: "TH", province: "Bangkok" },
  currency: "THB",
};

const now = Math.floor(Date.now() / 1000);
const VALID_VOUCHER_10PCT = {
  code: "SAVE10",
  discountType: { _tag: "PercentOff" as const, pct: 10 },
  minOrderCents: 0,
  maxUsages: 100,
  currentUsages: 0,
  validUntilEpoch: now + 86400,
  currentEpoch: now,
};

describe("checkoutFlow — Step 1: validateNotEmpty", () => {
  test("empty items array → Left(EmptyCart)", () => {
    const result = checkoutFlow({ ...BASE_REQ, items: [] });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("EmptyCart");
    }
  });
});

describe("checkoutFlow — Step 2: validateItemPrices", () => {
  test("item with priceCents ≤ 0 → Left(InvalidPrice)", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      items: [{ ...ITEM, priceCents: 0 }],
    });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidPrice");
    }
  });

  test("item with quantity = 0 → Left(ZeroQuantity)", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      items: [{ ...ITEM, quantity: 0 }],
    });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("ZeroQuantity");
    }
  });
});

describe("checkoutFlow — Step 4: applyVoucherIfPresent", () => {
  test('no voucher (Either.left("NoVoucher")) → discountCents = 0', () => {
    const result = checkoutFlow(BASE_REQ);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.discountCents).toBe(0);
    }
  });

  test("valid 10% voucher → discountCents = 10% of subtotal", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      voucher: Either.right(VALID_VOUCHER_10PCT),
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.discountCents).toBe(10000);
    }
  });
});

describe("checkoutFlow — Step 5: addShipping", () => {
  test("unsupported country → Left(UndeliverableAddress)", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      shippingAddress: { country: "ZZ", province: "" },
    });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("UndeliverableAddress");
    }
  });

  test("TH below free-shipping threshold (500 THB) → shippingCents = 4900", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      items: [{ ...ITEM, priceCents: 10000, quantity: 1 }],
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.shippingCents).toBe(4900);
    }
  });

  test("TH above free-shipping threshold (≥500 THB) → shippingCents = 0", () => {
    const result = checkoutFlow({
      ...BASE_REQ,
      items: [{ ...ITEM, priceCents: 100000, quantity: 1 }],
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.shippingCents).toBe(0);
    }
  });
});

describe("checkoutFlow — Step 6: validateCurrency", () => {
  test("unsupported currency → Left(InvalidCurrency)", () => {
    const result = checkoutFlow({ ...BASE_REQ, currency: "JPY" });
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("InvalidCurrency");
    }
  });
});

describe("checkoutFlow — Happy path", () => {
  test("valid TH order, no voucher → Right with correct totals and 7% VAT", () => {
    const result = checkoutFlow(BASE_REQ);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      const r = result.right;
      expect(r.subtotalCents).toBe(100000);
      expect(r.discountCents).toBe(0);
      expect(r.shippingCents).toBe(0);
      expect(r.taxCents).toBe(7000);
      expect(r.totalCents).toBe(107000);
      expect(r.currency).toBe("THB");
      expect(r.lines).toHaveLength(1);
    }
  });

  test("USD order with US shipping — Right with correct USD amounts", () => {
    const result = checkoutFlow({
      items: [{ ...ITEM, priceCents: 5000, quantity: 1 }],
      voucher: Either.left("NoVoucher"),
      shippingAddress: { country: "US", province: "CA" },
      currency: "USD",
    });
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right.shippingCents).toBe(49900);
      expect(result.right.taxCents).toBe(0);
      expect(result.right.totalCents).toBe(54900);
    }
  });
});
