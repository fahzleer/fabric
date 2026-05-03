/**
 * Platform routes — merchant portal, admin, stores, internal token bridge.
 *
 *   POST  /internal/issue-token                    — internal secret header
 *   GET   /api/stores/*                            — public (mock, no store service yet)
 *   GET   /api/products/:id/store                  — public (mock)
 *   POST  /activity                                — public (fire-and-forget)
 *   DELETE /api/cart                               — proxy → order service
 *   POST  /api/cart/items                          — proxy → order service
 *   POST  /api/cart/sync                           — compat alias (noop)
 *   POST  /api/orders/preview                      — proxy → order service + product + promotion
 *   POST  /api/orders                              — proxy → order service
 *   GET   /api/orders/:id                          — proxy → order service
 *   POST  /api/payment/promptpay/create            — proxy → payment service
 *   GET   /api/payment/promptpay/:chargeId/status  — proxy → payment service
 *   POST  /api/payment/x402                        — mock (no x402 backend)
 *   /merchant/*                                    — requireRole("store_owner")
 *   /admin/*                                       — requireRole("admin")
 */

import Elysia, { t } from "elysia";
import { Effect } from "effect";
import { requireRole } from "@fabric/auth";
import { makeCircuitBreaker } from "@fabric/effect-http";

// ── Service URLs ──────────────────────────────────────────────────────────────

const TOKEN_ISSUE_SECRET = process.env["TOKEN_ISSUE_SECRET"] ?? process.env["INTERNAL_SECRET"] ?? "";
const ORDER_URL          = process.env["ORDER_URL"]   ?? "http://localhost:4001";
const PAYMENT_URL        = process.env["PAYMENT_URL"] ?? "http://localhost:4003";
const PRODUCT_URL        = process.env["PRODUCT_URL"] ?? "http://localhost:4006";
const PROMO_URL          = process.env["PROMO_URL"]   ?? "http://localhost:4008";

// Circuit breaker protecting calls to product service (threshold: 5 failures, 30s cooldown)
const productCb = await Effect.runPromise(
  makeCircuitBreaker({ name: "product-service", threshold: 5, cooldownMs: 30_000 })
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function issueSimpleToken(payload: Record<string, unknown>): string {
  const json = JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 3600_000 });
  return Buffer.from(json).toString("base64url");
}

function decodeSimpleToken(
  authHeader: string | null
): { sub?: string; email?: string; role?: string } | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const raw  = authHeader.slice(7);
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as { sub?: string; email?: string; role?: string };
  } catch {
    return null;
  }
}

type CartItem = { productId: string; size: string; quantity: number };

type EnrichedItem = {
  productId:      string;
  name:           string;
  size:           string;
  quantity:       number;
  unitPriceCents: number;
  currency:       string;
};

