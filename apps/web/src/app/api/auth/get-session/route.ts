import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json(
      { session: null },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const user = session.user as { id: string; email: string; role?: string };

  const pasetoRole =
    user.role === "user" || !user.role ? "customer" : user.role;

  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        role: pasetoRole,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { session: null },
        {
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    const data = (await res.json()) as { accessToken?: string };
    const token = data.accessToken ?? null;

    return NextResponse.json({ session: { token } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { session: null },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
