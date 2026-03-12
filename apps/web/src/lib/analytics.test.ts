import { describe, expect, test } from "bun:test";
import { logError, logUserAction, trackEvent } from "./analytics";

describe("trackEvent", () => {
  test("resolves without throwing even if fetch fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = (() => Promise.reject(new Error("network error"))) as unknown as typeof fetch;
    await expect(trackEvent("product_viewed", { id: "p-1" })).resolves.toBeUndefined();
    global.fetch = originalFetch;
  });

  test("calls fetch with the correct path and method", async () => {
    const originalFetch = global.fetch;
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    global.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method;
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    await trackEvent("cart_item_added", { cartId: "c-1" }, "user-1");
    expect(capturedUrl).toBe("/api/activity");
    expect(capturedMethod).toBe("POST");
    global.fetch = originalFetch;
  });

  test("does not throw when window is undefined (server-side — no Mixpanel)", async () => {
    await expect(trackEvent("page_viewed", {})).resolves.toBeUndefined();
  });

  test("enters Mixpanel branch when window is defined and token is set", async () => {
    const gt = globalThis as unknown as Record<string, unknown>;
    const origWindow = gt.window;
    const originalFetch = global.fetch;
    gt.window = {};
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = "test-mp-token";
    global.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    await expect(trackEvent("cart_item_added", { cartId: "c-1" })).resolves.toBeUndefined();
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (origWindow === undefined) {
      gt.window = undefined;
    } else {
      gt.window = origWindow;
    }
    process.env.NEXT_PUBLIC_MIXPANEL_TOKEN = undefined;
    global.fetch = originalFetch;
  });
});

describe("logUserAction", () => {
  test("resolves without throwing", async () => {
    const originalFetch = global.fetch;
    global.fetch = (() => Promise.reject(new Error("ignored"))) as unknown as typeof fetch;
    await expect(logUserAction("click", "user-1", { target: "button" })).resolves.toBeUndefined();
    global.fetch = originalFetch;
  });

  test("accepts empty data object", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    await expect(logUserAction("page_view", "user-2")).resolves.toBeUndefined();
    global.fetch = originalFetch;
  });
});

describe("logError", () => {
  test("accepts an Error instance", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    await expect(
      logError(new Error("something broke"), { route: "/checkout" })
    ).resolves.toBeUndefined();
    global.fetch = originalFetch;
  });

  test("accepts a string error", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    await expect(logError("string error message")).resolves.toBeUndefined();
    global.fetch = originalFetch;
  });
});
