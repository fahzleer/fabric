"use server";

import { validateCsrfOrigin } from "@/lib/csrf";
import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import { revalidatePath, revalidateTag } from "next/cache";
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

function mapCreateProductError(tag: string, fallback: string): string {
  if (tag === "SubscriptionInactive")
    return "Your plan is inactive. Please activate billing first.";
  if (tag === "PlanLimitExceeded") return "Product limit reached. Please upgrade your plan.";
  if (tag === "MerchantNotFound") return "Merchant profile not found. Please complete onboarding.";
  return fallback;
}

type UpdatePayload = {
  name?: string;
  description?: string;
  price?: number;
  priceCurrency?: string;
  category?: string;
  status?: string;
  stock?: Record<string, number>;
  images?: { url: string; alt: string; isPrimary: boolean; order: number }[];
};

function buildUpdatePayload(fields: {
  name: string | undefined;
  description: string | undefined;
  price: number | undefined;
  currency: string | undefined;
  category: string | undefined;
  status: string | undefined;
  stock: Record<string, number>;
  images: { url: string; alt: string; isPrimary: boolean; order: number }[];
}): UpdatePayload {
  const payload: UpdatePayload = {};
  if (fields.name) payload.name = fields.name;
  if (fields.description !== undefined) payload.description = fields.description;
  if (fields.price) payload.price = fields.price;
  if (fields.currency) payload.priceCurrency = fields.currency;
  if (fields.category) payload.category = fields.category;
  if (fields.status) payload.status = fields.status;
  if (Object.keys(fields.stock).length > 0) payload.stock = fields.stock;
  if (fields.images.length > 0) payload.images = fields.images;
  return payload;
}

export async function createProductAction(formData: FormData) {
  await validateCsrfOrigin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "0");
  const currency = String(formData.get("priceCurrency") ?? "THB").trim() || "THB";
  const category = String(formData.get("category") ?? "basic").trim();
  const stock = parseStock(formData);
  const images = parseImages(formData);

  const price = Number.parseFloat(priceStr);

  if (!name || price <= 0 || Number.isNaN(price)) {
    redirect(`/merchant/products/new?error=${encodeURIComponent("Name and price are required.")}`);
  }

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/products/new?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.createProduct({
    name,
    ...(description ? { description } : {}),
    price,
    ...(currency !== "THB" ? { priceCurrency: currency } : {}),
    category,
    stock,
    images:
      images.length > 0
        ? images
        : [{ url: "https://placehold.co/400x400", alt: name, isPrimary: true, order: 0 }],
  });

  if (!result.ok) {
    const msg = mapCreateProductError(result._tag ?? "", result.error);
    redirect(`/merchant/products/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/merchant/products");
  revalidateTag("products", {}); // bust public product list cache
  revalidateTag(`product:${result.value.id}`, {}); // bust individual product detail cache
  redirect("/merchant/products?success=Product+created");
}

export async function updateProductAction(productId: string, formData: FormData) {
  await validateCsrfOrigin();

  const priceStr = formData.get("price");
  const stock = parseStock(formData);
  const images = parseImages(formData);

  const payload = buildUpdatePayload({
    name: String(formData.get("name") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    price: priceStr ? Number.parseFloat(String(priceStr)) : undefined,
    currency: String(formData.get("priceCurrency") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? "").trim() || undefined,
    status: String(formData.get("status") ?? "").trim() || undefined,
    stock,
    images,
  });

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/products/${productId}/edit?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.updateProduct(productId, payload);

  if (!result.ok) {
    redirect(`/merchant/products/${productId}/edit?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/merchant/products");
  revalidateTag("products", {}); // bust public product list cache
  redirect("/merchant/products?success=Changes+saved");
}
