import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Inventory — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  draft: "bg-gray-500/20 text-gray-400",
  archived: "bg-red-500/20 text-red-300",
};

function formatThb(cents: number, currency: string) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function MerchantInventoryPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return <p className="text-gray-400">Unable to load data. Please refresh.</p>;
  }

  const result = await maybeApi.value.getMerchantInventory();
  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Inventory</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {result.error}
        </div>
      </div>
    );
  }

  const products = result.value;
  const totalStock = products.reduce((s, p) => s + p.totalStock, 0);
  const lowStock = products.filter((p) => p.totalStock > 0 && p.totalStock <= 5);
  const outOfStock = products.filter((p) => p.totalStock === 0 && p.status === "active");
  const activeCount = products.filter((p) => p.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Inventory</h1>
        <p className="mt-1 text-sm text-gray-400">Live stock levels for your products</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Products",
            value: products.length.toString(),
            note: `${activeCount} active`,
            accent: "border-violet-500/30 bg-violet-500/5",
          },
          {
            label: "Total Stock",
            value: `${totalStock}`,
            note: "units across all products",
            accent: "border-emerald-500/30 bg-emerald-500/5",
          },
          {
            label: "Low Stock",
            value: lowStock.length.toString(),
            note: "≤ 5 units",
            accent:
              lowStock.length > 0
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-white/10 bg-gray-800/50",
            danger: lowStock.length > 0,
          },
          {
            label: "Out of Stock",
            value: outOfStock.length.toString(),
            note: "active + 0 units",
            accent:
              outOfStock.length > 0
                ? "border-red-500/30 bg-red-500/10"
                : "border-white/10 bg-gray-800/50",
            danger: outOfStock.length > 0,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold ${card.danger ? "text-red-400" : "text-white"}`}
            >
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
          <p className="text-3xl mb-3">📦</p>
          <p className="text-sm font-medium text-gray-300">No products yet</p>
          <p className="mt-1 text-xs text-gray-500">Add products to see your inventory here</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/60">
                {["Product", "Status", "Price", "Stock by Size", "Total"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {products.map((p) => {
                const isLow = p.totalStock > 0 && p.totalStock <= 5;
                const isOut = p.totalStock === 0 && p.status === "active";
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${isOut ? "bg-red-950/20" : isLow ? "bg-amber-950/20" : "hover:bg-white/2"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.category}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? "bg-gray-500/20 text-gray-400"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatThb(p.priceCents, p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {Object.keys(p.stock).length === 0 ? (
                        <span className="text-gray-600 text-xs">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(p.stock).map(([size, qty]) => (
                            <span
                              key={size}
                              className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                                qty === 0
                                  ? "bg-red-500/20 text-red-400"
                                  : qty <= 5
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-white/10 text-gray-300"
                              }`}
                            >
                              {size}:{qty}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-sm font-bold ${isOut ? "text-red-400" : isLow ? "text-amber-400" : "text-white"}`}
                      >
                        {p.totalStock}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {products.length} product{products.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-400">
              Total: <span className="font-semibold text-white">{totalStock} units</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
