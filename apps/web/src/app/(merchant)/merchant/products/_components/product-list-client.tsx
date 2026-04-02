"use client";

import {
  type ProductFilterArg,
  merchantAllProductsAtom,
  merchantManualResultsAtom,
  merchantSearchAtom,
} from "@/application/atoms/merchant-products.atoms";
import type { MerchantProduct } from "@/lib/merchant-api";
import { formatPrice } from "@/lib/price";
import { Atom, useAtom, useAtomValue } from "@effect-atom/atom-react";
import Link from "next/link";
import { useLayoutEffect } from "react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  draft: "bg-gray-700/50 text-gray-400 border-gray-600",
  archived: "bg-red-500/20 text-red-400 border-red-500/40",
};

const filterQueryAtom = Atom.make("");
const filterCategoryAtom = Atom.make("all");
const filterStatusAtom = Atom.make("all");

export function ProductListClient({ initialProducts }: { initialProducts: MerchantProduct[] }) {
  const [, setAllProducts] = useAtom(merchantAllProductsAtom);

  useLayoutEffect(() => {
    setAllProducts(initialProducts);
  }, [initialProducts, setAllProducts]);

  return <FilterView />;
}

function FilterView() {
  const results = useAtomValue(merchantManualResultsAtom);
  const [actionResult, runSearch] = useAtom(merchantSearchAtom);
  const allProducts = useAtomValue(merchantAllProductsAtom);

  const [query, setQuery] = useAtom(filterQueryAtom);
  const [category, setCategory] = useAtom(filterCategoryAtom);
  const [status, setStatus] = useAtom(filterStatusAtom);

  const search = (overrides?: Partial<ProductFilterArg>) =>
    runSearch({ query, category, status, ...overrides } satisfies ProductFilterArg);

  // Show all products on mount
  useLayoutEffect(() => {
    runSearch({ query: "", category: "all", status: "all" });
  }, [runSearch]);

  const categories = ["all", ...Array.from(new Set(allProducts.map((p) => p.category))).sort()];
  const isRunning = actionResult.waiting;

  const inputCls =
    "rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <div className="space-y-4">
      {/* Search controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className={`${inputCls} min-w-40 flex-1`}
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            search({ category: e.target.value });
          }}
          className={inputCls}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            search({ status: e.target.value });
          }}
          className={inputCls}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button
          type="button"
          onClick={() => search()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Search
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </span>
          {isRunning && (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          )}
        </div>
        {results.length === 0 && !isRunning ? (
          <p className="py-10 text-center text-sm text-gray-500">No products match</p>
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
    <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-800/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Product
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Category
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Price
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Status
            </th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {products.map((p) => {
            const imgs = p.images ?? [];
            const img = imgs.find((i) => i.isPrimary) ?? imgs[0];
            return (
              <tr key={p.id} className="transition-colors hover:bg-white/5">
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
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="font-mono text-xs text-gray-500">{p.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 capitalize text-gray-300">
                  {p.category.replace(/_/g, " ")}
                </td>
                <td className="px-5 py-4 font-medium text-white">
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
                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
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
