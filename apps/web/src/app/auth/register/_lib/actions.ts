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
    const raw = error instanceof Error ? error.message : "";
    const msg =
      raw.toLowerCase().includes("already") || raw.includes("422")
        ? "An account with this email already exists."
        : raw || "Registration failed. Please try again.";
    maybeError = Some(msg);
  }

  if (isSome(maybeError)) {
    redirect(`/auth/register?error=${encodeURIComponent(maybeError.value)}`);
  }

  revalidateTag("user-session", {});
  revalidateTag("user-profile", {});

  redirect("/products");
}