/** Fetch server-side cart from order service. */
async function getServerCart(authHeader: string): Promise<CartItem[]> {
  try {
    const res = await fetch(`${ORDER_URL}/cart`, {
      headers: { Authorization: authHeader },
      signal:  AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: CartItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

/** Fetch a product's price from product service.
 *  product service returns price in display units (e.g. 599 THB = 59900 cents). */
async function fetchProductPrice(
  productId: string
): Promise<{ name: string; unitPriceCents: number; currency: string } | null> {
  try {
    const res = await fetch(`${PRODUCT_URL}/products/${productId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const p = (await res.json()) as { name?: string; price?: number; priceCurrency?: string };
    return {
      name:           p.name           ?? "Product",
      unitPriceCents: Math.round((p.price ?? 0) * 100),
      currency:       p.priceCurrency  ?? "THB",
    };
  } catch {
    return null;
  }
}

/** Enrich bare cart items (productId/size/qty) with authoritative prices from product service. */
async function enrichCartItems(items: CartItem[]): Promise<EnrichedItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const product = await fetchProductPrice(item.productId);
      return {
        productId:      item.productId,
        name:           product?.name           ?? "Product",
        size:           item.size,
        quantity:       item.quantity,
        unitPriceCents: product?.unitPriceCents  ?? 0,
        currency:       product?.currency        ?? "THB",
      };
    })
  );
}

/** Apply a voucher code via the promotion service.
 *  Returns discountCents=0 and a voucherError message on failure. */
async function applyVoucher(
  voucherCode: string,
  subtotalCents: number,
  userId: string,
  authHeader: string
): Promise<{ discountCents: number; voucherError: string | null }> {
  const errorMap: Record<string, string> = {
    PromotionNotFound:    "Invalid voucher code",
    CouponExpired:        "Voucher code has expired",
    CouponExhausted:      "Voucher code has been fully redeemed",
    MinimumOrderNotMet:   "Order does not meet the minimum amount for this voucher",
  };

  try {
    const res = await fetch(`${PROMO_URL}/promotions/apply`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body:    JSON.stringify({ code: voucherCode, orderCents: subtotalCents, userId }),
      signal:  AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        discountCents: 0,
        voucherError:  errorMap[err.error ?? ""] ?? "Invalid voucher code",
      };
    }

    const result = (await res.json()) as { discountCents?: number };
    return { discountCents: result.discountCents ?? 0, voucherError: null };
  } catch {
    return { discountCents: 0, voucherError: "Could not validate voucher code" };
  }
}

// ── Route builder ─────────────────────────────────────────────────────────────

export function buildPlatformRoutes() {

  // ── 1. Internal token bridge — protected by shared secret header ──────────

  const internalRoutes = new Elysia()
    .post(
      "/internal/issue-token",
      ({ body, request, set }) => {
        const provided = request.headers.get("x-internal-secret") ?? "";
        if (!TOKEN_ISSUE_SECRET || provided !== TOKEN_ISSUE_SECRET) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
        const token = issueSimpleToken({
          sub:   (body as { userId?: string }).userId  ?? "",
          email: (body as { email?: string }).email    ?? "",
          role:  (body as { role?: string }).role      ?? "customer",
        });
        return { accessToken: token };
      },
      {
        body: t.Object({
          userId: t.Optional(t.String()),
          email:  t.Optional(t.String()),
          role:   t.Optional(t.String()),
        }),
      }
    );

  // ── 2. Public routes ──────────────────────────────────────────────────────

  const publicRoutes = new Elysia()

    // ── Store endpoints (mock — no dedicated store service yet) ───────────

    // MUST be before /:slug to avoid route clash
    .get("/api/stores/by-owner/:ownerId", ({ params }) => ({
      id:         params.ownerId,
      name:       "My Store",
      slug:       "my-store",
      ownerId:    params.ownerId,
      plan:       "free",
      planStatus: "active",
    }))

    .get("/api/stores/:slug/products", async ({ query }) => {
      const page    = Number(query["page"]    ?? 1);
      const perPage = Number(query["perPage"] ?? 20);
      try {
        return await Effect.runPromise(
          productCb
            .call(
              Effect.tryPromise({
                try: async () => {
                  const res = await fetch(
                    `${PRODUCT_URL}/products?page=${page}&perPage=${perPage}`,
                    { signal: AbortSignal.timeout(5_000) }
                  );
                  if (!res.ok) return { items: [], total: 0, page, perPage };
                  return res.json() as Promise<unknown>;
                },
                catch: (e) => e,
              })
            )
            .pipe(Effect.catchAll(() => Effect.succeed({ items: [], total: 0, page, perPage })))
        );
      } catch {
        return { items: [], total: 0, page, perPage };
      }
    })

    .get("/api/stores/:slug", ({ params }) => ({
      id:         params.slug,
      name:       "My Store",
      slug:       params.slug,
      plan:       "free",
      planStatus: "active",
    }))

    .get("/api/products/:id/store", () => ({
      storeName: "My Store",
      slug:      "my-store",
    }))

    .post("/activity", () => ({ ok: true }))

    // ── Cart — proxy to order service ─────────────────────────────────────

    // sync-cart.ts calls DELETE /api/cart to clear the server-side cart
    .delete("/api/cart", async ({ request }) => {
      const authHeader = request.headers.get("Authorization") ?? "";
      await fetch(`${ORDER_URL}/cart`, {
        method:  "DELETE",
        headers: { Authorization: authHeader },
        signal:  AbortSignal.timeout(5_000),
      }).catch(() => null); // non-fatal; client treats 2xx as success
      return { ok: true };
    })

    // sync-cart.ts calls POST /api/cart/items for each item
    .post(
      "/api/cart/items",
      async ({ body, request, set }) => {
        const authHeader = request.headers.get("Authorization") ?? "";
        const b = body as { productId: string; size: string; quantity: number };
        const res = await fetch(`${ORDER_URL}/cart/items`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body:    JSON.stringify(b),
          signal:  AbortSignal.timeout(5_000),
        }).catch(() => null);
        set.status = 201;
        if (res?.ok) return res.json();
        return { ok: true };
      },
      {
        body: t.Object({
          productId: t.String(),
          size:      t.String(),
          quantity:  t.Number(),
        }),
      }
    )

    // Backward-compat alias (no-op, sync-cart.ts now uses DELETE + POST above)
    .post("/api/cart/sync", () => ({ ok: true }), {
      body: t.Object({ items: t.Optional(t.Any()) }),
    })

    // ── Order preview (real pricing from cart + product + promotion) ─────
    .post(
      "/api/orders/preview",
      async ({ body, request }) => {
        const authHeader   = request.headers.get("Authorization") ?? "";
        const b            = body as { cartId?: string; country?: string; province?: string; voucherCode?: string };

        // Decode userId from token — needed by promotion service
        const tokenPayload = decodeSimpleToken(authHeader);
        const userId       = tokenPayload?.sub ?? "anonymous";

        // 1. Get server-side cart items & enrich with authoritative product prices
        const cartItems = await getServerCart(authHeader);
        const enriched  = await enrichCartItems(cartItems);

        const subtotalCents       = enriched.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
        const currency            = enriched[0]?.currency ?? "THB";

        // 2. Apply voucher via promotion service (if provided)
        let discountCents         = 0;
        let voucherError: string | null = null;
        if (b.voucherCode && subtotalCents > 0) {
          const voucher   = await applyVoucher(b.voucherCode, subtotalCents, userId, authHeader);
          discountCents   = voucher.discountCents;
          voucherError    = voucher.voucherError;
        }

        return {
          subtotalCents,
          discountCents,
          shippingCents: 0,
          taxCents:      0,
          totalCents:    subtotalCents - discountCents,
          currency,
          voucherError,
        };
      },
      {
        body: t.Object({
          cartId:      t.Optional(t.String()),
          country:     t.Optional(t.String()),
          province:    t.Optional(t.String()),
          voucherCode: t.Optional(t.String()),
        }),
      }
    )

    // ── Order creation ────────────────────────────────────────────────────
    .post(
      "/api/orders",
      async ({ body, request, set }) => {
        const authHeader = request.headers.get("Authorization") ?? "";
        const b = body as {
          cartId?:         string;
          paymentMethod?:  string;
          paymentToken?:   string;
          voucherCode?:    string;
          shippingAddress?: unknown;
        };

        // 1. Get server-side cart items
        const cartItems = await getServerCart(authHeader);
        const enriched  = await enrichCartItems(cartItems);

        if (enriched.length === 0) {
          set.status = 422;
          return { error: "CartEmpty" };
        }

        const currency   = enriched[0]?.currency ?? "THB";
        const orderItems = enriched.map((i) => ({
          productId:      i.productId,
          name:           i.name,
          size:           i.size,
          quantity:       i.quantity,
          unitPriceCents: i.unitPriceCents,
        }));

        // 2. Place order via order service
        // Include userId from decoded token (order service requires it in body)
        const tokenPayload = decodeSimpleToken(authHeader);
        const userId       = tokenPayload?.sub ?? "";

        const res = await fetch(`${ORDER_URL}/orders`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            userId,
            items:           orderItems,
            paymentMethod:   b.paymentMethod   ?? "card",
            shippingAddress: b.shippingAddress ?? {},
            currency,
          }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => null);

        if (!res?.ok) {
          const errBody = await res?.json().catch(() => ({}));
          set.status = res?.status ?? 500;
          return errBody;
        }

        const order = (await res.json()) as {
          id?:            string;
          status?:        string;
          paymentMethod?: string;
          totalCents?:    number;
          currency?:      string;
          createdAt?:     string;
        };

        return {
          id:            order.id,
          status:        order.status        ?? "pending",
          paymentMethod: order.paymentMethod ?? b.paymentMethod ?? "card",
          totalCents:    order.totalCents,
          currency:      order.currency      ?? currency,
          createdAt:     order.createdAt     ?? new Date().toISOString(),
        };
      },
      {
        body: t.Object({
          cartId:          t.Optional(t.String()),
          paymentMethod:   t.Optional(t.String()),
          paymentToken:    t.Optional(t.String()),
          voucherCode:     t.Optional(t.String()),
          shippingAddress: t.Optional(t.Any()),
        }),
      }
    )

    // ── Order detail ──────────────────────────────────────────────────────
    .get("/api/orders/:id", async ({ params, request, set }) => {
      const authHeader = request.headers.get("Authorization") ?? "";
      const res = await fetch(`${ORDER_URL}/orders/${params.id}`, {
        headers: { Authorization: authHeader },
        signal:  AbortSignal.timeout(5_000),
      }).catch(() => null);

      if (!res?.ok) {
        set.status = res?.status ?? 404;
        return { error: "OrderNotFound" };
      }

      const order = (await res.json()) as {
        id?:            string;
        status?:        string;
        paymentMethod?: string;
        totalCents?:    number;
        currency?:      string;
        createdAt?:     string;
        items?: Array<{
          productId?:      string;
          name?:           string;
          size?:           string;
          quantity?:       number;
          unitPriceCents?: number;
        }>;
      };

      return {
        id:            order.id            ?? params.id,
        status:        order.status        ?? "confirmed",
        paymentMethod: order.paymentMethod ?? "card",
        totalCents:    order.totalCents    ?? 0,
        currency:      order.currency      ?? "THB",
        createdAt:     order.createdAt     ?? new Date().toISOString(),
        items: (order.items ?? []).map((i) => ({
          productName:    i.name           ?? "Product",
          size:           i.size           ?? "",
          quantity:       i.quantity       ?? 1,
          unitPriceCents: i.unitPriceCents ?? 0,
        })),
      };
    })

    // ── PromptPay QR creation — proxy to payment service ──────────────────
    .post(
      "/api/payment/promptpay/create",
      async ({ body, request }) => {
        const b          = body as { orderId?: string };
        const authHeader = request.headers.get("Authorization") ?? "";

        // Fetch the order total to pass to payment service
        let amountCents = 0;
        let currency    = "THB";
        if (b.orderId) {
          const orderRes = await fetch(`${ORDER_URL}/orders/${b.orderId}`, {
            headers: { Authorization: authHeader },
            signal:  AbortSignal.timeout(5_000),
          }).catch(() => null);
          if (orderRes?.ok) {
            const o = (await orderRes.json()) as { totalCents?: number; currency?: string };
            amountCents = o.totalCents ?? 0;
            currency    = o.currency   ?? "THB";
          }
        }

        const res = await fetch(`${PAYMENT_URL}/api/payment/promptpay/create`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ orderId: b.orderId, amount: amountCents, currency }),
          signal:  AbortSignal.timeout(10_000),
        }).catch(() => null);

        if (res?.ok) {
          const charge = (await res.json()) as {
            chargeId?:  string;
            qrCodeUrl?: string;    // payment service field name
            qrImageUrl?: string;   // fallback
            status?:    string;
          };
          return {
            chargeId:   charge.chargeId  ?? `chrg_dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
            qrImageUrl: charge.qrCodeUrl || charge.qrImageUrl || "https://placehold.co/300x300/16a34a/ffffff?text=PromptPay+QR",
            expiresAt:  new Date(Date.now() + 15 * 60_000).toISOString(),
            amountCents,
            currency,
          };
        }

        // Fallback (payment service offline / no Omise key in dev)
        return {
          chargeId:   `chrg_dev_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
          qrImageUrl: "https://placehold.co/300x300/16a34a/ffffff?text=PromptPay+QR",
          expiresAt:  new Date(Date.now() + 15 * 60_000).toISOString(),
          amountCents,
          currency,
        };
      },
      { body: t.Object({ orderId: t.Optional(t.String()) }) }
    )

    // ── PromptPay status polling — proxy to payment service ───────────────
    .get("/api/payment/promptpay/:chargeId/status", async ({ params }) => {
      const res = await fetch(
        `${PAYMENT_URL}/api/payment/promptpay/${params.chargeId}/status`,
        { signal: AbortSignal.timeout(5_000) }
      ).catch(() => null);

      if (res?.ok) {
        const data = (await res.json()) as { chargeId?: string; status?: string };
        return {
          chargeId: params.chargeId,
          status:   (data.status ?? "pending") as "pending" | "successful" | "failed",
        };
      }

      return { chargeId: params.chargeId, status: "pending" as const };
    })

    // ── x402 / USDC payment (mock — no x402 backend service) ─────────────
    .post(
      "/api/payment/x402",
      ({ body }) => ({
        orderId:   (body as { orderId?: string }).orderId ?? crypto.randomUUID(),
        status:    "confirmed",
        txHash:    `0x${crypto.randomUUID().replace(/-/g, "")}`,
        amountUsd: "23.96",
        network:   "base",
      }),
      { body: t.Object({ orderId: t.Optional(t.String()), txHash: t.Optional(t.String()) }) }
    );

  // ── 3. Merchant portal — requireRole("store_owner") ───────────────────────

  const merchantRoutes = new Elysia()
    .use(requireRole("store_owner"))

    .post(
      "/merchant/onboard",
      ({ body }) => {
        const storeName = (body as { storeName?: string }).storeName ?? "My Store";
        return {
          userId:     "unknown",
          storeName,
          plan:       "free",
          planStatus: "active",
        };
      },
      { body: t.Object({ storeName: t.Optional(t.String()) }) }
    )

    // NOTE: planExpiresAt / productCapacityUsed / storeSlug / onboarded are
    //       Maybe<T> ADTs consumed by isSome() on the web side — use _tag shape.
    .get("/merchant/billing/status", () => ({
      plan:                "free",
      planStatus:          "active",
      limits:              { maxProducts: 10, maxOrdersPerMonth: 100 },
      productCount:        0,
      productCapacityUsed: { _tag: "None" },
      planExpiresAt:       { _tag: "None" },
      hasStripeAccount:    false,
      storeSlug:           { _tag: "None" },
      storeName:           "My Store",
      onboarded:           { _tag: "Some", value: true },
    }))

    .post(
      "/merchant/billing/subscribe",
      ({ body }) => ({
        plan:       (body as { planId?: string }).planId ?? "free",
        planStatus: "active",
      }),
      { body: t.Object({ planId: t.Optional(t.String()) }) }
    )

    .get("/merchant/billing/portal", () => ({ url: "/" }))

    .post("/merchant/billing/cancel", () => ({ ok: true }))

    .get("/merchant/analytics/summary", () => ({
      completedOrderCount: 0,
      totalRevenueCents:   0,
      productCount:        0,
      plan:                "free",
      planStatus:          "active",
    }))

    .get("/merchant/payouts/balance", () => ({
      totalRevenueCents:     0,
      paidOutCents:          0,
      platformFeePct:        0.05,
      availableBalanceCents: 0,
    }))

    .get("/merchant/payouts", () => ({ payouts: [] }))

    .post(
      "/merchant/payouts/request",
      () => ({
        id:          crypto.randomUUID(),
        userId:      "unknown",
        requestedAt: new Date().toISOString(),
        amountCents: 0,
        bankInfo:    "",
        status:      "pending",
      }),
      { body: t.Object({ amountCents: t.Optional(t.Number()), bankInfo: t.Optional(t.String()) }) }
    );

  // ── 4. Admin panel — requireRole("admin") ────────────────────────────────

  const adminRoutes = new Elysia()
    .use(requireRole("admin"))

    .get("/admin/merchants", () => ({ merchants: [] }))

    .get("/admin/kyc", () => ({ submissions: [] }))

    .get("/admin/payouts", () => ({ payouts: [] }))

    .patch("/admin/payouts/:id/approve", () => ({ ok: true }))

    .patch("/admin/payouts/:id/reject", () => ({ ok: true }));

  return new Elysia()
    .use(internalRoutes)
    .use(publicRoutes)
    .use(merchantRoutes)
    .use(adminRoutes);
}
