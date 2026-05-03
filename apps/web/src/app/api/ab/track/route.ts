import { track } from "@/lib/ab-testing";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    experimentId?: string;
    eventType?: string;
    metadata?: Record<string, unknown>;
  };

  const { experimentId, eventType, metadata } = body;
  if (!(experimentId && eventType)) {
    return NextResponse.json({ error: "experimentId and eventType required" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  await track(experimentId, eventType, userId, metadata);
  return NextResponse.json({ ok: true });
}
