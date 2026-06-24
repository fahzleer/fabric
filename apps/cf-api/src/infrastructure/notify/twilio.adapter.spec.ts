import { describe, expect, mock, test } from "bun:test";
import { TwilioAdapter } from "./twilio.adapter";

const BASE_PAYLOAD = {
  orderId: "order-uuid-9999",
  userId: "user-003",
  userEmail: "sms@example.com",
  customerPhone: "+66812345678",
  totalCents: 99900,
  currency: "THB",
  itemCount: 3,
};

describe("TwilioAdapter", () => {
  test("sends SMS with correct URL and basic auth", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> | undefined;
    let capturedBody: URLSearchParams | undefined;

    global.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedHeaders = init?.headers as Record<string, string>;
      capturedBody = new URLSearchParams(init?.body as string);
      return new Response(JSON.stringify({ sid: "SM123" }), { status: 201 });
    }) as unknown as typeof fetch;

    const adapter = new TwilioAdapter("AC-test-sid", "test-auth-token", "+12025551234");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect(capturedUrl).toContain("api.twilio.com");
    expect(capturedUrl).toContain("AC-test-sid");
    const expectedAuth = `Basic ${Buffer.from("AC-test-sid:test-auth-token").toString("base64")}`;
    expect(capturedHeaders?.Authorization).toBe(expectedAuth);
    expect(capturedBody?.get("To")).toBe("+66812345678");
    expect(capturedBody?.get("From")).toBe("+12025551234");
    expect(capturedBody?.get("Body")).toContain("order-uu");
  });

  test("skips when customerPhone is missing", async () => {
    let fetchCalled = false;
    global.fetch = mock(async () => {
      fetchCalled = true;
      return new Response("", { status: 201 });
    }) as unknown as typeof fetch;

    const adapter = new TwilioAdapter("AC-sid", "token", "+1234");
    const { customerPhone: _phone, ...payloadWithoutPhone } = BASE_PAYLOAD;
    await adapter.notifyOrderPlaced(payloadWithoutPhone);

    expect(fetchCalled).toBe(false);
  });

  test("does not throw when fetch fails", async () => {
    global.fetch = mock(async () => {
      throw new Error("Twilio down");
    }) as unknown as typeof fetch;

    const adapter = new TwilioAdapter("AC-sid", "token", "+1234");
    await expect(adapter.notifyOrderPlaced(BASE_PAYLOAD)).resolves.toBeUndefined();
  });
});
