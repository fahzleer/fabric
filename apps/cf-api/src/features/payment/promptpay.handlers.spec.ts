import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Err, Ok } from "@fabric/types";
import { InvalidTokenError } from "@fabric/types";
import type { AccessTokenPayload } from "@fabric/types";
import { Hono } from "hono";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import type { OrderService } from "../order/order.service";
import { registerPromptPayRoutes } from "./promptpay.handlers";

process.env.COMMERCE_SERVICE_URL = "http://commerce-test:8083";
process.env.INTERNAL_SECRET = "test-internal-secret";

function makeAuthedVerifier(userId = "user-001"): PasetoVerifierService {
  return {
    verify: mock(async (_token: string) =>
      Ok({ sub: userId, email: "customer@example.com", role: "customer" } as AccessTokenPayload)
    ),
    extractBearerToken: mock(() => Ok("some-paseto-token")),
  } as unknown as PasetoVerifierService;
}

function makeUnauthedVerifier(): PasetoVerifierService {
  return {
    verify: mock(async () => Err(InvalidTokenError("Token is invalid"))),
    extractBearerToken: mock(() => Err(InvalidTokenError("No header"))),
  } as unknown as PasetoVerifierService;
}

const PENDING_ORDER = {
  orderId: "order-abc",
  status: "pending",
  totalCents: 59900,
  currency: "THB",
  userId: { __brand: "UserId" as const, value: "user-001" },
};

const PAID_ORDER = { ...PENDING_ORDER, status: "paid" };

function makeOrderService(returnValue: unknown): OrderService {
  return {
    getOrder: mock(async () => returnValue),
  } as unknown as OrderService;
}

function makeApp(
  verifier: PasetoVerifierService = makeAuthedVerifier(),
  orderService: OrderService = makeOrderService(PENDING_ORDER)
) {
  const app = new Hono();
  registerPromptPayRoutes(app, orderService, verifier);
  return app;
}

const AUTH_HEADER = "Bearer some-valid-token";

function makeCreateRequest(
  body: unknown = { orderId: "order-abc" },
  auth: string | null = AUTH_HEADER
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = auth;
  return new Request("http://localhost/api/payment/promptpay/create", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makeStatusRequest(chargeId = "chrg_test123", auth: string | null = AUTH_HEADER): Request {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = auth;
  return new Request(`http://localhost/api/payment/promptpay/${chargeId}/status`, { headers });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("POST /api/payment/promptpay/create", () => {
  test("1. no Authorization header → 401 Unauthorized", async () => {
    const app = makeApp();
    const res = await app.fetch(makeCreateRequest({ orderId: "order-abc" }, null));

    expect(res.status).toBe(401);
  });

  test("2. invalid / expired token → 401 Unauthorized", async () => {
    const app = makeApp(makeUnauthedVerifier());
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(401);
  });

  test("3. missing orderId in body → 400 validation error", async () => {
    const app = makeApp();
    const res = await app.fetch(makeCreateRequest({}));

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(typeof json.error).toBe("string");
  });

  test("4. empty orderId string → 400 validation error", async () => {
    const app = makeApp();
    const res = await app.fetch(makeCreateRequest({ orderId: "" }));

    expect(res.status).toBe(400);
  });

  test("5. order not found (getOrder returns null) → 404", async () => {
    const app = makeApp(makeAuthedVerifier(), makeOrderService(null));
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Order not found");
  });

  test("6. order not found (getOrder returns error object) → 404", async () => {
    const app = makeApp(
      makeAuthedVerifier(),
      makeOrderService({ error: "NotFound", _tag: "OrderNotFoundError" })
    );
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(404);
  });

  test('7. order exists but not pending (status: "paid") → 409', async () => {
    const app = makeApp(makeAuthedVerifier(), makeOrderService(PAID_ORDER));
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Order is not in pending state");
  });

  test("8. commerce service throws (network error) → 503", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Commerce service unavailable");
  });

  test("9. commerce returns non-ok response → 502", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false, error: "Invalid amount" }, 400)
    ) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Invalid amount");
  });

  test("10. commerce returns ok:false without error field → 502 with fallback message", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false }, 500)
    ) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(typeof json.error).toBe("string");
  });

  test("11. commerce success → 200 with value payload", async () => {
    const COMMERCE_VALUE = {
      chargeId: "chrg_test_abc",
      qrImageUrl: "https://cdn.omise.co/qr/chrg_test_abc.png",
      expiresAt: "2026-03-06T12:30:00Z",
    };

    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: true, value: COMMERCE_VALUE })
    ) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeCreateRequest());

    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof COMMERCE_VALUE;
    expect(json.chargeId).toBe(COMMERCE_VALUE.chargeId);
    expect(json.qrImageUrl).toBe(COMMERCE_VALUE.qrImageUrl);
  });

  test("12. commerce request includes orderId + amountCents + currency from order", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = mock(async (_url: string, opts: RequestInit = {}) => {
      capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>;
      return jsonResponse({
        ok: true,
        value: { chargeId: "chrg_x", qrImageUrl: "", expiresAt: "" },
      });
    }) as unknown as typeof fetch;

    const app = makeApp();
    await app.fetch(makeCreateRequest({ orderId: "order-abc" }));

    expect(capturedBody).not.toBeNull();
    expect((capturedBody as unknown as Record<string, unknown>).orderId).toBe("order-abc");
    expect((capturedBody as unknown as Record<string, unknown>).amountCents).toBe(
      PENDING_ORDER.totalCents
    );
    expect((capturedBody as unknown as Record<string, unknown>).currency).toBe(
      PENDING_ORDER.currency
    );
  });
});

