"use client";

import { Button } from "@fabric/ui";
import {
  GENRE_LABELS,
  PRICE_RANGE_LABELS,
  type PriceRange,
  type ProductGenre,
  type ProductListItem,
  getGenreOptions,
} from "../_lib/product-helpers";

export type SortOption = "default" | "price-asc" | "price-desc" | "name-asc";

export type FilterState = {
  readonly genres: ProductGenre[];
  readonly priceRanges: PriceRange[];
  readonly sort: SortOption;
  readonly query: string;
};

type ProductFiltersProps = {
  readonly products: readonly ProductListItem[];
  readonly filters: FilterState;
  readonly onChange: (filters: FilterState) => void;
};

const SORT_LABELS: Record<SortOption, string> = {
  default: "เริ่มต้น",
  "price-asc": "ราคาต่ำ – สูง",
  "price-desc": "ราคาสูง – ต่ำ",
  "name-asc": "ชื่อ ก – ฮ",
};

export function ProductFilters({ products, filters, onChange }: ProductFiltersProps) {
  const genreOptions = getGenreOptions(products);
  const priceRangeOptions = Object.keys(PRICE_RANGE_LABELS) as PriceRange[];

  function toggleGenre(genre: ProductGenre) {
    const next = filters.genres.includes(genre)
      ? filters.genres.filter((g) => g !== genre)
      : [...filters.genres, genre];
    onChange({ ...filters, genres: next });
  }

  function togglePriceRange(range: PriceRange) {
    const next = filters.priceRanges.includes(range)
      ? filters.priceRanges.filter((r) => r !== range)
      : [...filters.priceRanges, range];
    onChange({ ...filters, priceRanges: next });
  }

  function setSort(sort: SortOption) {
    onChange({ ...filters, sort });
  }

  function clearAll() {
    onChange({ genres: [], priceRanges: [], sort: "default", query: "" });
  }

  const hasActiveFilters =
    filters.genres.length > 0 || filters.priceRanges.length > 0 || filters.query.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      {filters.query.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            ผลการค้นหา: <span className="font-medium text-foreground">"{filters.query}"</span>
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...filters, query: "" })}
            className="rounded-sm text-brand hover:text-brand/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="ล้างคำค้นหา"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {genreOptions.map((genre) => (
            <Button
              key={genre}
              type="button"
              size="sm"
              variant={filters.genres.includes(genre) ? "default" : "outline"}
              onClick={() => toggleGenre(genre)}
              className="rounded-full"
            >
              {GENRE_LABELS[genre]}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-muted-foreground">
            เรียงตาม
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">ราคา:</span>
        {priceRangeOptions.map((range) => (
          <Button
            key={range}
            type="button"
            size="sm"
            variant={filters.priceRanges.includes(range) ? "default" : "outline"}
            onClick={() => togglePriceRange(range)}
            className="rounded-full"
          >
            {PRICE_RANGE_LABELS[range]}
          </Button>
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto rounded-sm text-sm font-medium text-muted-foreground underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  );
}
