import { describe, expect, test } from "bun:test";
import { Either } from "effect";
import { type Voucher, applyVoucher } from "./Voucher.ts";

const now = Math.floor(Date.now() / 1000);

function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    code: "TEST10",
    discountType: { _tag: "PercentOff", pct: 10 },
    minOrderCents: 0,
    maxUsages: 100,
    currentUsages: 0,
    validUntilEpoch: now + 86400,
    currentEpoch: now,
    ...overrides,
  };
}

describe("applyVoucher — Step 1: checkExpiry", () => {
  test("expired voucher → Left(VoucherExpired)", () => {
    const voucher = makeVoucher({ validUntilEpoch: now - 1 });
    const result = applyVoucher(voucher)(10000);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("VoucherExpired");
      if (result.left._tag === "VoucherExpired") {
        expect(result.left.code).toBe("TEST10");
      }
    }
  });
});

describe("applyVoucher — Step 2: checkUsageLimit", () => {
  test("fully redeemed voucher → Left(VoucherExhausted)", () => {
    const voucher = makeVoucher({ currentUsages: 100, maxUsages: 100 });
    const result = applyVoucher(voucher)(10000);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("VoucherExhausted");
    }
  });
});

describe("applyVoucher — Step 3: checkMinOrder", () => {
  test("order below minimum → Left(OrderBelowMinimum)", () => {
    const voucher = makeVoucher({ minOrderCents: 50000 });
    const result = applyVoucher(voucher)(40000);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe("OrderBelowMinimum");
      if (result.left._tag === "OrderBelowMinimum") {
        expect(result.left.minCents).toBe(50000);
      }
    }
  });
});

describe("applyVoucher — Step 4: discountStep variants", () => {
  test("PercentOff 10% → discountCents = floor(10% of subtotal)", () => {
    const voucher = makeVoucher({ discountType: { _tag: "PercentOff", pct: 10 } });
    const result = applyVoucher(voucher)(100000);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBe(10000);
    }
  });

  test("FixedOff 5000 on 100000 → discountCents = 5000", () => {
    const voucher = makeVoucher({ discountType: { _tag: "FixedOff", amount: 5000 } });
    const result = applyVoucher(voucher)(100000);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBe(5000);
    }
  });

  test("FixedOff larger than subtotal → capped at subtotal", () => {
    const voucher = makeVoucher({ discountType: { _tag: "FixedOff", amount: 200000 } });
    const result = applyVoucher(voucher)(50000);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBe(50000);
    }
  });

  test("FreeShipping → discountCents = 0 (shipping zeroed at checkout layer)", () => {
    const voucher = makeVoucher({ discountType: { _tag: "FreeShipping" } });
    const result = applyVoucher(voucher)(100000);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBe(0);
    }
  });

  test("BuyXGetY buy=2 get=1 on subtotal=30000 → discount > 0", () => {
    const voucher = makeVoucher({ discountType: { _tag: "BuyXGetY", buy: 2, get: 1 } });
    const result = applyVoucher(voucher)(30000);
    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) {
      expect(result.right).toBeGreaterThan(0);
    }
  });
});
