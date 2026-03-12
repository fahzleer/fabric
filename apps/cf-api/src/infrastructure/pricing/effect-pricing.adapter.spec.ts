import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";

const mockFetch = mock(async (..._args: unknown[]): Promise<Response> => {
  return new Response(
    JSON.stringify({
      ok: true,
      value: {
        subtotalCents: 100,
        discountCents: 0,
        shippingCents: 0,
        totalCents: 100,
        currency: "THB",
        lines: [],
      },
    }),
    { status: 200 }
  );
});

(globalThis as Record<string, unknown>).fetch = mockFetch;

import { calculateCheckoutEffect } from "./effect-pricing.adapter";

interface CheckoutLineItem {
  productId: { value: string };
  productName: string;
  unitPrice: { cents: number; currency: string };
  size: string;
  quantity: { value: number };
}

const ITEMS: CheckoutLineItem[] = [
  {
    productId: { value: "prod-001" },
    productName: "T-Shirt",
    unitPrice: { cents: 10000, currency: "THB" as const },
    size: "M" as const,
    quantity: { value: 1 },
  },
];

const SHIPPING = { country: "TH", province: "BKK" };

const SUCCESS_BODY = {
  ok: true,
  value: {
    subtotalCents: 10000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 10000,
    currency: "THB",
    lines: [],
  },
};

const SERVICE_ERR_BODY = {
  ok: false,
  error: { tag: "ServiceError", message: "pricing down" },
};

describe("calculateCheckoutEffect — Effect.retry wrapper", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  test("success on first try → Ok(CheckoutCalculation)", async () => {
    mockFetch.mockImplementation(
      async () => new Response(JSON.stringify(SUCCESS_BODY), { status: 200 })
    );

    const effect = calculateCheckoutEffect(
      ITEMS as unknown as Parameters<typeof calculateCheckoutEffect>[0],
      undefined,
      SHIPPING,
      "THB",
      "http://localhost:8082"
    );

    const result = await Effect.runPromise(effect);
    expect(result._tag).toBe("Ok");
    if (result._tag === "Ok") {
      expect(result.value.totalCents).toBe(10000);
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("transient failure then success → retries and returns Ok", async () => {
    let calls = 0;
    mockFetch.mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("ECONNREFUSED");
      return new Response(JSON.stringify(SUCCESS_BODY), { status: 200 });
    });

    const effect = calculateCheckoutEffect(
      ITEMS as unknown as Parameters<typeof calculateCheckoutEffect>[0],
      undefined,
      SHIPPING,
      "THB",
      "http://localhost:8082"
    );

    const result = await Effect.runPromise(effect);
    expect(result._tag).toBe("Ok");
    expect(calls).toBe(3);
  });

  test("all 3 attempts fail → Err(ServiceUnavailable)", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });

    const effect = calculateCheckoutEffect(
      ITEMS as unknown as Parameters<typeof calculateCheckoutEffect>[0],
      undefined,
      SHIPPING,
      "THB",
      "http://localhost:8082"
    );

    const result = await Effect.runPromise(effect);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ServiceUnavailable");
    }
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test("pricing service returns error body (4xx) → Err propagated, no retry", async () => {
    mockFetch.mockImplementation(
      async () => new Response(JSON.stringify(SERVICE_ERR_BODY), { status: 422 })
    );

    const effect = calculateCheckoutEffect(
      ITEMS as unknown as Parameters<typeof calculateCheckoutEffect>[0],
      undefined,
      SHIPPING,
      "THB",
      "http://localhost:8082"
    );

    const result = await Effect.runPromise(effect);
    expect(result._tag).toBe("Err");
    if (result._tag === "Err") {
      expect(result.error._tag).toBe("ServiceError");
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
