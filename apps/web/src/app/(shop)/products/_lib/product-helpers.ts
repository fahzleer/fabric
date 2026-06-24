import type { ProductGenre, ProductSummary } from "@/domain/product/types";

export type { ProductGenre };

export const GENRE_LABELS: Record<ProductGenre, string> = {
  emo: "Emo",
  deathcore: "Deathcore",
  punk: "Punk",
  metal: "Metal",
  hardcore: "Hardcore",
};

export const CATEGORY_LABELS: Record<ProductSummary["category"], string> = {
  basic: "Basic",
  premium: "Premium",
  limited_edition: "Limited",
  custom: "Custom",
};

export type PriceRange = "under-500" | "500-1000" | "1000-2000" | "2000-plus";

export const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  "under-500": "ต่ำกว่า ฿500",
  "500-1000": "฿500 – ฿1,000",
  "1000-2000": "฿1,000 – ฿2,000",
  "2000-plus": "฿2,000 ขึ้นไป",
};

export function getPriceRange(amount: number): PriceRange {
  if (amount < 500) return "under-500";
  if (amount < 1000) return "500-1000";
  if (amount < 2000) return "1000-2000";
  return "2000-plus";
}

export function deduplicateProducts(products: readonly ProductSummary[]): ProductSummary[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.name.value)) return false;
    seen.add(p.name.value);
    return true;
  });
}

export type ProductListItem = ProductSummary & {
  readonly priceRange: PriceRange;
  readonly categoryLabel: string;
};

export function enrichProducts(products: readonly ProductSummary[]): ProductListItem[] {
  return products.map((p) => ({
    ...p,
    priceRange: getPriceRange(p.price.amount),
    categoryLabel: CATEGORY_LABELS[p.category],
  }));
}

export function getGenreOptions(products: readonly ProductListItem[]): ProductGenre[] {
  const genres = new Set<ProductGenre>();
  for (const p of products) {
    if (p.genre) genres.add(p.genre);
  }
  const order: ProductGenre[] = ["emo", "deathcore", "punk", "metal", "hardcore"];
  return order.filter((g) => genres.has(g));
}

export function isBestSeller(
  product: ProductListItem,
  allProducts: readonly ProductListItem[]
): boolean {
  const sorted = [...allProducts].sort((a, b) => b.price.amount - a.price.amount);
  const topCount = Math.max(1, Math.ceil(allProducts.length * 0.2));
  return sorted.slice(0, topCount).some((p) => p.id.value === product.id.value);
}
