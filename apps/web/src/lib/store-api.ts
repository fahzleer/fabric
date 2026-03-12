import type { Maybe } from "@fabric/types";
import { None, Some } from "@fabric/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

export type StoreInfo = {
  slug: string;
  storeName: string;
  ownerId: string;
  productCount: number;
  plan: string;
};

export type StorefrontProduct = {
  id: { value: string };
  name: { value: string };
  price: { amount: number; currency: string };
  primaryImage: { url: string; altText: string };
  tagline: string;
  inStock: boolean;
  category: string;
};

export type StorefrontProductList = {
  data: StorefrontProduct[];
  total: number;
  page: number;
  perPage: number;
};

export async function fetchStoreBySlug(slug: string): Promise<Maybe<StoreInfo>> {
  try {
    const res = await fetch(`${API_BASE}/api/stores/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return None();
    return Some((await res.json()) as StoreInfo);
  } catch {
    return None();
  }
}

export async function fetchStoreProducts(
  slug: string,
  page = 1,
  perPage = 20
): Promise<StorefrontProductList> {
  try {
    const url = `${API_BASE}/api/stores/${encodeURIComponent(slug)}/products?page=${page}&perPage=${perPage}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { data: [], total: 0, page, perPage };
    return (await res.json()) as StorefrontProductList;
  } catch {
    return { data: [], total: 0, page, perPage };
  }
}

export async function fetchStoreByOwnerId(
  ownerId: string
): Promise<Maybe<Pick<StoreInfo, "slug" | "storeName">>> {
  try {
    const res = await fetch(`${API_BASE}/api/stores/by-owner/${encodeURIComponent(ownerId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return None();
    const data = (await res.json()) as { slug?: string; storeName: string };
    if (!data.slug) return None();
    return Some({ slug: data.slug, storeName: data.storeName });
  } catch {
    return None();
  }
}

export async function fetchStoreForProduct(
  productId: string
): Promise<Maybe<Pick<StoreInfo, "slug" | "storeName">>> {
  try {
    const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/store`, {
      cache: "no-store",
    });
    if (!res.ok) return None();
    const data = (await res.json()) as { slug?: string; storeName: string };
    if (!data.slug) return None();
    return Some({ slug: data.slug, storeName: data.storeName });
  } catch {
    return None();
  }
}
