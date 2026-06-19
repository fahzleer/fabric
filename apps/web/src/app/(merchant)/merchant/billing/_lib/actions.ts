"use server";

import { validateCsrfOrigin } from "@/lib/csrf";
import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function openBillingPortalAction() {
  await validateCsrfOrigin();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/billing?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.getBillingPortalUrl();
  if (isErr(result)) {
    redirect(`/merchant/billing?error=${encodeURIComponent(result.error)}`);
  }

  redirect(result.value);
}

export async function subscribePlanAction(formData: FormData) {
  await validateCsrfOrigin();

  const planId = String(formData.get("planId") ?? "") as
    | "starter"
    | "professional"
    | "enterprise"
    | "";
  if (!planId) {
    redirect(`/merchant/billing?error=${encodeURIComponent("Plan is required.")}`);
  }

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/billing?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.subscribeToPlan(planId);
  if (isErr(result)) {
    redirect(`/merchant/billing?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/merchant/billing");
  revalidatePath("/merchant/dashboard");
  redirect("/merchant/billing?success=Plan+upgraded+successfully");
}

export async function cancelSubscriptionAction() {
  await validateCsrfOrigin();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/billing?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.cancelSubscription();
  if (isErr(result)) {
    redirect(`/merchant/billing?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/merchant/billing");
  revalidatePath("/merchant/dashboard");
  redirect(
    "/merchant/billing?success=Subscription+cancelled+%E2%80%94+access+continues+until+period+end"
  );
}
