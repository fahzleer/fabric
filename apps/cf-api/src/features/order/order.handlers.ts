import { type } from "arktype";
import type { Hono } from "hono";
import type { UserId } from "../../domain/user/user.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import type { OrderService } from "./order.service";

const MERCHANT_WALLET = process.env.MERCHANT_WALLET ?? "";
const X402_NETWORK_ID = process.env.X402_NETWORK_ID ?? "84532";
const X402_USDC_ASSET = process.env.X402_USDC_ASSET ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const X402_THB_PER_USDC = Number(process.env.X402_THB_PER_USDC ?? "35");
const X402_RESOURCE_URL = process.env.X402_RESOURCE_URL ?? "http://localhost:3010/api/orders";

const PlaceOrderBody = type({
  cartId: "string >= 1",
  shippingAddress: {
    street: "string >= 1",
    city: "string >= 1",
    province: "string >= 1",
    country: "string == 2",
    postalCode: "string >= 1",
    recipientName: "string >= 1",
    phone: "string >= 1",
  },
  "paymentToken?": "string",
  "paymentMethod?": '"card" | "crypto" | "promptpay"',
  "voucherCode?": "string",
});

const PreviewBody = type({
  cartId: "string >= 1",
  country: "string == 2",
  province: "string >= 1",
  "voucherCode?": "string",
});

export function registerOrderRoutes(
  app: Hono,
  service: OrderService,
  verifier: PasetoVerifierService
): void {
  const userId = (c: import("hono").Context) =>
    ({ __brand: "UserId" as const, value: c.get("userId") as string }) as UserId;

  app.post("/api/orders/preview", requireAuth(verifier), async (c) => {
    const body = await c.req.json();
    const validated = PreviewBody(body);
    if (validated instanceof type.errors) return c.json({ error: validated.summary }, 400);
    const result = await service.previewCheckout(
      userId(c),
      validated.cartId,
      validated.country,
      validated.province,
      validated.voucherCode
    );
    return c.json(result);
  });

  app.post("/api/orders", requireAuth(verifier), async (c) => {
    const body = await c.req.json();
    const validated = PlaceOrderBody(body);
    if (validated instanceof type.errors) return c.json({ error: validated.summary }, 400);

    // x402 USDC payment: probe → 402 challenge, then retry with X-Payment header
    if (validated.paymentMethod === "crypto" && MERCHANT_WALLET) {
      const xPayment = c.req.header("X-Payment");
      if (!xPayment) {
        const preview = await service.previewCheckout(
          userId(c),
          validated.cartId,
          validated.shippingAddress.country,
          validated.shippingAddress.province
        );
        const totalCents = (preview as unknown as { totalCents?: number }).totalCents ?? 0;
        const usdcAtomic = Math.ceil((totalCents / 100 / X402_THB_PER_USDC) * 1_000_000);
        return c.json(
          {
            x402Version: 1,
            accepts: [
              {
                scheme: "exact",
                networkId: X402_NETWORK_ID,
                maxAmountRequired: usdcAtomic.toString(),
                resource: X402_RESOURCE_URL,
                payTo: MERCHANT_WALLET,
                maxTimeoutSeconds: 300,
                asset: X402_USDC_ASSET,
                extra: { name: "USD Coin", version: "2" },
              },
            ],
          },
          402
        );
      }
      // X-Payment present — fall through to placeOrder as crypto
    }

    const result = await service.placeOrder(
      userId(c),
      validated.cartId,
      validated.shippingAddress as unknown as import(
        "../../domain/order/order.value-objects"
      ).ShippingAddress,
      validated.paymentToken,
      (validated.paymentMethod ?? "card") as import("@fabric/types").PaymentMethod,
      validated.voucherCode
    );
    return c.json(result, 201);
  });

  app.get("/api/orders", requireAuth(verifier), async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const perPage = Math.min(50, Math.max(1, Number(c.req.query("perPage") ?? "20")));
    const result = await service.getUserOrders(userId(c), { page, perPage });
    return c.json(result);
  });

  app.get("/api/orders/:id", requireAuth(verifier), async (c) => {
    const result = await service.getOrder(userId(c), c.req.param("id"));
    return c.json(result);
  });

  app.patch("/merchant/orders/:id/status", requireAuth(verifier), async (c) => {
    const body = (await c.req.json()) as { status?: string };
    const newStatus = body.status;
    if (newStatus !== "shipped" && newStatus !== "delivered") {
      return c.json({ error: "status must be 'shipped' or 'delivered'" }, 400);
    }
    const result = await service.updateMerchantOrderStatus(userId(c), c.req.param("id"), newStatus);
    return c.json(result);
  });

  app.get("/admin/stats", requireAuth(verifier), async (c) => {
    if (c.get("userRole") !== "admin") return c.json({ error: "Forbidden" }, 403);
    const result = await service.getAdminStats();
    return c.json(result);
  });

  app.get("/admin/orders", requireAuth(verifier), async (c) => {
    if (c.get("userRole") !== "admin") return c.json({ error: "Forbidden" }, 403);
    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const perPage = Math.min(100, Math.max(1, Number(c.req.query("perPage") ?? "20")));
    const result = await service.getAdminOrders({ page, perPage });
    return c.json(result);
  });

  app.get("/admin/analytics", requireAuth(verifier), async (c) => {
    if (c.get("userRole") !== "admin") return c.json({ error: "Forbidden" }, 403);
    const result = await service.getAdminAnalytics();
    return c.json(result);
  });

  app.get("/admin/merchants", requireAuth(verifier), async (c) => {
    if (c.get("userRole") !== "admin") return c.json({ error: "Forbidden" }, 403);
    const result = await service.getAdminMerchants();
    return c.json(result);
  });

  app.get("/merchant/orders", requireAuth(verifier), async (c) => {
    const page = Math.max(1, Number(c.req.query("page") ?? "1"));
    const perPage = Math.min(50, Math.max(1, Number(c.req.query("perPage") ?? "20")));
    const result = await service.getMerchantOrders(userId(c), { page, perPage });
    return c.json(result);
  });

  app.get("/merchant/orders/:id", requireAuth(verifier), async (c) => {
    const result = await service.getMerchantOrder(userId(c), c.req.param("id"));
    return c.json(result);
  });

  app.post("/internal/payment-result", async (c) => {
    const secret = c.req.header("x-internal-secret");
    if (secret !== process.env.INTERNAL_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const { orderId, success, reason } = await c.req.json();
    if (success) {
      await service.confirmOrder(orderId);
    } else {
      await service.failOrder(orderId, reason ?? "unknown");
    }
    return c.json({ ok: true });
  });
}