describe("GET /api/payment/promptpay/:chargeId/status", () => {
  test("1. no Authorization header → 401 Unauthorized", async () => {
    const app = makeApp();
    const res = await app.fetch(makeStatusRequest("chrg_test123", null));

    expect(res.status).toBe(401);
  });

  test("2. invalid / expired token → 401 Unauthorized", async () => {
    const app = makeApp(makeUnauthedVerifier());
    const res = await app.fetch(makeStatusRequest());

    expect(res.status).toBe(401);
  });

  test("3. commerce service throws (network error) → 503", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("ETIMEDOUT");
    }) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeStatusRequest());

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Commerce service unavailable");
  });

  test("4. commerce returns error → 502", async () => {
    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: false, error: "Charge not found" }, 404)
    ) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeStatusRequest());

    expect(res.status).toBe(502);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Charge not found");
  });

  test("5. commerce success → 200 with status payload", async () => {
    const STATUS_VALUE = {
      chargeId: "chrg_test123",
      status: "successful",
      paidAt: "2026-03-06T12:00:00Z",
    };

    globalThis.fetch = mock(async () =>
      jsonResponse({ ok: true, value: STATUS_VALUE })
    ) as unknown as typeof fetch;

    const app = makeApp();
    const res = await app.fetch(makeStatusRequest("chrg_test123"));

    expect(res.status).toBe(200);
    const json = (await res.json()) as typeof STATUS_VALUE;
    expect(json.chargeId).toBe("chrg_test123");
    expect(json.status).toBe("successful");
  });

  test("6. chargeId is forwarded to commerce URL", async () => {
    let capturedUrl = "";

    globalThis.fetch = mock(async (url: string) => {
      capturedUrl = url as string;
      return jsonResponse({ ok: true, value: { chargeId: "chrg_xyz", status: "pending" } });
    }) as unknown as typeof fetch;

    const app = makeApp();
    await app.fetch(makeStatusRequest("chrg_xyz"));

    expect(capturedUrl).toContain("chrg_xyz");
    expect(capturedUrl).toContain("http://commerce-test:8083");
  });
});
