import { type } from "arktype";
import type { Hono } from "hono";
import { makeUserId } from "../../domain/user/user.value-objects";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import { log } from "../../infrastructure/monitoring/logger";
import type { OrderService } from "../order/order.service";

const CreatePromptPayBody = type({
  orderId: "string >= 1",
});

export function registerPromptPayRoutes(
  app: Hono,
  orderService: OrderService,
  verifier: PasetoVerifierService,
  commerceUrl: string,
  internalSecret: string
): void {
  app.post("/api/payment/promptpay/create", requireAuth(verifier), async (c) => {
    const body = await c.req.json();
    const validated = CreatePromptPayBody(body);
    if (validated instanceof type.errors) return c.json({ error: validated.summary }, 400);

    const userId = makeUserId(c.get("userId") as string);

    const orderResult = await orderService.getOrder(userId, validated.orderId);
    if (!orderResult || "error" in orderResult) {
      return c.json({ error: "Order not found" }, 404);
    }

    if ((orderResult as { status?: string }).status !== "pending") {
      return c.json({ error: "Order is not in pending state" }, 409);
    }

    const amountCents =
      (orderResult as { totalCents?: number; totalAmountInCents?: number }).totalCents ??
      (orderResult as { totalAmountInCents?: number }).totalAmountInCents ??
      0;
    const currency = (orderResult as { currency?: string }).currency ?? "THB";

    try {
      const res = await fetch(`${commerceUrl}/payment/promptpay/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({ orderId: validated.orderId, amountCents, currency }),
      });

      const data = (await res.json()) as { ok: boolean; value?: unknown; error?: string };

      if (!(res.ok && data.ok)) {
        log.warn("PromptPay create failed", { orderId: validated.orderId, error: data.error });
        return c.json({ error: data.error ?? "Failed to create PromptPay charge" }, 502);
      }

      return c.json(data.value);
    } catch (cause) {
      log.error("PromptPay create network error", { error: String(cause) });
      return c.json({ error: "Commerce service unavailable" }, 503);
    }
  });

  app.get("/api/payment/promptpay/:chargeId/status", requireAuth(verifier), async (c) => {
    const chargeId = c.req.param("chargeId");

    try {
      const res = await fetch(`${commerceUrl}/payment/promptpay/${chargeId}/status`);
      const data = (await res.json()) as { ok: boolean; value?: unknown; error?: string };

      if (!(res.ok && data.ok)) {
        return c.json({ error: data.error ?? "Status unavailable" }, 502);
      }

      return c.json(data.value);
    } catch (cause) {
      log.error("PromptPay status network error", { chargeId, error: String(cause) });
      return c.json({ error: "Commerce service unavailable" }, 503);
    }
  });
}
