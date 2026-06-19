import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

async function issueMerchantToken(userId: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ userId, email, role: "store_owner" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { id: string; email: string; role?: string };
  const role = user.role ?? "customer";
  if (role !== "store_owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json()) as { status?: string };
  if (body.status !== "shipped" && body.status !== "delivered") {
    return NextResponse.json({ error: "status must be 'shipped' or 'delivered'" }, { status: 400 });
  }

  const token = await issueMerchantToken(user.id, user.email);
  if (!token) return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 });

  const res = await fetch(`${API_BASE}/merchant/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: body.status }),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}
