import Elysia from "elysia";
import type Redis from "ioredis";
import { redisThrottle } from "@fabric/middleware";
import { UpstreamPool } from "@fabric/middleware";

// ── Service pools ─────────────────────────────────────────────────────────────
//
// Each service can have 1-N upstream instances via a comma-separated env var:
//   ORDER_URL=http://order-1:4001,http://order-2:4001
//
// Single-instance dev setup (defaults) also works seamlessly.

export const POOLS = {
  order:    UpstreamPool.fromEnv("ORDER_URL",    "http://localhost:4001"),
  customer: UpstreamPool.fromEnv("CUSTOMER_URL", "http://localhost:4002"),
  payment:  UpstreamPool.fromEnv("PAYMENT_URL",  "http://localhost:4003"),
  shipping: UpstreamPool.fromEnv("SHIPPING_URL", "http://localhost:4004"),
  product:  UpstreamPool.fromEnv("PRODUCT_URL",  "http://localhost:4006"),
  search:   UpstreamPool.fromEnv("SEARCH_URL",   "http://localhost:4007"),
  promotion:UpstreamPool.fromEnv("PROMOTION_URL","http://localhost:4008"),
  importer: UpstreamPool.fromEnv("IMPORTER_URL", "http://localhost:4009"),
} as const;

// ── Proxy helper ──────────────────────────────────────────────────────────────

/**
 * Forward `request` to `pool.pick()/<pathname><search>`.
 * Reports the outcome back to the pool so its circuit state stays accurate.
 * 5xx responses count as upstream failures; 4xx are application-level and
 * do NOT trip the circuit.
 */
export const proxyToPool = async (
  pool: UpstreamPool,
  request: Request,
  pathname: string
): Promise<Response> => {
  const upstream = pool.pick();
  const url      = new URL(request.url);
  const target   = `${upstream}${pathname}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method:  request.method,
    headers,
    body:    ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    // @ts-expect-error — Bun-specific duplex option for streaming request bodies
    duplex: "half",
  };

  try {
    const res = await fetch(target, init);
    // 5xx → upstream failure; 4xx → application error (not upstream fault)
    pool.report(upstream, res.status < 500);
    return res;
  } catch (e) {
    pool.report(upstream, false);
    console.error(`[gateway] proxy error → ${target}:`, e);
    return Response.json({ error: "ServiceUnavailable" }, { status: 503 });
  }
};

// Strip a prefix from a URL pathname
const strip = (pathname: string, prefix: string) =>
  pathname.startsWith(prefix) ? pathname.slice(prefix.length) || "/" : pathname;

// ── Route definitions ─────────────────────────────────────────────────────────

export const buildProxyRoutes = (redis: Redis) => {
  // Strict throttle: 10 req/min per IP — for token bridge (auth-sensitive)
  const authThrottledRoutes = new Elysia()
    .use(
      redisThrottle(redis, {
        limit:    10,
        windowMs: 60_000,
        failOpen: process.env["NODE_ENV"] !== "production",
        keyFn: (req) => {
          const ip =
            req.headers.get("x-real-ip") ??
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown";
          return `rate_limit:auth:${ip}`;
        },
      })
    )
    // ── /internal/* → customer service (token bridge) ────────────────────────
    .all("/internal/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      return proxyToPool(POOLS.customer, request, pathname);
    });

  // Standard proxy routes
  const standardRoutes = new Elysia()

    // ── /api/products/* → product service ────────────────────────────────────
    .all("/api/products", ({ request }) =>
      proxyToPool(POOLS.product, request, "/products")
    )
    .all("/api/products/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.product, request, pathname);
    })

    // ── /api/stores/* → customer service (store/merchant info) ───────────────
    .all("/api/stores/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      return proxyToPool(POOLS.customer, request, pathname);
    })

    // ── /api/orders/* → order service ────────────────────────────────────────
    .all("/api/orders", ({ request }) =>
      proxyToPool(POOLS.order, request, "/orders")
    )
    .all("/api/orders/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.order, request, pathname);
    })

    // ── /api/cart → order service ─────────────────────────────────────────────
    .all("/api/cart", ({ request }) =>
      proxyToPool(POOLS.order, request, "/cart")
    )
    .all("/api/cart/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.order, request, pathname);
    })

    // ── /api/payments/* → payment service ────────────────────────────────────
    .all("/api/payments", ({ request }) =>
      proxyToPool(POOLS.payment, request, "/payments")
    )
    .all("/api/payments/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.payment, request, pathname);
    })

    // ── /api/payment/* → payment service (Omise/PromptPay routes) ────────────
    .all("/api/payment/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      return proxyToPool(POOLS.payment, request, pathname);
    })

    // ── /api/shipments/* → shipping service ──────────────────────────────────
    .all("/api/shipments/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.shipping, request, pathname);
    })

    // ── /api/customers/* → customer service ──────────────────────────────────
    .all("/api/customers", ({ request }) =>
      proxyToPool(POOLS.customer, request, "/customers")
    )
    .all("/api/customers/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.customer, request, pathname);
    })

    // ── /api/search/* → search service ───────────────────────────────────────
    .all("/api/search", ({ request }) =>
      proxyToPool(POOLS.search, request, "/search")
    )
    .all("/api/search/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.search, request, pathname);
    })

    // ── /api/promotions/* → promotion service ────────────────────────────────
    .all("/api/promotions", ({ request }) =>
      proxyToPool(POOLS.promotion, request, "/promotions")
    )
    .all("/api/promotions/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.promotion, request, pathname);
    })

    // ── /api/import/* → importer service ─────────────────────────────────────
    .all("/api/import", ({ request }) =>
      proxyToPool(POOLS.importer, request, "/import")
    )
    .all("/api/import/*", ({ request }) => {
      const pathname = strip(new URL(request.url).pathname, "/api");
      return proxyToPool(POOLS.importer, request, pathname);
    })

    // ── /merchant/* → customer service (merchant portal) ─────────────────────
    .all("/merchant/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      return proxyToPool(POOLS.customer, request, pathname);
    })

    // ── /admin/* → customer service (admin panel) ─────────────────────────────
    .all("/admin/*", ({ request }) => {
      const pathname = new URL(request.url).pathname;
      return proxyToPool(POOLS.customer, request, pathname);
    })

    // ── /activity → customer service ──────────────────────────────────────────
    .all("/activity", ({ request }) =>
      proxyToPool(POOLS.customer, request, "/activity")
    );

  return new Elysia()
    .use(authThrottledRoutes)
    .use(standardRoutes);
};

// Keep backward-compatible export for existing imports
export const proxyRoutes = new Elysia();
