"use client";

import { CopyIdButton } from "@/components/admin/copy-id-button";
import { formatPrice } from "@/lib/price";
import { useMemo, useState } from "react";

type AdminProduct = {
  id: string;
  name: string;
  ownerId: string;
  category: string;
  status: string;
  priceCents: number;
  currency: string;
  stock: Record<string, number>;
  totalStock: number;
  createdAt: string;
  sold: number;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-success/20 text-success",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/20 text-destructive",
};

const CATEGORY_STYLES: Record<string, string> = {
  clothing: "bg-info/20 text-info",
  electronics: "bg-info/20 text-info",
  food: "bg-warning/20 text-warning",
  books: "bg-success/20 text-success",
  accessories: "bg-destructive/20 text-destructive",
};

function stockBadgeClass(qty: number): string {
  if (qty === 0) return "bg-destructive/20 text-destructive";
  if (qty <= 5) return "bg-warning/20 text-warning";
  return "bg-muted text-foreground";
}

function ProductRow({ p }: { p: AdminProduct }) {
  const isLow = p.totalStock > 0 && p.totalStock <= 5;
  const isOut = p.totalStock === 0 && p.status === "active";
  return (
    <tr
      className={`transition-colors ${isOut ? "bg-destructive/20" : isLow ? "bg-warning/20" : "hover:bg-muted/2"}`}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{p.name}</p>
        <div className="flex items-center gap-1">
          <p className="text-xs text-muted-foreground font-mono">{p.id.slice(0, 8)}…</p>
          <CopyIdButton value={p.id} />
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${CATEGORY_STYLES[p.category] ?? "bg-muted text-muted-foreground"}`}
        >
          {p.category}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {p.status}
        </span>
      </td>
      <td className="px-4 py-3 text-foreground whitespace-nowrap">
        {formatPrice({ amount: p.priceCents / 100, currency: p.currency })}
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
      <td className="px-4 py-3 text-center text-muted-foreground text-sm">
        {p.sold > 0 ? (
          <span className="font-medium text-success">{p.sold}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
    </tr>
  );
}

export function InventoryTableClient({ products }: { products: AdminProduct[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
  }, [products, query, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or product ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-48 flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No products match</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {["Product", "Category", "Status", "Price", "Stock by Size", "Total", "Sold"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card/30">
              {filtered.map((p) => (
                <ProductRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {products.length} products shown
      </p>
    </div>
  );
}
