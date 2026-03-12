import { describe, expect, test } from "bun:test";

const API_PATTERN = new URLPattern({ pathname: "/(api|auth|token)/*" });
const COMMERCE_PATTERN = new URLPattern({
  pathname: "/(checkout|pricing|inventory|voucher|events|sse|payment)/*",
});

describe("worker routing patterns", () => {
  test("API routes match /api/*", () => {
    expect(API_PATTERN.test({ pathname: "/api/health" })).toBe(true);
    expect(API_PATTERN.test({ pathname: "/api/products" })).toBe(true);
  });

  test("API routes match /auth/* and /token/*", () => {
    expect(API_PATTERN.test({ pathname: "/auth/login" })).toBe(true);
    expect(API_PATTERN.test({ pathname: "/token/refresh" })).toBe(true);
  });

  test("Commerce routes match /checkout/* /events/* /payment/*", () => {
    expect(COMMERCE_PATTERN.test({ pathname: "/checkout/start" })).toBe(true);
    expect(COMMERCE_PATTERN.test({ pathname: "/events/stream" })).toBe(true);
    expect(COMMERCE_PATTERN.test({ pathname: "/payment/omise/webhook" })).toBe(true);
  });

  test("Commerce routes match /pricing/* /inventory/* /voucher/* /sse/*", () => {
    expect(COMMERCE_PATTERN.test({ pathname: "/pricing/calculate" })).toBe(true);
    expect(COMMERCE_PATTERN.test({ pathname: "/inventory/check" })).toBe(true);
    expect(COMMERCE_PATTERN.test({ pathname: "/voucher/apply" })).toBe(true);
    expect(COMMERCE_PATTERN.test({ pathname: "/sse/products" })).toBe(true);
  });

  test("Web fallback does not match API or Commerce patterns", () => {
    expect(API_PATTERN.test({ pathname: "/" })).toBe(false);
    expect(COMMERCE_PATTERN.test({ pathname: "/" })).toBe(false);
    expect(API_PATTERN.test({ pathname: "/products" })).toBe(false);
    expect(COMMERCE_PATTERN.test({ pathname: "/products" })).toBe(false);
  });
});
