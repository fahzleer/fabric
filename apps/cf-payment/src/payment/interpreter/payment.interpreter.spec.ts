import { beforeEach, describe, expect, mock, test } from "bun:test";

const mockFetch = mock(
  async (..._args: unknown[]): Promise<Response> => new Response(null, { status: 200 })
);
Object.assign(globalThis, { fetch: mockFetch });

import type { IPaymentGateway } from "../ports/payment-gateway.port";
import { interpretPaymentCommands } from "./payment.interpreter";

const MOCK_GATEWAY = {
  charge: mock(async (_orderId: string, _cents: number, _currency: string, _token: string) => ({
    paymentId: "pay-001",
    success: true,
    failureReason: undefined,
  })),
  refund: mock(async () => undefined),
};

const DECLINED_GATEWAY = {
  charge: mock(async () => ({
    paymentId: "",
    success: false,
    failureReason: "Insufficient funds",
  })),
  refund: mock(async () => undefined),
};

describe("interpretPaymentCommands", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    MOCK_GATEWAY.charge.mockReset();
    MOCK_GATEWAY.refund.mockReset();
  });

  test("1. ChargeCard success → gateway.charge called, notifyApiSuccess POSTed to cf-api", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));
    MOCK_GATEWAY.charge.mockImplementation(async () => ({
      paymentId: "pay-001",
      success: true,
      failureReason: undefined,
    }));

    const result = await interpretPaymentCommands(
      [
        {
          _tag: "ChargeCard",
          orderId: "order-001",
          amountCents: 100000,
          currency: "THB",
          token: "tok_visa",
        },
      ],
      MOCK_GATEWAY as unknown as IPaymentGateway
    );

    expect(result.success).toBe(true);
    expect(result.paymentId).toBe("pay-001");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/internal/payment-result");
    const body = JSON.parse(init.body as string);
    expect(body.success).toBe(true);
    expect(body.orderId).toBe("order-001");
  });

  test("2. ChargeCard declined → gateway.charge called, notifyApiFailure POSTed", async () => {
    mockFetch.mockImplementation(async () => new Response(null, { status: 200 }));

    const result = await interpretPaymentCommands(
      [
        {
          _tag: "ChargeCard",
          orderId: "order-002",
          amountCents: 50000,
          currency: "THB",
          token: "tok_decline",
        },
      ],
      DECLINED_GATEWAY as unknown as IPaymentGateway
    );

    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.success).toBe(false);
    expect(body.reason).toBe("Insufficient funds");
  });

  test("3. RecordPayment (crypto) → no gateway.charge, success=true, no fetch call", async () => {
    const result = await interpretPaymentCommands(
      [{ _tag: "RecordPayment", orderId: "order-003", paymentId: "crypto-001", amountCents: 0 }],
      MOCK_GATEWAY as unknown as IPaymentGateway
    );

    expect(result.success).toBe(true);
    expect(MOCK_GATEWAY.charge).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("4. P0: notify fetch fails all attempts → does NOT throw (resilient), logs warning", async () => {
    mockFetch.mockImplementation(async () => {
      throw new Error("ECONNREFUSED");
    });
    MOCK_GATEWAY.charge.mockImplementation(async () => ({
      paymentId: "pay-001",
      success: true,
      failureReason: undefined,
    }));

    await expect(
      interpretPaymentCommands(
        [
          {
            _tag: "ChargeCard",
            orderId: "order-004",
            amountCents: 100000,
            currency: "THB",
            token: "tok_visa",
          },
        ],
        MOCK_GATEWAY as unknown as IPaymentGateway
      )
    ).resolves.toBeDefined();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("5. notify transient failure then success → retries once, succeeds", async () => {
    let calls = 0;
    mockFetch.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error("Network timeout");
      return new Response(null, { status: 200 });
    });
    MOCK_GATEWAY.charge.mockImplementation(async () => ({
      paymentId: "pay-002",
      success: true,
      failureReason: undefined,
    }));

    const result = await interpretPaymentCommands(
      [
        {
          _tag: "ChargeCard",
          orderId: "order-005",
          amountCents: 75000,
          currency: "THB",
          token: "tok_mc",
        },
      ],
      MOCK_GATEWAY as unknown as IPaymentGateway
    );

    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });
});
