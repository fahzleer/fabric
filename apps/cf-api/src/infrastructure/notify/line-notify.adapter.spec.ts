import { describe, expect, mock, test } from "bun:test";
import { LineNotifyAdapter } from "./line-notify.adapter";

const BASE_PAYLOAD = {
  orderId: "order-uuid-1234",
  userId: "user-001",
  userEmail: "buyer@example.com",
  totalCents: 54900,
  currency: "THB",
  itemCount: 2,
};

describe("LineNotifyAdapter", () => {
  test("sends POST to Line Notify with correct headers and body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedInit = init;
      return new Response(JSON.stringify({ status: 200, message: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new LineNotifyAdapter("test-line-token");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect(capturedUrl).toBe("https://notify-api.line.me/api/notify");
    expect(capturedInit?.method).toBe("POST");
    expect((capturedInit?.headers as Record<string, string>)?.Authorization).toBe(
      "Bearer test-line-token"
    );

    const body = new URLSearchParams(capturedInit?.body as string);
    expect(body.get("message")).toContain("#order-uu");
    expect(body.get("message")).toContain("THB");
    expect(body.get("message")).toContain("2");
  });

  test("does not throw when fetch fails", async () => {
    global.fetch = mock(async () => {
      throw new Error("network error");
    }) as unknown as typeof fetch;

    const adapter = new LineNotifyAdapter("test-token");
    await expect(adapter.notifyOrderPlaced(BASE_PAYLOAD)).resolves.toBeUndefined();
  });

  test("does not throw when Line Notify returns non-OK status", async () => {
    global.fetch = mock(
      async () =>
        new Response(JSON.stringify({ status: 401, message: "Invalid token" }), { status: 401 })
    ) as unknown as typeof fetch;

    const adapter = new LineNotifyAdapter("bad-token");
    await expect(adapter.notifyOrderPlaced(BASE_PAYLOAD)).resolves.toBeUndefined();
  });
});
