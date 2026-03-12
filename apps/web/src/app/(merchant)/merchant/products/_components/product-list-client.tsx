"use client";

import {
  PAGE_SIZE,
  type ProductFilterArg,
  merchantAllProductsAtom,
  merchantManualResultsAtom,
  merchantPageAtom,
  merchantSearchAtom,
  merchantStreamAtom,
} from "@/application/atoms/merchant-products.atoms";
import type { MerchantProduct } from "@/lib/merchant-api";
import { formatPrice } from "@/lib/price";
import { Atom, Result, useAtom, useAtomValue } from "@effect-atom/atom-react";
import Link from "next/link";
import { useLayoutEffect } from "react";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  draft: "bg-gray-700/50 text-gray-400 border-gray-600",
  archived: "bg-red-500/20 text-red-400 border-red-500/40",
};

type Tab = "stream" | "paginate" | "filter";

const activeTabAtom = Atom.make<Tab>("stream");
const filterQueryAtom = Atom.make("");
const filterCategoryAtom = Atom.make("all");
const filterStatusAtom = Atom.make("all");

export function ProductListClient({ initialProducts }: { initialProducts: MerchantProduct[] }) {
  const [tab, setTab] = useAtom(activeTabAtom);
  const [, setAllProducts] = useAtom(merchantAllProductsAtom);

  useLayoutEffect(() => {
    setAllProducts(initialProducts);
  }, [initialProducts, setAllProducts]);

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="truncate rounded-xl border border-white/10 bg-gray-900/40 px-5 py-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-300">@effect-atom/atom-react</span>
        {" — "}
        <code className="text-teal-400">① Atom.fn + Stream.scan</code>
        <span className="hidden sm:inline">
          {"  ·  "}
          <code className="text-blue-400">② Atom.pull + rechunk({PAGE_SIZE})</code>
          {"  ·  "}
          <code className="text-purple-400">③ Atom.fn + get.set</code>
        </span>
        <span className="ml-3 text-gray-600">({initialProducts.length} products)</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 rounded-xl border border-white/10 bg-gray-800/50 p-1">
        {(
          [
            {
              key: "stream",
              label: "① Stream",
              sub: "Atom.fn + Stream.scan",
              on: "bg-teal-500/20 text-teal-300",
              off: "text-gray-500 hover:text-teal-400",
            },
            {
              key: "paginate",
              label: "② Pull",
              sub: `Atom.pull + rechunk(${PAGE_SIZE})`,
              on: "bg-blue-500/20 text-blue-300",
              off: "text-gray-500 hover:text-blue-400",
            },
            {
              key: "filter",
              label: "③ Filter",
              sub: "Atom.fn + get.set",
              on: "bg-purple-500/20 text-purple-300",
              off: "text-gray-500 hover:text-purple-400",
            },
          ] as const
        ).map(({ key, label, sub, on, off }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as Tab)}
            className={`flex-1 min-w-0 truncate rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${tab === key ? on : off}`}
          >
            {label}
            <span className="hidden sm:inline ml-1.5 text-xs opacity-60">— {sub}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "stream" && <StreamTab total={initialProducts.length} />}
      {tab === "paginate" && <PullTab total={initialProducts.length} />}
      {tab === "filter" && <FilterTab />}
    </div>
  );
}

function StreamTab({ total }: { total: number }) {
  const [result, startStream] = useAtom(merchantStreamAtom);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Pattern 1 —{" "}
            <code className="rounded bg-teal-500/10 px-1.5 py-0.5 text-xs text-teal-300">
              Atom.fn + Stream.scan
            </code>
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            fn returns a Stream; <code className="text-teal-300">Stream.scan</code> accumulates
            items into a growing array. Atom value rerenders on every emission.
          </p>
        </div>
        <button
          type="button"
          onClick={() => startStream("")}
          className="shrink-0 rounded-lg bg-teal-600/20 border border-teal-500/30 px-4 py-2 text-xs font-medium text-teal-300 hover:bg-teal-600/30"
        >
          ▶ Start stream
        </button>
      </div>

      {Result.match(result, {
        onInitial: (r) => (
          <div className="flex items-center justify-center gap-2.5 py-14">
            {r.waiting ? (
              <>
                <Dot colour="teal" />
                <span className="text-sm text-gray-500">Streaming…</span>
              </>
            ) : (
              <span className="text-sm text-gray-500">Click "Start stream" to begin</span>
            )}
          </div>
        ),
        onFailure: () => <p className="py-6 text-center text-sm text-red-400">Stream error</p>,
        onSuccess: (r) => (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-gray-700">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-75"
                  style={{ width: total > 0 ? `${(r.value.length / total) * 100}%` : "0%" }}
                />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-gray-500">
                {r.value.length} / {total}
                {r.value.length < total ? (
                  <span className="ml-1.5 animate-pulse text-teal-400">▸ streaming</span>
                ) : (
                  <span className="ml-1.5 text-gray-600"> complete</span>
                )}
              </span>
            </div>
            <ProductTable products={r.value} accent="teal" />
          </div>
        ),
      })}
    </div>
  );
}

