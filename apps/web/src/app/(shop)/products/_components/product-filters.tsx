"use client";

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
    onChange({ genres: [], priceRanges: [], sort: "default" });
  }

  const hasActiveFilters = filters.genres.length > 0 || filters.priceRanges.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {genreOptions.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.genres.includes(genre)
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {GENRE_LABELS[genre]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-gray-500">
            เรียงตาม
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-gray-900 focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        <span className="text-sm text-gray-500">ราคา:</span>
        {priceRangeOptions.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => togglePriceRange(range)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              filters.priceRanges.includes(range)
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {PRICE_RANGE_LABELS[range]}
          </button>
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-sm font-medium text-gray-500 underline hover:text-gray-900"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  );
}
