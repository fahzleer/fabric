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

function stockBadgeClass(qty: number): string {
  if (qty === 0) return "bg-destructive/20 text-destructive";
  if (qty <= 5) return "bg-warning/20 text-warning";
  return "bg-muted text-foreground";
}

function AdminProductRow({
  p,
  sold,
}: {
  p: AdminProduct;
  sold: number;
}) {
  const isLow = p.totalStock > 0 && p.totalStock <= 5;
  const isOut = p.totalStock === 0 && p.status === "active";
  return (
    <tr
      className={`transition-colors ${isOut ? "bg-destructive/20" : isLow ? "bg-warning/20" : "hover:bg-muted/2"}`}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{p.name}</p>
        <p className="text-xs text-muted-foreground font-mono">{p.id.slice(0, 8)}…</p>
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
        {sold > 0 ? (
          <span className="font-medium text-success">{sold}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
    </tr>
  );
}

const ACTIVE_ORDER_STATUSES = new Set(["confirmed", "processing", "shipped", "delivered"]);

function buildSoldByProduct(orders: AdminOrderItem[]): Map<string, number> {
  const sold = new Map<string, number>();
  for (const order of orders) {
    if (!(ACTIVE_ORDER_STATUSES.has(order.status) && order.lines)) continue;
    for (const line of order.lines) {
      sold.set(line.productId, (sold.get(line.productId) ?? 0) + line.quantity);
    }
  }
  return sold;
}

function groupByStatus(products: AdminProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) {
    counts[p.status] = (counts[p.status] ?? 0) + 1;
  }
  return counts;
}

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

export default async function InventoryPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-muted-foreground">Failed to authenticate</p>;

  const [products, orders] = await Promise.all([getProducts(token), getOrders(token)]);

  const soldByProduct = buildSoldByProduct(orders);
  const productsByStatus = groupByStatus(products);

  const totalStock = products.reduce((s, p) => s + p.totalStock, 0);
  const lowStockProducts = products.filter((p) => p.totalStock > 0 && p.totalStock <= 5);
  const outOfStockProducts = products.filter((p) => p.totalStock === 0 && p.status === "active");
  const activeProducts = products.filter((p) => p.status === "active");

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory Control</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
            accent: "border-info/30 bg-info/5",
          },
          {
            label: "Total Stock",
            value: `${totalStock.toLocaleString()} units`,
            note: "across all active products",
            accent: "border-success/30 bg-success/5",
          },
          {
            label: "Low Stock",
            value: lowStockProducts.length.toLocaleString(),
            note: "≤ 5 units remaining",
            accent:
              lowStockProducts.length > 0
                ? "border-warning/30 bg-warning/10"
                : "border-border bg-muted/50",
            danger: lowStockProducts.length > 0,
          },
          {
            label: "Out of Stock",
            value: outOfStockProducts.length.toLocaleString(),
            note: "active products with 0 stock",
            accent:
              outOfStockProducts.length > 0
                ? "border-destructive/30 bg-destructive/10"
                : "border-border bg-muted/50",
            danger: outOfStockProducts.length > 0,
          },
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${card.danger ? "text-destructive" : "text-foreground"}`}
            >
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(productsByStatus).map(([status, count]) => (
          <span
            key={status}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}
          >
            {count} {status}
          </span>
        ))}
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-3xl mb-3">📦</p>
          <p className="text-sm font-medium text-foreground">No products yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Products will appear here once merchants add them
          </p>
        </div>
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
              {products.map((p) => (
                <AdminProductRow key={p.id} p={p} sold={soldByProduct.get(p.id) ?? 0} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-border bg-muted/40 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {products.length} product{products.length !== 1 ? "s" : ""}
              {" · "}
              {activeProducts.length} active
            </span>
            <span className="text-xs text-muted-foreground">
              Total stock:{" "}
              <span className="font-semibold text-foreground">
                {totalStock.toLocaleString()} units
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
