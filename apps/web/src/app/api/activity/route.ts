import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    await fetch(`${API_BASE}/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ip ? { "x-real-ip": ip } : {}),
        ...(request.headers.get("user-agent")
          ? { "user-agent": request.headers.get("user-agent") ?? "" }
          : {}),
      },
      body: JSON.stringify(body),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
