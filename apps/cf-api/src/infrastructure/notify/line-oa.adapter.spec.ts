import { describe, expect, mock, test } from "bun:test";
import { LineOaAdapter } from "./line-oa.adapter";

const BASE_PAYLOAD = {
  orderId: "order-uuid-1234",
  userId: "user-001",
  userEmail: "buyer@example.com",
  customerPhone: "0812345678",
  recipientName: "Saifah T",
  totalCents: 54900,
  currency: "THB",
  itemCount: 2,
};

describe("LineOaAdapter", () => {
  test("pushes to admin LINE UID when configured", async () => {
    let capturedBody: unknown;

    global.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new LineOaAdapter("test-channel-token", "admin-line-uid");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect((capturedBody as { to?: string }).to).toBe("admin-line-uid");
    expect((capturedBody as { messages?: unknown[] }).messages).toHaveLength(1);
  });

  test("broadcasts when no admin UID is set", async () => {
    let capturedUrl = "";

    global.fetch = mock(async (url: string | URL | Request) => {
      capturedUrl = url.toString();
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new LineOaAdapter("test-channel-token");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect(capturedUrl).toContain("broadcast");
  });

  test("uses correct Authorization header", async () => {
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ message: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new LineOaAdapter("my-channel-token", "uid-123");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect(capturedHeaders?.Authorization).toBe("Bearer my-channel-token");
  });

  test("does not throw when fetch fails", async () => {
    global.fetch = mock(async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;

    const adapter = new LineOaAdapter("token");
    await expect(adapter.notifyOrderPlaced(BASE_PAYLOAD)).resolves.toBeUndefined();
  });
});
