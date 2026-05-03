import Elysia from "elysia";

interface TokenPayload {
  sub?:   string;
  email?: string;
  role?:  string;
  exp?:   number;
}

function decodeToken(authHeader: string | null): TokenPayload | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const raw     = authHeader.slice(7);
    const json    = Buffer.from(raw, "base64url").toString("utf8");
    const payload = JSON.parse(json) as TokenPayload;
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Elysia plugin that rejects unauthenticated requests with 401 and injects
 *  { userId, email, role } into the handler context. */
export function requireAuth() {
  return new Elysia({ name: "require-auth" })
    .derive({ as: "global" }, ({ request }) => ({
      _authPayload: decodeToken(request.headers.get("Authorization")),
    }))
    .onBeforeHandle({ as: "scoped" }, ({ _authPayload, status }) => {
      if (!_authPayload) return status(401, { error: "Unauthorized" });
      return undefined;
    })
    .resolve({ as: "global" }, ({ _authPayload }) => ({
      userId: (_authPayload?.sub   ?? "")         as string,
      email:  (_authPayload?.email ?? "")         as string,
      role:   (_authPayload?.role  ?? "customer") as string,
    }));
}

/** Elysia plugin that requires a specific role (admin always passes).
 *  Rejects with 401 if not authenticated, 403 if wrong role. */
export function requireRole(requiredRole: "store_owner" | "admin") {
  return new Elysia({ name: `require-role-${requiredRole}` })
    .use(requireAuth())
    .onBeforeHandle({ as: "scoped" }, ({ role, status }) => {
      if (role !== requiredRole && role !== "admin") {
        return status(403, { error: "Forbidden" });
      }
      return undefined;
    });
}
