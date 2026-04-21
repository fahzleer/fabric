import { type } from "arktype";
import type { Hono } from "hono";
import { makeUserId } from "../../domain/user/user.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import type { OrderService } from "./order.service";

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
  verifier: PasetoVerifierService,
  internalSecret: string
): void {
  const userId = (c: import("hono").Context) => makeUserId(c.get("userId") as string);

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

  app.post("/internal/payment-result", async (c) => {
    const secret = c.req.header("x-internal-secret");
    if (secret !== internalSecret) {
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
