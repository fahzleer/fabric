import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Inventory — Admin" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

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
};

type AdminOrderItem = {
  id: string;
  status: string;
  totalAmountInCents: number;
  currency: string;
  itemCount: number;
  placedAt: string;
  customerId: string;
  lines?: Array<{ productId: string; quantity: number }>;
};

async function issueAdminToken(userId: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ userId, email, role: "admin" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function getProducts(token: string): Promise<AdminProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/products`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: AdminProduct[] };
    return data.products ?? [];
  } catch {
    return [];
  }
}

async function getOrders(token: string): Promise<AdminOrderItem[]> {
  try {
    const res = await fetch(`${API_BASE}/admin/orders?perPage=1000`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: AdminOrderItem[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-300",
  draft: "bg-gray-500/20 text-gray-400",
  archived: "bg-red-500/20 text-red-300",
};

const CATEGORY_STYLES: Record<string, string> = {
  clothing: "bg-violet-500/20 text-violet-300",
  electronics: "bg-blue-500/20 text-blue-300",
  food: "bg-amber-500/20 text-amber-300",
  books: "bg-emerald-500/20 text-emerald-300",
  accessories: "bg-pink-500/20 text-pink-300",
};

export default async function InventoryPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-gray-400">Failed to authenticate</p>;

  const [products, orders] = await Promise.all([getProducts(token), getOrders(token)]);

  const soldByProduct = new Map<string, number>();
  for (const order of orders) {
    if (!["confirmed", "processing", "shipped", "delivered"].includes(order.status)) continue;
    if (order.lines) {
      for (const line of order.lines) {
        soldByProduct.set(line.productId, (soldByProduct.get(line.productId) ?? 0) + line.quantity);
      }
    }
  }

  const totalStock = products.reduce((s, p) => s + p.totalStock, 0);
  const lowStockProducts = products.filter((p) => p.totalStock > 0 && p.totalStock <= 5);
  const outOfStockProducts = products.filter((p) => p.totalStock === 0 && p.status === "active");
  const activeProducts = products.filter((p) => p.status === "active");

  const productsByStatus: Record<string, number> = {};
  for (const p of products) {
    productsByStatus[p.status] = (productsByStatus[p.status] ?? 0) + 1;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Inventory Control</h1>
        <p className="mt-1 text-sm text-gray-400">
          Live stock levels from Firebase · {products.length} products tracked
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Total Products",
            value: products.length.toLocaleString(),
            note: `${activeProducts.length} active`,
            accent: "border-violet-500/30 bg-violet-500/5",
          },
          {
            label: "Total Stock",
            value: `${totalStock.toLocaleString()} units`,
            note: "across all active products",
            accent: "border-emerald-500/30 bg-emerald-500/5",
          },
          {
            label: "Low Stock",
            value: lowStockProducts.length.toLocaleString(),
            note: "≤ 5 units remaining",
            accent:
              lowStockProducts.length > 0
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-white/10 bg-gray-800/50",
            danger: lowStockProducts.length > 0,
          },
          {
            label: "Out of Stock",
            value: outOfStockProducts.length.toLocaleString(),
            note: "active products with 0 stock",
            accent:
              outOfStockProducts.length > 0
                ? "border-red-500/30 bg-red-500/10"
                : "border-white/10 bg-gray-800/50",
            danger: outOfStockProducts.length > 0,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold ${card.danger ? "text-red-400" : "text-white"}`}>
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(productsByStatus).map(([status, count]) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-gray-500/20 text-gray-400"}`}
          >
            {count} {status}
          </span>
        ))}
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-3xl mb-3">📦</p>
          <p className="text-sm font-medium text-gray-300">No products yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Products will appear here once merchants add them
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/60">
                {["Product", "Category", "Status", "Price", "Stock by Size", "Total", "Sold"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/30">
              {products.map((p) => {
                const sold = soldByProduct.get(p.id) ?? 0;
                const isLow = p.totalStock > 0 && p.totalStock <= 5;
                const isOut = p.totalStock === 0 && p.status === "active";
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${isOut ? "bg-red-950/20" : isLow ? "bg-amber-950/20" : "hover:bg-white/2"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{p.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${CATEGORY_STYLES[p.category] ?? "bg-gray-500/20 text-gray-400"}`}
                      >
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? "bg-gray-500/20 text-gray-400"}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatPrice({ amount: p.priceCents / 100, currency: p.currency })}
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
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">
                      {sold > 0 ? (
                        <span className="font-medium text-emerald-400">{sold}</span>
                      ) : (
                        <span className="text-gray-600">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-white/10 bg-gray-800/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {products.length} product{products.length !== 1 ? "s" : ""}
              {" · "}
              {activeProducts.length} active
            </span>
            <span className="text-xs text-gray-400">
              Total stock:{" "}
              <span className="font-semibold text-white">{totalStock.toLocaleString()} units</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
