import Elysia from "elysia";

// ── Auth middleware ───────────────────────────────────────────────────────────
//
// Gateway-level auth: validates that requests carry a bearer token.
// Token verification is delegated to the customer service in production.
// For now: simple existence check. Replace with PASETO verification.

export const authMiddleware = new Elysia({ name: "gateway/auth" })
  .derive(({ request, status }) => {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    // Public paths — no token required
    const url = new URL(request.url);
    const isPublic =
      url.pathname === "/health" ||
      url.pathname.startsWith("/health/") ||
      url.pathname === "/customers" && request.method === "POST"; // registration

    if (!isPublic && !token) {
      return { userId: null as string | null, authError: status(401, { error: "Unauthorized" }) };
    }

    return { userId: token, authError: null };
  });
