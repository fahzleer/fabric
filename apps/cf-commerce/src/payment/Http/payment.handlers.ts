import { createHmac, timingSafeEqual } from "node:crypto";
import { Either } from "effect";
import type { Context, Hono } from "hono";
import { log } from "../../monitoring/logger";
import type { PromptPayAdapter } from "../adapters/promptpay.adapter";
import { interpretPaymentCommands } from "../interpreter/payment.interpreter";
import { processPaymentLogic } from "../logic/process-payment.logic";
import type { IPaymentGateway } from "../ports/payment-gateway.port";

interface OmiseWebhookEvent {
  readonly key: string;
  readonly data: {
    readonly id: string;
    readonly status: string;
    readonly failure_message?: string;
    readonly metadata?: { readonly orderId?: string };
  };
}

const CF_API_URL = process.env.CF_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

function verifyOmiseSignature(secret: string, rawBody: string, signature: string): boolean {
  if (!secret) return true;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

function parseOmiseEvent(rawBody: string): OmiseWebhookEvent | null {
  try {
    return JSON.parse(rawBody) as OmiseWebhookEvent;
  } catch {
    return null;
  }
}

function resolveWebhookOrderId(
  charge: OmiseWebhookEvent["data"],
  promptPay?: PromptPayAdapter
): string | undefined {
  return charge.metadata?.orderId ?? promptPay?.lookupOrderId(charge.id);
}

async function notifyPaymentResult(
  orderId: string,
  chargeId: string,
  success: boolean,
  reason: string | undefined
): Promise<void> {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      await fetch(`${CF_API_URL}/internal/payment-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({ orderId, paymentId: chargeId, success, reason }),
      });
      return;
    } catch (cause) {
      if (attempt < 1) continue;
      log.error("Omise webhook: failed to notify cf-api", { orderId, error: String(cause) });
    }
  }
}

async function handleOmiseWebhook(c: Context, promptPay: PromptPayAdapter | undefined) {
  const webhookSecret = process.env.OMISE_WEBHOOK_SECRET ?? "";
  const rawBody = await c.req.text();
  const signature = c.req.header("omise-signature") ?? "";
  if (!verifyOmiseSignature(webhookSecret, rawBody, signature)) {
    log.warn("Omise webhook: invalid signature");
    return c.json({ error: "Invalid signature" }, 401);
  }
  const event = parseOmiseEvent(rawBody);
  if (!event) return c.json({ error: "Invalid JSON" }, 400);
  if (event.key !== "charge.complete" && event.key !== "charge.create") {
    return c.json({ ok: true, skipped: true });
  }
  const charge = event.data;
  if (!charge?.id) return c.json({ ok: true, skipped: true });
  const orderId = resolveWebhookOrderId(charge, promptPay);
  if (!orderId) {
    log.warn("Omise webhook: cannot find orderId for charge", { chargeId: charge.id });
    return c.json({ ok: true, warning: "orderId not found — ignored" });
  }
  const success = charge.status === "successful";
  const reason = success ? undefined : (charge.failure_message ?? charge.status);
  log.info("Omise webhook: forwarding payment result to cf-api", {
    chargeId: charge.id,
    orderId,
    success,
  });
  await notifyPaymentResult(orderId, charge.id, success, reason);
  return c.json({ ok: true });
}

export const registerPaymentRoutes = (
  app: Hono,
  gateway: IPaymentGateway,
  promptPay?: PromptPayAdapter
): void => {
  app.post("/payment/initiate", async (c) => {
    const body = (await c.req.json()) as {
      orderId: string;
      totalCents: number;
      currency: string;
      userId: string;
      paymentToken?: string;
      paymentMethod?: "card" | "crypto" | "promptpay";
    };

    const commandsOrError = processPaymentLogic({
      orderId: body.orderId,
      totalCents: body.totalCents,
      currency: body.currency,
      userId: body.userId,
      paymentMethod: body.paymentMethod ?? "card",
      ...(body.paymentToken !== undefined && { paymentToken: body.paymentToken }),
    });

    if (Either.isLeft(commandsOrError)) {
      return c.json({ ok: false, error: commandsOrError.left }, 422);
    }

    interpretPaymentCommands(commandsOrError.right, gateway).catch(() => undefined);

    return c.json({ accepted: true }, 202);
  });

  app.post("/payment/process", async (c) => {
    const body = (await c.req.json()) as {
      orderId: string;
      totalCents: number;
      currency: string;
      userId: string;
      paymentToken?: string;
    };

    const commandsOrError = processPaymentLogic({
      orderId: body.orderId,
      totalCents: body.totalCents,
      currency: body.currency,
      userId: body.userId,
      paymentMethod: "card",
      ...(body.paymentToken !== undefined && { paymentToken: body.paymentToken }),
    });

    if (Either.isLeft(commandsOrError)) {
      return c.json({ ok: false, error: commandsOrError.left }, 422);
    }

    const result = await interpretPaymentCommands(commandsOrError.right, gateway);
    return c.json({ ok: result.success, value: result });
  });

  app.post("/payment/promptpay/create", async (c) => {
    if (!promptPay) {
      return c.json({ ok: false, error: "PromptPay not configured" }, 503);
    }

    const secret = c.req.header("x-internal-secret") ?? "";
    if (
      !INTERNAL_SECRET ||
      secret.length !== INTERNAL_SECRET.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(INTERNAL_SECRET))
    ) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = (await c.req.json()) as {
      orderId: string;
      amountCents: number;
      currency: string;
    };

    const charge = await promptPay.createCharge(body.orderId, body.amountCents, body.currency);
    if (!charge) {
      return c.json({ ok: false, error: "Failed to create PromptPay charge" }, 502);
    }

    return c.json({ ok: true, value: charge });
  });

  app.get("/payment/promptpay/:chargeId/status", async (c) => {
    if (!promptPay) {
      return c.json({ ok: false, error: "PromptPay not configured" }, 503);
    }

    const chargeId = c.req.param("chargeId");
    const result = await promptPay.getStatus(chargeId);
    return c.json({ ok: true, value: result });
  });

  app.post("/payment/omise/webhook", (c) => handleOmiseWebhook(c, promptPay));
};
