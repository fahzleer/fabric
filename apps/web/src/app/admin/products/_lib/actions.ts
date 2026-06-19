"use server";

import { validateCsrfOrigin } from "@/lib/csrf";
import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseStock(formData: FormData): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^stock\[(\w+)\]$/.exec(key);
    if (match?.[1]) {
      const qty = Number.parseInt(value as string, 10);
      if (!Number.isNaN(qty) && qty > 0) stock[match[1]] = qty;
    }
  }
  return stock;
}

function parseImages(formData: FormData) {
  const raw = String(formData.get("images") ?? "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as { url: string; alt: string; isPrimary: boolean; order: number }[];
  } catch {
    return [];
  }
}

function mapCreateProductError(error: string): string {
  if (error.includes("SubscriptionInactive"))
    return "Your plan is inactive. Please activate billing first.";
  if (error.includes("PlanLimitExceeded"))
    return "Product limit reached. Please upgrade your plan.";
  if (error.includes("MerchantNotFound"))
    return "Merchant profile not found. Please complete onboarding.";
  return error;
}

export async function createAdminProductAction(formData: FormData) {
  await validateCsrfOrigin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "0");
  const currency = String(formData.get("priceCurrency") ?? "THB").trim() || "THB";
  const category = String(formData.get("category") ?? "basic").trim();
  const stock = parseStock(formData);
  const images = parseImages(formData);

  const price = Number.parseFloat(priceStr);

  if (!name || price <= 0 || Number.isNaN(price)) {
    redirect(`/admin/products/new?error=${encodeURIComponent("Name and price are required.")}`);
  }

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/admin/products/new?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.createProduct({
    name,
    ...(description ? { description } : {}),
    ...(tagline ? { tagline } : {}),
    price,
    ...(currency !== "THB" ? { priceCurrency: currency } : {}),
    category,
    stock,
    images:
      images.length > 0
        ? images
        : [{ url: "https://placehold.co/400x400", alt: name, isPrimary: true, order: 0 }],
  });

  if (isErr(result)) {
    const msg = mapCreateProductError(result.error);
    redirect(`/admin/products/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/admin/products");
  redirect("/admin/products?success=Product+created");
}
