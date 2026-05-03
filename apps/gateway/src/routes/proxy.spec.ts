import { describe, it, expect } from "bun:test";
import { UpstreamPool } from "@fabric/middleware";

// ── Gateway proxy — unit tests ────────────────────────────────────────────────
//
// The gateway is a thin reverse proxy backed by UpstreamPool.
// Tests cover:
//   1. Pool registry completeness & default URLs
//   2. Env var override (single + multi-upstream)
//   3. URL rewriting logic (pathname + query string)
//   4. Circuit-breaker integration via pool

// ── URL helpers (mirror strip() from proxy.ts) ────────────────────────────────

const strip = (pathname: string, prefix: string) =>
  pathname.startsWith(prefix) ? pathname.slice(prefix.length) || "/" : pathname;

const rewritePath = (rawUrl: string): string =>
  strip(new URL(rawUrl).pathname, "/api");

// ── Pool registry ─────────────────────────────────────────────────────────────

const SERVICE_DEFAULTS: Record<string, string> = {
  ORDER_URL:    "http://localhost:4001",
  CUSTOMER_URL: "http://localhost:4002",
  PAYMENT_URL:  "http://localhost:4003",
  SHIPPING_URL: "http://localhost:4004",
  PRODUCT_URL:  "http://localhost:4006",
  SEARCH_URL:   "http://localhost:4007",
  PROMOTION_URL:"http://localhost:4008",
  IMPORTER_URL: "http://localhost:4009",
};

describe("POOLS registry", () => {
  it("registers all 8 service pools", () => {
    const pools = Object.fromEntries(
      Object.entries(SERVICE_DEFAULTS).map(([k, fallback]) => [
        k.replace("_URL", "").toLowerCase(),
        UpstreamPool.fromEnv(k, fallback),
      ])
    );
    expect(Object.keys(pools)).toHaveLength(8);
  });

  it("each pool defaults to one upstream", () => {
    for (const [envVar, fallback] of Object.entries(SERVICE_DEFAULTS)) {
      const saved = process.env[envVar];
      delete process.env[envVar];
      const pool = UpstreamPool.fromEnv(envVar, fallback);
      expect(pool.size()).toBe(1);
      expect(pool.allUrls()[0]).toBe(fallback);
      if (saved !== undefined) process.env[envVar] = saved;
    }
  });

  it("has correct default ports", () => {
    const check = (envVar: string, expected: string) => {
      const saved = process.env[envVar];
      delete process.env[envVar];
      const pool = UpstreamPool.fromEnv(envVar, SERVICE_DEFAULTS[envVar]!);
      expect(pool.pick()).toBe(expected);
      if (saved !== undefined) process.env[envVar] = saved;
    };
    check("ORDER_URL",    "http://localhost:4001");
    check("CUSTOMER_URL", "http://localhost:4002");
    check("PAYMENT_URL",  "http://localhost:4003");
    check("SHIPPING_URL", "http://localhost:4004");
    check("PRODUCT_URL",  "http://localhost:4006");
    check("SEARCH_URL",   "http://localhost:4007");
    check("PROMOTION_URL","http://localhost:4008");
    check("IMPORTER_URL", "http://localhost:4009");
  });

  it("respects single-URL env var override", () => {
    process.env["ORDER_URL"] = "http://order-svc.internal:4001";
    const pool = UpstreamPool.fromEnv("ORDER_URL", "http://localhost:4001");
    expect(pool.pick()).toBe("http://order-svc.internal:4001");
    delete process.env["ORDER_URL"];
  });

  it("parses comma-separated multi-upstream env var", () => {
    process.env["ORDER_URL"] = "http://order-1:4001,http://order-2:4001,http://order-3:4001";
    const pool = UpstreamPool.fromEnv("ORDER_URL", "http://localhost:4001");
    expect(pool.size()).toBe(3);
    expect(pool.allUrls()).toEqual([
      "http://order-1:4001",
      "http://order-2:4001",
      "http://order-3:4001",
    ]);
    delete process.env["ORDER_URL"];
  });

  it("round-robins across multi-upstream pool", () => {
    process.env["ORDER_URL"] = "http://order-1:4001,http://order-2:4001";
    const pool = UpstreamPool.fromEnv("ORDER_URL", "http://localhost:4001");
    expect(pool.pick()).toBe("http://order-1:4001");
    expect(pool.pick()).toBe("http://order-2:4001");
    expect(pool.pick()).toBe("http://order-1:4001"); // wraps
    delete process.env["ORDER_URL"];
  });

  it("skips tripped upstream in multi-instance pool", () => {
    const pool = new UpstreamPool(
      ["http://order-1:4001", "http://order-2:4001"],
      { threshold: 1, cooldownMs: 60_000 }
    );
    pool.report("http://order-1:4001", false); // trip order-1
    // Both picks should return order-2
    expect(pool.pick()).toBe("http://order-2:4001");
    expect(pool.pick()).toBe("http://order-2:4001");
  });
});

// ── URL rewriting ─────────────────────────────────────────────────────────────

describe("URL rewriting — /api prefix removal", () => {
  it("strips /api prefix from /api/orders/123", () => {
    expect(rewritePath("http://gateway/api/orders/123")).toBe("/orders/123");
  });

  it("strips /api prefix from /api/products", () => {
    expect(rewritePath("http://gateway/api/products")).toBe("/products");
  });

  it("strips /api prefix from /api/search?q=shirt (pathname only)", () => {
    expect(rewritePath("http://gateway/api/search?q=shirt")).toBe("/search");
  });

  it("strips /api prefix from /api/promotions/validate", () => {
    expect(rewritePath("http://gateway/api/promotions/validate")).toBe("/promotions/validate");
  });

  it("strips /api prefix from /api/import", () => {
    expect(rewritePath("http://gateway/api/import")).toBe("/import");
  });

  it("strips /api from /api/shipments/ship_001", () => {
    expect(rewritePath("http://gateway/api/shipments/ship_001")).toBe("/shipments/ship_001");
  });

  it("returns '/' when only /api is present", () => {
    expect(strip("/api", "/api")).toBe("/");
  });
});

// ── Proxy target URL construction ─────────────────────────────────────────────

describe("Proxy target URL construction", () => {
  const buildTarget = (base: string, pathname: string, search = "") =>
    `${base}${pathname}${search}`;

  it("builds correct target for order service", () => {
    expect(buildTarget("http://localhost:4001", "/orders/order_123")).toBe(
      "http://localhost:4001/orders/order_123"
    );
  });

  it("preserves query string", () => {
    expect(buildTarget("http://localhost:4007", "/search", "?q=shirt&limit=20")).toBe(
      "http://localhost:4007/search?q=shirt&limit=20"
    );
  });

  it("builds correct target for nested product path", () => {
    expect(buildTarget("http://localhost:4006", "/products/prod_001/variants")).toBe(
      "http://localhost:4006/products/prod_001/variants"
    );
  });
});

// ── Health endpoint ───────────────────────────────────────────────────────────

describe("Health endpoint paths", () => {
  const isPublic = (pathname: string) =>
    pathname === "/health" ||
    pathname.startsWith("/health/") ||
    pathname === "/healthz";

  it("/health is a public path", () => {
    expect(isPublic("/health")).toBe(true);
  });

  it("/health/* sub-paths are public", () => {
    expect(isPublic("/health/services")).toBe(true);
    expect(isPublic("/health/pools")).toBe(true);
    expect(isPublic("/health/ready")).toBe(true);
  });

  it("/api routes are NOT public", () => {
    expect(isPublic("/api/orders")).toBe(false);
    expect(isPublic("/api/customers")).toBe(false);
  });
});
