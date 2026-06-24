import { describe, expect, mock, test } from "bun:test";
import { SendGridAdapter } from "./sendgrid.adapter";

const BASE_PAYLOAD = {
  orderId: "order-uuid-5678",
  userId: "user-002",
  userEmail: "customer@example.com",
  recipientName: "Jane Doe",
  totalCents: 29900,
  currency: "THB",
  itemCount: 1,
};

describe("SendGridAdapter", () => {
  test("sends email with correct authorization and recipient", async () => {
    let capturedUrl = "";
    let capturedBody: unknown;
    let capturedHeaders: Record<string, string> | undefined;

    global.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;

    const adapter = new SendGridAdapter("sg-api-key", "store@fabric.cool", "Fabric Store");
    await adapter.notifyOrderPlaced(BASE_PAYLOAD);

    expect(capturedUrl).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(capturedHeaders?.Authorization).toBe("Bearer sg-api-key");
    const body = capturedBody as {
      personalizations?: { to?: { email: string }[] }[];
      from?: { email: string };
    };
    expect(body.personalizations?.[0]?.to?.[0]?.email).toBe("customer@example.com");
    expect(body.from?.email).toBe("store@fabric.cool");
  });

  test("skips when userEmail is missing", async () => {
    let fetchCalled = false;
    global.fetch = mock(async () => {
      fetchCalled = true;
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;

    const adapter = new SendGridAdapter("sg-api-key", "store@fabric.cool");
    const { userEmail: _email, ...payloadWithoutEmail } = BASE_PAYLOAD;
    await adapter.notifyOrderPlaced(payloadWithoutEmail);

    expect(fetchCalled).toBe(false);
  });

  test("does not throw when fetch fails", async () => {
    global.fetch = mock(async () => {
      throw new Error("SendGrid down");
    }) as unknown as typeof fetch;

    const adapter = new SendGridAdapter("sg-api-key", "store@fabric.cool");
    await expect(adapter.notifyOrderPlaced(BASE_PAYLOAD)).resolves.toBeUndefined();
  });
});
