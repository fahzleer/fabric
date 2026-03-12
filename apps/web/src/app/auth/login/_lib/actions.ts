"use server";

import { adminDb } from "@/infrastructure/db/admin-db";
import { logError, logUserAction } from "@/lib/analytics";
import { auth } from "@/lib/auth";
import { user as userTable } from "@/lib/auth-schema";
import { validateCsrfOrigin } from "@/lib/csrf";
import type { Maybe } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  await validateCsrfOrigin();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const callbackUrl = (formData.get("callbackUrl") as string) || "/products";

  let maybeError: Maybe<string> = None();
  let maybeRole: Maybe<string> = None();

  try {
    const result = await auth.api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: await headers(),
    });
    const userId = result.user.id;
    const rows = await adminDb
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    const role = rows[0]?.role;
    if (role) maybeRole = Some(role);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Invalid email or password.";
    maybeError = Some(msg);

    logError(error instanceof Error ? error : new Error("Login failed"), {
      action: "login_failed",
      email,
    });
  }

  if (isSome(maybeError)) {
    const encodedMsg = encodeURIComponent(maybeError.value);
    redirect(`/auth/login?error=${encodedMsg}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  revalidateTag("user-session", {});
  revalidateTag("user-profile", {});

  logUserAction("login", email, { callbackUrl });

  if (isSome(maybeRole)) {
    if (maybeRole.value === "admin") redirect("/admin");
    if (maybeRole.value === "store_owner") redirect("/merchant/dashboard");
  }

  redirect(callbackUrl);
}
