import { timingSafeEqual } from "node:crypto";
import { type } from "arktype";
import type { Hono } from "hono";
import { encryptToken } from "../../infrastructure/auth/paseto-verifier.service";
import { log } from "../../infrastructure/monitoring/logger";

const BRIDGE_TOKEN_TTL_SECONDS = 30 * 60;

const IssueTokenBody = type({
  userId: "string >= 1",
  email: "string >= 3",
  role: '"customer" | "admin" | "store_owner"',
});

function verifyInternalSecret(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function parseIssueTokenBody(
  c: import("hono").Context
): Promise<typeof IssueTokenBody.infer | null | { validationError: string }> {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const validated = IssueTokenBody(body);
  if (validated instanceof type.errors) return { validationError: validated.summary };
  return validated;
}

export function registerInternalRoutes(app: Hono, pasetoKey: string, internalSecret: string): void {
  app.post("/internal/issue-token", async (c) => {
    const provided = c.req.header("x-internal-secret") ?? "";
    if (!verifyInternalSecret(provided, internalSecret)) {
      log.warn("/internal/issue-token: unauthorized attempt", {
        ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
      });
      return c.json({ error: "Unauthorized" }, 401);
    }

    const parsed = await parseIssueTokenBody(c);
    if (parsed === null) return c.json({ error: "Request body must be JSON" }, 400);
    if (parsed !== null && "validationError" in parsed) {
      return c.json({ error: parsed.validationError }, 400);
    }

    const validated = parsed as typeof IssueTokenBody.infer;
    const payload = {
      sub: validated.userId,
      email: validated.email,
      role: validated.role,
      jti: crypto.randomUUID(),
    };

    const result = await encryptToken(payload, pasetoKey, BRIDGE_TOKEN_TTL_SECONDS);
    if (result._tag === "Err") {
      log.error("/internal/issue-token: encryption failed", { error: result.error.message });
      return c.json({ error: "Token issuance failed" }, 500);
    }

    return c.json({ accessToken: result.value });
  });
}
