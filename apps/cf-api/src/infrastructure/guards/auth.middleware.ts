import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@fabric/types";
import type { Context, MiddlewareHandler } from "hono";
import { runWithRequestSignal } from "../../shared/abort/abort-context";
import type { PasetoVerifierService } from "../auth/paseto-verifier.service";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userRole: UserRole;
    userEmail: string;
    requestSignal: AbortSignal;
  }
}

export function requireAuth(verifier: PasetoVerifierService): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("authorization");
    if (!authHeader) {
      return c.json({ error: "Unauthorized", _tag: "MissingAuthHeader" }, 401);
    }

    const result = await verifier.verify(authHeader.replace("Bearer ", "").trim());
    if (result._tag === "Err") {
      return c.json({ error: "Unauthorized", _tag: result.error._tag }, 401);
    }

    c.set("userId", result.value.sub);
    c.set("userRole", result.value.role as UserRole);
    c.set("userEmail", result.value.email);
    await next();
  };
}

export function requireRole(...roles: UserRole[]): MiddlewareHandler {
  return async (c, next) => {
    const role = c.get("userRole");
    if (!(role && roles.includes(role))) {
      return c.json({ error: "Forbidden", _tag: "InsufficientRole", required: roles }, 403);
    }
    await next();
  };
}

import { CacheKeys, type MemcachedAdapter } from "@fabric/cache";

export function throttle(
  memcached: MemcachedAdapter,
  opts: { limit: number; windowMs: number }
): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header("x-real-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const key = CacheKeys.rateLimitKey(ip, c.req.path);
    const ttlSeconds = Math.ceil(opts.windowMs / 1000);

    const count = await memcached.increment(key, ttlSeconds);
    if (count !== null && count > opts.limit) {
      c.header("X-RateLimit-Limit", String(opts.limit));
      c.header("X-RateLimit-Remaining", "0");
      c.header("Retry-After", String(ttlSeconds));
      return c.json({ error: "Too Many Requests", _tag: "RateLimitExceeded" }, 429);
    }

    if (count !== null) {
      c.header("X-RateLimit-Limit", String(opts.limit));
      c.header("X-RateLimit-Remaining", String(Math.max(0, opts.limit - count)));
    }
    await next();
  };
}

export function internalSecret(secret: string): MiddlewareHandler {
  return async (c, next) => {
    const signature = c.req.header("x-webhook-signature");
    if (!signature) {
      return c.json({ error: "Forbidden", _tag: "MissingWebhookSignature" }, 403);
    }

    const body = await c.req.text();
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");

    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return c.json({ error: "Forbidden", _tag: "InvalidWebhookSignature" }, 403);
    }

    await next();
  };
}

export function attachRequestSignal(): MiddlewareHandler {
  return async (c, next) => {
    const signal = c.req.raw.signal;
    c.set("requestSignal", signal);
    await runWithRequestSignal(signal, () => next());
  };
}

export function getResolvedUser(c: Context) {
  return {
    userId: c.get("userId"),
    role: c.get("userRole"),
    email: c.get("userEmail"),
  };
}

export function getRequestSignal(c: Context): AbortSignal | null {
  return c.get("requestSignal") ?? null;
}