function PullTab({ total }: { total: number }) {
  const [result, loadMore] = useAtom(merchantPageAtom);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">
          Pattern 2 —{" "}
          <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-300">
            Atom.pull + rechunk({PAGE_SIZE})
          </code>
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          <code className="text-blue-300">Stream.rechunk({PAGE_SIZE})</code> groups the stream into
          chunks. Each <code className="text-blue-300">loadMore()</code> pull delivers {PAGE_SIZE}{" "}
          more items. Items accumulate in <code className="text-blue-300">PullResult.items</code>.
        </p>
      </div>

      {Result.match(result, {
        onInitial: (r) => (
          <div className="flex flex-col items-center justify-center gap-4 py-14">
            {r.waiting ? (
              <>
                <Dot colour="blue" />
                <span className="text-sm text-gray-500">Loading first page…</span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => loadMore()}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
              >
                Load products
              </button>
            )}
          </div>
        ),
        onFailure: () => (
          <p className="py-6 text-center text-sm text-red-400">Failed to load products</p>
        ),
        onSuccess: (r) => {
          const loaded = r.value.items;
          const isDone = r.value.done;
          const pageCount = Math.ceil(loaded.length / PAGE_SIZE);

          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {loaded.length} / {total} products
                  {isDone && <span className="ml-1 text-gray-600">· all loaded</span>}
                </span>
                {r.waiting && <Dot colour="blue" />}
              </div>

              <ProductTable products={Array.from(loaded)} accent="blue" />

              {isDone ? (
                <p className="text-center text-xs text-gray-600">
                  — all {loaded.length} products loaded in {pageCount} pull
                  {pageCount !== 1 ? "s" : ""} —
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => loadMore()}
                  disabled={r.waiting}
                  className="w-full rounded-lg border border-blue-500/30 py-2.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/10 disabled:opacity-50"
                >
                  {r.waiting
                    ? "Loading…"
                    : `Load more  (+${PAGE_SIZE} · page ${pageCount + 1} of ${Math.ceil(total / PAGE_SIZE)})`}
                </button>
              )}
            </div>
          );
        },
      })}
    </div>
  );
}

function FilterTab() {
  const results = useAtomValue(merchantManualResultsAtom);
  const [actionResult, runSearch] = useAtom(merchantSearchAtom);
  const allProducts = useAtomValue(merchantAllProductsAtom);

  const [query, setQuery] = useAtom(filterQueryAtom);
  const [category, setCategory] = useAtom(filterCategoryAtom);
  const [status, setStatus] = useAtom(filterStatusAtom);

  const search = (overrides?: Partial<ProductFilterArg>) =>
    runSearch({
      query,
      category,
      status,
      ...overrides,
    } satisfies ProductFilterArg);

  const categories = ["all", ...Array.from(new Set(allProducts.map((p) => p.category))).sort()];

  const isRunning = actionResult.waiting;

  const inputCls =
    "rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">
          Pattern 3 —{" "}
          <code className="rounded bg-purple-500/10 px-1.5 py-0.5 text-xs text-purple-300">
            Atom.fn + get.set
          </code>
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
          fn runs <code className="text-purple-300">Effect.gen</code>; calls{" "}
          <code className="text-purple-300">get.set(resultsAtom, [...])</code> to clear, then
          appends each product via <code className="text-purple-300">Effect.sync</code> — no scan,
          no pull — pure imperative writes.
        </p>
      </div>

      {/* Controls */}
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
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
        >
          Search
        </button>
      </div>

      {/* Results — read directly from merchantManualResultsAtom */}
      {Result.isInitial(actionResult) && !actionResult.waiting ? (
        <div className="flex items-center justify-center py-14">
          <span className="text-sm text-gray-500">Enter a query and press Search</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </span>
            {isRunning && (
              <>
                <Dot colour="purple" />
                <span className="text-xs text-gray-500">appending…</span>
              </>
            )}
          </div>
          {results.length === 0 && !isRunning ? (
            <p className="py-10 text-center text-sm text-gray-500">No products match</p>
          ) : (
            <ProductTable products={results} accent="purple" />
          )}
        </div>
      )}
    </div>
  );
}

function ProductTable({
  products,
  accent,
}: {
  products: MerchantProduct[];
  accent: "teal" | "blue" | "purple";
}) {
  if (products.length === 0) return null;

  const linkCls =
    accent === "teal"
      ? "text-teal-400 hover:text-teal-300"
      : accent === "blue"
        ? "text-blue-400 hover:text-blue-300"
        : "text-purple-400 hover:text-purple-300";

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
                    className={`text-xs font-medium ${linkCls}`}
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

function Dot({ colour }: { colour: "teal" | "blue" | "purple" }) {
  const cls =
    colour === "teal" ? "bg-teal-400" : colour === "blue" ? "bg-blue-400" : "bg-purple-400";
  return <span className={`inline-block h-2 w-2 animate-pulse rounded-full ${cls}`} />;
}
