"use server";

import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import { redirect } from "next/navigation";

export async function onboardMerchantAction(formData: FormData) {
  const storeName = (formData.get("storeName") as string | null)?.trim() ?? "";

  if (!storeName || storeName.length < 2) {
    redirect("/merchant/onboarding?error=Store+name+must+be+at+least+2+characters");
  }

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect("/merchant/onboarding?error=Session+expired.+Please+refresh.");
  }

  const result = await maybeApi.value.onboardMerchant(storeName);

  if (!result.ok) {
    const msg = encodeURIComponent(result.error ?? "Onboarding failed");
    redirect(`/merchant/onboarding?error=${msg}`);
  }

  redirect("/merchant/onboarding?success=1");
}
