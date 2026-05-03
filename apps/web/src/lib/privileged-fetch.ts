import { auth } from "@/lib/auth";
import { None, Some, isSome } from "@fabric/types";
import type { Maybe } from "@fabric/types";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const TOKEN_ISSUE_SECRET = process.env.TOKEN_ISSUE_SECRET ?? "";

async function issuePrivilegedToken(): Promise<Maybe<string>> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return None();

  const user = session.user as { id: string; email: string; role?: string };
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": TOKEN_ISSUE_SECRET,
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role === "user" || !user.role ? "customer" : user.role,
      }),
      cache: "no-store",
    });
    if (!res.ok) return None();
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ? Some(data.accessToken) : None();
  } catch {
    return None();
  }
}

/**
 * Fetch wrapper that attaches a short-lived privileged PASETO token (scope: "privileged", 120s TTL).
 * Use for server-side calls to merchant/admin routes that require requirePrivileged() middleware.
 */
export async function privilegedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const maybeToken = await issuePrivilegedToken();
  if (!isSome(maybeToken)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${maybeToken.value}`,
    ...(init.headers as Record<string, string> | undefined),
  };

  return fetch(url, { ...init, headers, cache: "no-store" });
}
