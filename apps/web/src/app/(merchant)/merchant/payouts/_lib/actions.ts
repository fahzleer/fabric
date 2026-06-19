"use server";

import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import { revalidatePath } from "next/cache";

export type RequestPayoutState = {
  error?: string;
  success?: boolean;
};

export async function requestPayoutAction(
  _prev: RequestPayoutState,
  formData: FormData
): Promise<RequestPayoutState> {
  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) return { error: "Not authenticated" };
  const api = maybeApi.value;

  const amountBaht = Number(formData.get("amountBaht"));
  const bankInfo = String(formData.get("bankInfo") ?? "").trim();

  if (!amountBaht || Number.isNaN(amountBaht) || amountBaht <= 0) {
    return { error: "Please enter a valid withdrawal amount" };
  }

  if (amountBaht < 100) {
    return { error: "Minimum withdrawal is ฿100" };
  }

  if (!bankInfo) {
    return { error: "Bank account information is required" };
  }

  const amountCents = Math.round(amountBaht * 100);
  const result = await api.requestPayout(amountCents, bankInfo);

  if (isErr(result)) {
    if (result.error.startsWith("[InsufficientBalanceError]")) {
      return { error: "Insufficient available balance for this withdrawal amount" };
    }
    return { error: result.error };
  }

  revalidatePath("/merchant/payouts");
  return { success: true };
}
