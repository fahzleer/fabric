"use server";

import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import { revalidatePath } from "next/cache";

export type PayoutActionState = {
  error?: string;
  success?: boolean;
};

export async function approvePayoutAction(
  requestId: string,
  ownerUserId: string
): Promise<PayoutActionState> {
  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) return { error: "Not authenticated" };
  const api = maybeApi.value;
  if (api.role !== "admin") return { error: "Forbidden: admin only" };

  const result = await api.approvePayout(requestId, ownerUserId);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/payouts");
  return { success: true };
}

export async function rejectPayoutAction(
  requestId: string,
  ownerUserId: string,
  reason: string
): Promise<PayoutActionState> {
  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) return { error: "Not authenticated" };
  const api = maybeApi.value;
  if (api.role !== "admin") return { error: "Forbidden: admin only" };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Rejection reason is required" };

  const result = await api.rejectPayout(requestId, ownerUserId, trimmedReason);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/payouts");
  return { success: true };
}
