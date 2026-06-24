"use client";

import { useMemo } from "react";
import { type ProductListItem, isBestSeller } from "../_lib/product-helpers";
import { ProductCard } from "./product-card";
import type { FilterState } from "./product-filters";

function applyFilters(
  products: readonly ProductListItem[],
  filters: FilterState
): ProductListItem[] {
  let result = [...products];

  if (filters.genres.length > 0) {
    result = result.filter((p) => p.genre !== undefined && filters.genres.includes(p.genre));
  }

  if (filters.priceRanges.length > 0) {
    result = result.filter((p) => filters.priceRanges.includes(p.priceRange));
  }

  switch (filters.sort) {
    case "price-asc":
      result.sort((a, b) => a.price.amount - b.price.amount);
      break;
    case "price-desc":
      result.sort((a, b) => b.price.amount - a.price.amount);
      break;
    case "name-asc":
      result.sort((a, b) => a.name.value.localeCompare(b.name.value, "th"));
      break;
    default:
      break;
  }

  return result;
}

function getBadge(
  product: ProductListItem,
  allProducts: readonly ProductListItem[]
): "bestseller" | "premium" | "limited" | undefined {
  if (isBestSeller(product, allProducts)) return "bestseller";
  if (product.category === "limited_edition") return "limited";
  if (product.category === "premium") return "premium";
  return undefined;
}

type ProductGridProps = {
  readonly products: readonly ProductListItem[];
  readonly filters: FilterState;
};

export function ProductGrid({ products, filters }: ProductGridProps) {
  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        ไม่พบสินค้าที่ตรงกับตัวกรอง ลองปรับตัวกรองใหม่
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">แสดง {filtered.length} รายการ</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((product) => (
          <ProductCard
            key={product.id.value}
            product={product}
            badge={getBadge(product, products)}
          />
        ))}
      </div>
    </div>
  );
}
