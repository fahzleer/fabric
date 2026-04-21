import { type } from "arktype";
import type { Hono } from "hono";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";
import type { PayoutService } from "./payout.service";

const RequestPayoutBody = type({
  amountCents: "number.integer > 0",
  bankInfo: "string >= 5 & string <= 200",
});

const RejectBody = type({
  ownerUserId: "string >= 1",
  reason: "string >= 5 & string <= 500",
});

const ApproveBody = type({
  ownerUserId: "string >= 1",
});

function requireAdmin(c: import("hono").Context): boolean {
  const role = c.get("userRole") as string | undefined;
  return role === "admin";
}

export function registerPayoutRoutes(
  app: Hono,
  payoutService: PayoutService,
  verifier: PasetoVerifierService,
  payoutsEnabled: boolean
): void {
  app.get("/merchant/payouts/balance", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await payoutService.getBalance(userId);

    if (result._tag === "Err") {
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    return c.json(result.value);
  });

  app.get("/merchant/payouts", requireAuth(verifier), async (c) => {
    const userId = c.get("userId");
    const result = await payoutService.listPayouts(userId);

    if (result._tag === "Err") {
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    return c.json({ payouts: result.value });
  });

  app.post("/merchant/payouts/request", requireAuth(verifier), async (c) => {
    if (!payoutsEnabled) {
      return c.json(

        503
      );
    }

    const body = await c.req.json<unknown>();
    const validated = RequestPayoutBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const userId = c.get("userId");
    const result = await payoutService.requestPayout(
      userId,
      validated.amountCents,
      validated.bankInfo
    );

    if (result._tag === "Err") {
      const status = result.error._tag === "InsufficientBalanceError" ? 422 : 500;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json(result.value, 201);
  });

  app.get("/admin/payouts", requireAuth(verifier), async (c) => {
    if (!requireAdmin(c)) {
      return c.json({ error: "Forbidden: admin only" }, 403);
    }

    const result = await payoutService.listAllPending();

    if (result._tag === "Err") {
      return c.json({ error: result.error.message, _tag: result.error._tag }, 500);
    }

    return c.json({ payouts: result.value });
  });

  app.patch("/admin/payouts/:requestId/approve", requireAuth(verifier), async (c) => {
    if (!requireAdmin(c)) {
      return c.json({ error: "Forbidden: admin only" }, 403);
    }

    const requestId = c.req.param("requestId");
    const body = await c.req.json<unknown>();
    const validated = ApproveBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const result = await payoutService.approvePayout(requestId, validated.ownerUserId);

    if (result._tag === "Err") {
      const status = result.error._tag === "PayoutNotFoundError" ? 404 : 500;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json({ message: "Payout approved" });
  });

  app.patch("/admin/payouts/:requestId/reject", requireAuth(verifier), async (c) => {
    if (!requireAdmin(c)) {
      return c.json({ error: "Forbidden: admin only" }, 403);
    }

    const requestId = c.req.param("requestId");
    const body = await c.req.json<unknown>();
    const validated = RejectBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const result = await payoutService.rejectPayout(
      requestId,
      validated.ownerUserId,
      validated.reason
    );

    if (result._tag === "Err") {
      const status = result.error._tag === "PayoutNotFoundError" ? 404 : 500;
      return c.json({ error: result.error.message, _tag: result.error._tag }, status);
    }

    return c.json({ message: "Payout rejected" });
  });
}
