"use server";

import { adminDb } from "@/infrastructure/db/admin-db";
import { auth } from "@/lib/auth";
import { user as userTable } from "@/lib/auth-schema";
import { validateCsrfOrigin } from "@/lib/csrf";
import { createMerchantApi } from "@/lib/merchant-api";
import { type Maybe, None, Some, isSome } from "@fabric/types";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function validateInputs(
  password: string,
  confirmPassword: string,
  storeName: string
): Maybe<string> {
  if (password !== confirmPassword) return Some("Passwords do not match.");
  if (password.length < 8) return Some("Password must be at least 8 characters.");
  if (storeName.length < 2) return Some("Store name must be at least 2 characters.");
  return None();
}

async function signUpUser(
  name: string,
  email: string,
  password: string
): Promise<{ userId: Maybe<string>; error: Maybe<string> }> {
  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
    const id = (result as { user?: { id?: string } }).user?.id;
    return { userId: id ? Some(id) : None(), error: None() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const friendly =
      msg.toLowerCase().includes("already") || msg.includes("422")
        ? "An account with this email already exists."
        : msg || "Registration failed. Please try again.";
    return { userId: None(), error: Some(friendly) };
  }
}

async function promoteToStoreOwner(userId: string): Promise<Maybe<string>> {
  try {
    await adminDb
      .update(userTable)
      .set({ role: "store_owner", updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return None();
  } catch {
    return Some("Account created but role assignment failed. Contact support.");
  }
}

async function onboardMerchantProfile(storeName: string): Promise<void> {
  try {
    const maybeApi = await createMerchantApi();
    if (isSome(maybeApi)) {
      await maybeApi.value.onboardMerchant(storeName);
    }
  } catch {
    // Non-critical: merchant profile can be created later from the dashboard.
  }
}

export async function registerStoreAction(formData: FormData) {
  await validateCsrfOrigin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const storeName = String(formData.get("storeName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const validationError = validateInputs(password, confirmPassword, storeName);
  if (isSome(validationError)) {
    redirect(`/auth/register/store?error=${encodeURIComponent(validationError.value)}`);
  }

  const { userId, error: signUpError } = await signUpUser(name, email, password);

  if (isSome(signUpError)) {
    redirect(`/auth/register/store?error=${encodeURIComponent(signUpError.value)}`);
  }
  if (!isSome(userId)) {
    redirect(
      `/auth/register/store?error=${encodeURIComponent("Registration failed — no user ID returned.")}`
    );
  }

  const roleError = await promoteToStoreOwner(userId.value);
  if (isSome(roleError)) {
    redirect(`/auth/register/store?error=${encodeURIComponent(roleError.value)}`);
  }

  await auth.api.signInEmail({
    body: { email, password },
    headers: await headers(),
  });

  await onboardMerchantProfile(storeName);

  redirect("/merchant/dashboard");
}
