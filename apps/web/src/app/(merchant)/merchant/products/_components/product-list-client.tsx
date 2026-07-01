"use client";

import {
  merchantAllProductsAtom,
  merchantCategoryAtom,
  merchantQueryAtom,
  merchantRawQueryAtom,
  merchantResultsAtom,
  merchantStatusAtom,
} from "@/application/atoms/merchant-products.atoms";
import type { MerchantProduct } from "@/lib/merchant-api";
import { formatPrice } from "@/lib/price";
import { useAtom, useAtomValue } from "@effect-atom/atom-react";
import Link from "next/link";
import { useLayoutEffect, useMemo } from "react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-success/20 text-success border-success/40",
  draft: "bg-muted/50 text-muted-foreground border-border",
  archived: "bg-destructive/20 text-destructive border-destructive/40",
};

export function ProductListClient({ initialProducts }: { initialProducts: MerchantProduct[] }) {
  const [, setAllProducts] = useAtom(merchantAllProductsAtom);

  useLayoutEffect(() => {
    setAllProducts(initialProducts);
  }, [initialProducts, setAllProducts]);

  return <FilterView />;
}

function FilterView() {
  const results = useAtomValue(merchantResultsAtom);
  const allProducts = useAtomValue(merchantAllProductsAtom);

  // The search input writes to the raw atom; the debounced derivation
  // (merchantQueryAtom) is what the filter actually reads. 150ms is
  // short enough to feel instant, long enough to skip 5-6 keystrokes
  // for a fast typist.
  const [rawQuery, setRawQuery] = useAtom(merchantRawQueryAtom);
  const [category, setCategory] = useAtom(merchantCategoryAtom);
  const [status, setStatus] = useAtom(merchantStatusAtom);
  const debouncedQuery = useAtomValue(merchantQueryAtom);

  // Categories list is derived from the (stable) all-products list. Memoize
  // so it doesn't recompute on every keystroke. Recomputes only when the
  // product set changes (e.g. on a fresh page load).
  const categories = useMemo(
    () => ["all", ...Array.from(new Set(allProducts.map((p) => p.category))).sort()],
    [allProducts]
  );

  const inputCls =
    "rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-4">
      {/* Search controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name…"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className={`${inputCls} min-w-40 flex-1`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
            {debouncedQuery !== rawQuery && (
              <span className="ml-2 italic text-muted-foreground">…typing</span>
            )}
          </span>
        </div>
        {results.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No products match</p>
        ) : (
          <ProductTable products={results} />
        )}
      </div>
    </div>
  );
}

function ProductTable({ products }: { products: MerchantProduct[] }) {
  if (products.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((p) => {
            const imgs = p.images ?? [];
            const img = imgs.find((i) => i.isPrimary) ?? imgs[0];
            return (
              <tr key={p.id} className="transition-colors hover:bg-muted">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {img && (
                      <img
                        src={img.url}
                        alt={img.alt}
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 capitalize text-foreground">
                  {p.category.replace(/_/g, " ")}
                </td>
                <td className="px-5 py-4 font-medium text-foreground">
                  {formatPrice({ amount: p.price, currency: p.priceCurrency })}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[p.status] ?? STATUS_BADGE.draft}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/merchant/products/${p.id}/edit`}
                    className="text-xs font-medium text-success hover:text-success"
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
