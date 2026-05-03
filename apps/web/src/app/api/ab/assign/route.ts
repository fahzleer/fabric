import { assign } from "@/lib/ab-testing";
import { auth } from "@/lib/auth";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const experimentId = searchParams.get("experimentId");
  if (!experimentId) {
    return NextResponse.json({ error: "experimentId required" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;

  // Ensure anonymous users get a stable key cookie
  const jar = await cookies();
  if (!(userId || jar.get("_ab_uid"))) {
    const key = crypto.randomUUID();
    jar.set("_ab_uid", key, {
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  const variantId = await assign(experimentId, userId);
  return NextResponse.json({ variantId });
}
