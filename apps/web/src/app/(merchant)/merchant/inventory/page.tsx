import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Inventory — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/20 text-success",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/20 text-destructive",
};

type MerchantProduct = {
  id: string;
  name: string;
  category: string;
  status: string;
  priceCents: number;
  currency: string;
  stock: Record<string, number>;
  totalStock: number;
};

function stockBadgeClass(qty: number): string {
  if (qty === 0) return "bg-destructive/20 text-destructive";
  if (qty <= 5) return "bg-warning/20 text-warning";
  return "bg-muted text-foreground";
}

function MerchantProductRow({ p }: { p: MerchantProduct }) {
  const isLow = p.totalStock > 0 && p.totalStock <= 5;
  const isOut = p.totalStock === 0 && p.status === "active";
  return (
    <tr
      className={`transition-colors ${isOut ? "bg-destructive/20" : isLow ? "bg-warning/20" : "hover:bg-muted/2"}`}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{p.name}</p>
        <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {p.status}
        </span>
      </td>
      <td className="px-4 py-3 text-foreground whitespace-nowrap">
        {formatThb(p.priceCents, p.currency)}
      </td>
      <td className="px-4 py-3">
        {Object.keys(p.stock).length === 0 ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {Object.entries(p.stock).map(([size, qty]) => (
              <span
                key={size}
                className={`rounded px-1.5 py-0.5 text-xs font-mono ${stockBadgeClass(qty)}`}
              >
                {size}:{qty}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className={`text-sm font-bold ${isOut ? "text-destructive" : isLow ? "text-warning" : "text-foreground"}`}
        >
          {p.totalStock}
        </span>
      </td>
    </tr>
  );
}

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
    return <p className="text-muted-foreground">Unable to load data. Please refresh.</p>;
  }

  const result = await maybeApi.value.getMerchantInventory();
  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
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
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live stock levels for your products</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Products",
            value: products.length.toString(),
            note: `${activeCount} active`,
            accent: "border-info/30 bg-info/5",
          },
          {
            label: "Total Stock",
            value: `${totalStock}`,
            note: "units across all products",
            accent: "border-success/30 bg-success/5",
          },
          {
            label: "Low Stock",
            value: lowStock.length.toString(),
            note: "≤ 5 units",
            accent:
              lowStock.length > 0 ? "border-warning/30 bg-warning/10" : "border-border bg-muted/50",
            danger: lowStock.length > 0,
          },
          {
            label: "Out of Stock",
            value: outOfStock.length.toString(),
            note: "active + 0 units",
            accent:
              outOfStock.length > 0
                ? "border-destructive/30 bg-destructive/10"
                : "border-border bg-muted/50",
            danger: outOfStock.length > 0,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold ${card.danger ? "text-destructive" : "text-foreground"}`}
            >
              {card.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{card.note}</p>
          </div>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-14 text-center">
          <p className="text-3xl mb-3">📦</p>
          <p className="text-sm font-medium text-foreground">No products yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add products to see your inventory here
          </p>
        </div>
      ) : (
        <>
          {/* Stock-health legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Stock badges:</span>
            <span className="flex items-center gap-1.5">
              <span className="rounded px-1.5 py-0.5 font-mono bg-muted text-foreground">M:12</span>
              Healthy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded px-1.5 py-0.5 font-mono bg-warning/20 text-warning">
                M:3
              </span>
              Low (≤ 5)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded px-1.5 py-0.5 font-mono bg-destructive/20 text-destructive">
                M:0
              </span>
              Out of stock
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  {["Product", "Status", "Price", "Stock by Size", "Total"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card/30">
                {products.map((p) => (
                  <MerchantProductRow key={p.id} p={p} />
                ))}
              </tbody>
            </table>
            <div className="border-t border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {products.length} product{products.length !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalStock} units</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
