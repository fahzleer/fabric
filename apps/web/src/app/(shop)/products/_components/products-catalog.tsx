"use client";

import { useState } from "react";
import type { ProductListItem } from "../_lib/product-helpers";
import { type FilterState, ProductFilters } from "./product-filters";
import { ProductGrid } from "./product-grid";

const DEFAULT_FILTERS: FilterState = {
  genres: [],
  priceRanges: [],
  sort: "default",
};

type ProductsCatalogProps = {
  readonly products: readonly ProductListItem[];
};

export function ProductsCatalog({ products }: ProductsCatalogProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  return (
    <div id="catalog" className="space-y-4 scroll-mt-24">
      <ProductFilters products={products} filters={filters} onChange={setFilters} />
      <ProductGrid products={products} filters={filters} />
    </div>
  );
}
