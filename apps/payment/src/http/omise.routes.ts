/**
 * Omise / PromptPay routes.
 *
 *   POST /api/payment/promptpay/create        — create PromptPay charge (QR code)
 *   GET  /api/payment/promptpay/:chargeId/status — poll charge status
 *   POST /api/payment/omise/webhook           — Omise webhook (charge.complete)
 */

import Elysia, { t } from "elysia";
import { Effect, type Layer } from "effect";
import { bootRuntime } from "@fabric/effect-http";
import { type OrderId, type PaymentMethod } from "../domain/payment.ts";
import { PaymentService } from "../application/payment.service.ts";

const OMISE_SECRET_KEY    = process.env["OMISE_SECRET_KEY"]    ?? "";
const OMISE_WEBHOOK_SECRET = process.env["OMISE_WEBHOOK_SECRET"] ?? "";

// ── Omise API helpers ─────────────────────────────────────────────────────────

async function createOmisePromptPayCharge(
  amount: number,
  currency: string,
  orderId: string
): Promise<{ id: string; status: string; source?: { scannable_code?: { image?: { download_uri?: string } } } }> {
  if (!OMISE_SECRET_KEY) {
    return {
      id:     `chrg_dev_${crypto.randomUUID().slice(0, 8)}`,
      status: "pending",
      source: { scannable_code: { image: { download_uri: "" } } },
    };
  }

  const creds = Buffer.from(`${OMISE_SECRET_KEY}:`).toString("base64");
  const res = await fetch("https://api.omise.co/charges", {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${creds}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: currency.toLowerCase(),
      source:   { type: "promptpay" },
      metadata: { orderId },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Omise error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function getOmiseChargeStatus(chargeId: string) {
  if (!OMISE_SECRET_KEY) {
    return { id: chargeId, status: "pending" };
  }

  const creds = Buffer.from(`${OMISE_SECRET_KEY}:`).toString("base64");
  const res = await fetch(`https://api.omise.co/charges/${chargeId}`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) return { id: chargeId, status: "failed" };
  return res.json();
}

// ── Webhook signature verification ────────────────────────────────────────────
// Omise signs webhooks with HMAC-SHA256 of the raw body.

async function verifyOmiseSignature(body: string, signature: string): Promise<boolean> {
  if (!OMISE_WEBHOOK_SECRET) return true; // skip in dev without credentials
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(OMISE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hex = Buffer.from(mac).toString("hex");
    return hex === signature;
  } catch {
    return false;
  }
}

// ── Route builder ─────────────────────────────────────────────────────────────

export async function buildOmiseRoutes(layer: Layer.Layer<PaymentService>) {
  const runtime = await bootRuntime(layer);
  const run = <A, E>(effect: Effect.Effect<A, E, PaymentService>): Promise<A> =>
    runtime.runPromise(effect);

  return new Elysia()

    // POST /api/payment/promptpay/create
    .post(
      "/api/payment/promptpay/create",
      async ({ body, set }) => {
        try {
          const b = body as { orderId?: string; amount?: number; currency?: string };
          const charge = await createOmisePromptPayCharge(
            b.amount   ?? 0,
            b.currency ?? "THB",
            b.orderId  ?? ""
          );
          return {
            chargeId:  charge.id,
            status:    charge.status,
            qrCodeUrl: charge.source?.scannable_code?.image?.download_uri ?? "",
          };
        } catch (e) {
          set.status = 502;
          return { error: "PromptPayCreateFailed", message: String(e) };
        }
      },
      {
        body: t.Object({
          orderId:  t.Optional(t.String()),
          amount:   t.Optional(t.Number()),
          currency: t.Optional(t.String()),
        }),
      }
    )

    // GET /api/payment/promptpay/:chargeId/status
    .get("/api/payment/promptpay/:chargeId/status", async ({ params }) => {
      const charge = await getOmiseChargeStatus(params.chargeId);
      return { chargeId: params.chargeId, status: (charge as { status?: string }).status ?? "pending" };
    })

    // POST /api/payment/omise/webhook — Omise sends this on charge.complete
    .post(
      "/api/payment/omise/webhook",
      async ({ request, set }) => {
        const rawBody = await request.text();
        const sig     = request.headers.get("X-Omise-Signature") ?? "";

        if (!(await verifyOmiseSignature(rawBody, sig))) {
          set.status = 401;
          return { error: "InvalidSignature" };
        }

        let event: { key?: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(rawBody) as typeof event;
        } catch {
          set.status = 400;
          return { error: "InvalidPayload" };
        }

        if (event.key !== "charge.complete" || !event.data) {
          return { ok: true, skipped: true };
        }

        const charge    = event.data;
        const chargeId  = String(charge["id"] ?? "");
        const status    = String(charge["status"] ?? "");
        const metadata  = (charge["metadata"] ?? {}) as Record<string, unknown>;
        const orderId   = String(metadata["orderId"] ?? "");
        const amount    = Number(charge["amount"] ?? 0);
        const currency  = String(charge["currency"] ?? "THB").toUpperCase();
        const failCode  = String(charge["failure_code"] ?? "failed");

        if (!orderId) {
          return { ok: true, skipped: true };
        }

        try {
          await run(
            Effect.gen(function* () {
              const svc     = yield* PaymentService;
              let   payment = yield* svc.getByOrder(orderId as OrderId).pipe(
                Effect.catchTag("PaymentNotFoundError", () =>
                  svc.initiate({
                    orderId:     orderId as OrderId,
                    amountCents: amount,
                    currency,
                    method:      "promptpay" as PaymentMethod,
                  })
                )
              );

              if (status === "successful") {
                // svc.succeed() publishes payment.succeeded to Kafka.
                // Order service consumes that event and marks the order paid (ADR 0008).
                yield* svc.succeed(payment.id, chargeId).pipe(
                  Effect.catchTag("PaymentAlreadyProcessedError", () => Effect.void)
                );
              } else if (status === "failed") {
                yield* svc.fail(payment.id, failCode).pipe(
                  Effect.catchTag("PaymentAlreadyProcessedError", () => Effect.void),
                  Effect.catchTag("PaymentNotFoundError", () => Effect.void)
                );
              }
            })
          );
        } catch (e) {
          console.error("[payment] webhook processing error:", e);
          set.status = 500;
          return { error: "ProcessingFailed" };
        }

        return { ok: true };
      }
    );
}
