import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;

const CSRF_EXEMPT_PREFIXES = [
  "/api/health",
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/login/facebook",
  "/auth/login/google",
  "/internal",
  // Guest checkout: no Bearer token (the existing CSRF bypass below) and no
  // cookie-based session exists in cf-api to forge in the first place — the
  // guest's identity is a self-supplied email in the request body itself.
  "/api/orders",
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function seedCsrfCookie(c: Context): void {
  const existing = getCookie(c, CSRF_COOKIE_NAME);
  if (!existing) {
    const token = generateCsrfToken();
    setCookie(c, CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: "Strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  }
}

function isExemptCsrfPath(path: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function resolveSourceOrigin(c: Context): string | null {
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");
  return origin ?? (referer ? new URL(referer).origin : null);
}

function checkMutationRequest(c: Context, trusted: string | undefined): Response | null {
  if (trusted && trusted !== "*") {
    const sourceOrigin = resolveSourceOrigin(c);
    if (sourceOrigin && sourceOrigin !== trusted) {
      return c.json({ error: "CSRF: origin mismatch" }, 403);
    }
  }
  const cookieToken = getCookie(c, CSRF_COOKIE_NAME);
  const headerToken = c.req.header(CSRF_HEADER_NAME);
  if (!(cookieToken && headerToken)) {
    return c.json({ error: "CSRF: missing token" }, 403);
  }
  if (!safeCompare(cookieToken, headerToken)) {
    return c.json({ error: "CSRF: token mismatch" }, 403);
  }
  return null;
}

export function csrf(options: { trustedOrigin?: string } = {}): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    const method = c.req.method.toUpperCase();

    if (method === "GET") {
      seedCsrfCookie(c);
      return next();
    }

    if (isExemptCsrfPath(path) || !MUTATING_METHODS.has(method)) {
      return next();
    }

    const authHeader = c.req.header("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const rejection = checkMutationRequest(c, options.trustedOrigin);
    if (rejection) return rejection;

    return next();
  };
}
