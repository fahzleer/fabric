import { describe, expect, it, mock } from "bun:test";
import { OmisePaymentGateway } from "./omise-payment-gateway.adapter";

const makeGateway = () => new OmisePaymentGateway("skey_test_abc123");

function stubFetch(responses: Array<{ ok: boolean; body: unknown }>): void {
  let call = 0;
  global.fetch = mock(async () => {
    const r = responses[call++] ?? responses.at(-1) ?? { ok: false, body: {} };
    return {
      ok: r.ok,
      status: r.ok ? 200 : 400,
      json: async () => r.body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe("OmisePaymentGateway.charge()", () => {
  it("returns success=true for a successful charge", async () => {
    stubFetch([
      {
        ok: true,
        body: { object: "charge", id: "chrg_test_001", status: "successful" },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.charge("order-1", 9900, "THB", "tok_test_123");

    expect(result.success).toBe(true);
    expect(result.paymentId).toBe("chrg_test_001");
    expect(result.failureReason).toBeUndefined();
  });

  it('returns success=false when charge status is "failed"', async () => {
    stubFetch([
      {
        ok: true,
        body: {
          object: "charge",
          id: "chrg_test_002",
          status: "failed",
          failure_message: "Insufficient funds",
        },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.charge("order-2", 5000, "THB", "tok_test_456");

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("Insufficient funds");
  });

  it('returns success=false when charge status is "expired"', async () => {
    stubFetch([
      {
        ok: true,
        body: { object: "charge", id: "chrg_test_003", status: "expired" },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.charge("order-3", 1000, "THB", "tok_test_789");

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("expired");
  });

  it("returns success=false when Omise returns an error object", async () => {
    stubFetch([
      {
        ok: false,
        body: { object: "error", message: "Invalid card token" },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.charge("order-4", 2000, "THB", "tok_invalid");

    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("Invalid card token");
  });

  it("returns success=false on network error (fetch throws)", async () => {
    global.fetch = mock(async () => {
      throw new Error("Network unreachable");
    }) as unknown as typeof fetch;

    const gateway = makeGateway();
    const result = await gateway.charge("order-5", 1500, "THB", "tok_test_abc");

    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/Network error/);
  });

  it("sends correct Authorization header (Basic auth)", async () => {
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = mock(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return {
        ok: true,
        json: async () => ({ object: "charge", id: "chrg_test_006", status: "successful" }),
      } as Response;
    }) as unknown as typeof fetch;

    const gateway = new OmisePaymentGateway("my_secret_key");
    await gateway.charge("order-6", 100, "THB", "tok_abc");

    const expected = `Basic ${btoa("my_secret_key:")}`;
    expect(capturedHeaders?.Authorization).toBe(expected);
  });

  it("sends amount in smallest unit (satangs) and lowercased currency", async () => {
    let capturedBody: Record<string, unknown> | undefined;

    global.fetch = mock(async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        json: async () => ({ object: "charge", id: "chrg_007", status: "successful" }),
      } as Response;
    }) as unknown as typeof fetch;

    const gateway = makeGateway();
    await gateway.charge("order-7", 12500, "THB", "tok_test");

    expect(capturedBody?.amount).toBe(12500);
    expect(capturedBody?.currency).toBe("thb");
    expect(capturedBody?.card).toBe("tok_test");
    expect(capturedBody?.capture).toBe(true);
  });
});

describe("OmisePaymentGateway.refund()", () => {
  it("returns success=true for a successful refund", async () => {
    stubFetch([
      {
        ok: true,
        body: { object: "refund", id: "rfnd_test_001", status: "pending" },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.refund("chrg_test_001", 9900);

    expect(result.success).toBe(true);
  });

  it("returns success=false when Omise returns an error object", async () => {
    stubFetch([
      {
        ok: false,
        body: { object: "error", message: "Charge already refunded" },
      },
    ]);

    const gateway = makeGateway();
    const result = await gateway.refund("chrg_test_002", 5000);

    expect(result.success).toBe(false);
  });

  it("returns success=false on network error", async () => {
    global.fetch = mock(async () => {
      throw new Error("Timeout");
    }) as unknown as typeof fetch;

    const gateway = makeGateway();
    const result = await gateway.refund("chrg_test_003", 3000);

    expect(result.success).toBe(false);
  });

  it("calls the correct Omise refund endpoint", async () => {
    let capturedUrl = "";

    global.fetch = mock(async (url: string) => {
      capturedUrl = url as string;
      return {
        ok: true,
        json: async () => ({ object: "refund", id: "rfnd_004" }),
      } as Response;
    }) as unknown as typeof fetch;

    const gateway = makeGateway();
    await gateway.refund("chrg_test_004", 1000);

    expect(capturedUrl).toBe("https://api.omise.co/charges/chrg_test_004/refunds");
  });
});
