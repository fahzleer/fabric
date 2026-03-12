import { describe, expect, it, mock } from "bun:test";
import { PromptPayAdapter } from "./promptpay.adapter";

const makeAdapter = () => new PromptPayAdapter("skey_test_abc");

function stubFetchSequence(responses: Array<{ ok: boolean; body: unknown }>): void {
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

describe("PromptPayAdapter.createCharge()", () => {
  it("returns charge data on success", async () => {
    stubFetchSequence([
      {
        ok: true,
        body: { object: "source", id: "src_test_001" },
      },
      {
        ok: true,
        body: {
          object: "charge",
          id: "chrg_test_pp_001",
          status: "pending",
          source: {
            scannable_code: {
              image: { download_uri: "https://example.com/qr.png" },
            },
          },
        },
      },
    ]);

    const adapter = makeAdapter();
    const result = await adapter.createCharge("order-1", 50000, "THB");

    expect(result).not.toBeNull();
    expect(result?.chargeId).toBe("chrg_test_pp_001");
    expect(result?.qrImageUrl).toBe("https://example.com/qr.png");
    expect(result?.expiresAt).toBeTruthy();
  });

  it("returns null when source creation fails", async () => {
    stubFetchSequence([
      {
        ok: false,
        body: { object: "error", message: "Invalid request" },
      },
    ]);

    const adapter = makeAdapter();
    const result = await adapter.createCharge("order-2", 100, "THB");

    expect(result).toBeNull();
  });

  it("returns null when charge creation fails", async () => {
    stubFetchSequence([
      { ok: true, body: { object: "source", id: "src_test_002" } },
      { ok: false, body: { object: "error", message: "Amount too low" } },
    ]);

    const adapter = makeAdapter();
    const result = await adapter.createCharge("order-3", 1, "THB");

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    global.fetch = mock(async () => {
      throw new Error("Network down");
    }) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.createCharge("order-4", 30000, "THB");

    expect(result).toBeNull();
  });

  it("registers the chargeId → orderId mapping after creation", async () => {
    stubFetchSequence([
      { ok: true, body: { object: "source", id: "src_test_003" } },
      {
        ok: true,
        body: {
          object: "charge",
          id: "chrg_test_pp_003",
          status: "pending",
          source: { scannable_code: { image: { download_uri: "https://qr.example.com" } } },
        },
      },
    ]);

    const adapter = makeAdapter();
    await adapter.createCharge("order-5", 10000, "THB");

    const found = adapter.lookupOrderId("chrg_test_pp_003");
    expect(found).toBe("order-5");
  });
});

describe("PromptPayAdapter.getStatus()", () => {
  it('returns "successful" for a paid charge', async () => {
    global.fetch = mock(
      async () =>
        ({
          ok: true,
          json: async () => ({
            object: "charge",
            id: "chrg_001",
            status: "successful",
            paid_at: "2026-01-01T00:00:00Z",
          }),
        }) as Response
    ) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_001");

    expect(result.status).toBe("successful");
    expect(result.paidAt).toBe("2026-01-01T00:00:00Z");
  });

  it('returns "pending" for a pending charge', async () => {
    global.fetch = mock(
      async () =>
        ({
          ok: true,
          json: async () => ({ object: "charge", id: "chrg_002", status: "pending" }),
        }) as Response
    ) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_002");

    expect(result.status).toBe("pending");
    expect(result.paidAt).toBeUndefined();
  });

  it('returns "failed" for Omise status "reversed"', async () => {
    global.fetch = mock(
      async () =>
        ({
          ok: true,
          json: async () => ({ object: "charge", id: "chrg_003", status: "reversed" }),
        }) as Response
    ) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_003");

    expect(result.status).toBe("failed");
  });

  it('returns "expired" for Omise status "expired"', async () => {
    global.fetch = mock(
      async () =>
        ({
          ok: true,
          json: async () => ({ object: "charge", id: "chrg_004", status: "expired" }),
        }) as Response
    ) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_004");

    expect(result.status).toBe("expired");
  });

  it('returns "failed" on Omise API error response', async () => {
    global.fetch = mock(
      async () =>
        ({
          ok: false,
          json: async () => ({ object: "error", message: "Not found" }),
        }) as Response
    ) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_999");

    expect(result.status).toBe("failed");
  });

  it('returns "failed" on network error', async () => {
    global.fetch = mock(async () => {
      throw new Error("Timeout");
    }) as unknown as typeof fetch;

    const adapter = makeAdapter();
    const result = await adapter.getStatus("chrg_timeout");

    expect(result.status).toBe("failed");
  });
});

describe("PromptPayAdapter.lookupOrderId()", () => {
  it("returns undefined for an unknown chargeId", () => {
    const adapter = makeAdapter();
    expect(adapter.lookupOrderId("chrg_unknown")).toBeUndefined();
  });

  it("returns orderId after registerCharge()", () => {
    const adapter = makeAdapter();
    adapter.registerCharge("chrg_manual_001", "order-manual-1");

    expect(adapter.lookupOrderId("chrg_manual_001")).toBe("order-manual-1");
  });
});
