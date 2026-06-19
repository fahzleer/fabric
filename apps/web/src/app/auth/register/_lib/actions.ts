"use server";

import { auth } from "@/lib/auth";
import { validateCsrfOrigin } from "@/lib/csrf";
import type { Maybe } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function registerAction(formData: FormData) {
  await validateCsrfOrigin();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (password !== confirmPassword) {
    const msg = encodeURIComponent("Passwords do not match.");
    redirect(`/auth/register?error=${msg}`);
  }
  if (password.length < 8) {
    const msg = encodeURIComponent("Password must be at least 8 characters.");
    redirect(`/auth/register?error=${msg}`);
  }

  let maybeError: Maybe<string> = None();

  try {
    await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);

    console.error("[registerAction] signUpEmail failed", {
      email,
      error: raw,
      cause: error instanceof Error ? error.cause : undefined,
    });

    if (raw.toLowerCase().includes("already") || raw.includes("422")) {
      maybeError = Some("An account with this email already exists.");
    } else if (process.env.NODE_ENV !== "production" && raw) {
      // In dev, surface the actual error so DB/config issues are visible
      // in the URL bar instead of being swallowed by a generic message.
      maybeError = Some(`Registration failed: ${raw}`);
    } else {
      maybeError = Some("Registration failed. Please try again.");
    }
  }

  if (isSome(maybeError)) {
    redirect(`/auth/register?error=${encodeURIComponent(maybeError.value)}`);
  }

  revalidateTag("user-session", {});
  revalidateTag("user-profile", {});

  redirect("/products");
}
