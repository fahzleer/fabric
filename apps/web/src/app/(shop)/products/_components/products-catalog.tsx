"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ProductGenre, ProductListItem } from "../_lib/product-helpers";
import { type FilterState, ProductFilters } from "./product-filters";
import { ProductGrid } from "./product-grid";

const VALID_GENRES: readonly ProductGenre[] = ["emo", "deathcore", "punk", "metal", "hardcore"];

function isProductGenre(value: string): value is ProductGenre {
  return (VALID_GENRES as readonly string[]).includes(value);
}

type ProductsCatalogProps = {
  readonly products: readonly ProductListItem[];
};

export function ProductsCatalog({ products }: ProductsCatalogProps) {
  // Seed the initial filter from the URL (lazy useState initializer — runs
  // once on mount only) so header genre-nav links (/products?genre=punk)
  // and header search (/products?q=...) land the shopper on an
  // already-filtered grid instead of requiring a second click. The URL
  // isn't kept in sync with later in-page filter changes.
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => {
    const genreParam = searchParams.get("genre");
    const genres: ProductGenre[] = genreParam && isProductGenre(genreParam) ? [genreParam] : [];
    return {
      genres,
      priceRanges: [],
      sort: "default",
      query: searchParams.get("q") ?? "",
    };
  });

  return (
    <div id="catalog" className="space-y-4 scroll-mt-24">
      <ProductFilters products={products} filters={filters} onChange={setFilters} />
      <ProductGrid products={products} filters={filters} />
    </div>
  );
}
