import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import { Badge } from "@fabric/ui";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

type StatusTone = "success" | "warning" | "info" | "danger" | "neutral";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type Order = {
  id: { __brand: string; value: string };
  status: string;
  totalAmountInCents: number;
  currency: string;
  itemCount: number;
  placedAt: string;
};

type OrdersPage = {
  items: Order[];
  total: number;
  page: number;
  perPage: number;
};

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Payment Pending", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  processing: { label: "Processing", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

async function getAuthToken(): Promise<string | null> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return null;
  const user = session.user as { id: string; email: string; role?: string };
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role === "user" || !user.role ? "customer" : user.role,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export default async function OrdersPage() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) redirect("/auth/login");

  const token = await getAuthToken();
  let orders: Order[] = [];

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/orders?perPage=50`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as OrdersPage | Order[];
        orders = Array.isArray(data) ? data : (data.items ?? []);
      }
    } catch {
      // show empty list on error
    }
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          <Link href="/products" className="text-sm text-info hover:underline">
            ← Continue Shopping
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-12 text-center">
            <p className="text-muted-foreground">You have no orders yet.</p>
            <Link
              href="/products"
              className="mt-4 inline-block rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderId = order.id?.value ?? (order.id as unknown as string);
              const status = STATUS_LABELS[order.status] ?? {
                label: order.status,
                tone: "neutral" as StatusTone,
              };
              const date = new Date(order.placedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const totalAmount = order.totalAmountInCents / 100;

              return (
                <Link
                  key={orderId}
                  href={`/order/${orderId}/confirmation`}
                  className="block rounded-lg border border-border bg-white p-5 hover:border-info/80 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-faint mb-1">{date}</p>
                      <p className="text-sm font-mono text-muted-foreground">
                        #{orderId.slice(0, 8)}…
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={status.tone}>{status.label}</Badge>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {formatPrice({ amount: totalAmount, currency: order.currency ?? "THB" })}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
