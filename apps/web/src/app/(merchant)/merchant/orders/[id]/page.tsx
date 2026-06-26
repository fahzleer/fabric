import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StatusUpdateForm } from "../_components/status-update-form";

export const metadata: Metadata = { title: "Order Detail — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/40",
  confirmed: "bg-success/20 text-success border-success/40",
  shipped: "bg-info/20 text-info border-info/40",
  delivered: "bg-success/20 text-success border-success/40",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency }).format(cents / 100);
}

export default async function MerchantOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load data. Please refresh.</p>
      </div>
    );
  }

  const result = await maybeApi.value.getMerchantOrderById(id);
  if (isErr(result)) notFound();

  const order = result.value;
  const orderId = order.id?.value ?? id;
  const statusStyle = STATUS_STYLES[order.status] ?? "bg-muted/50 text-foreground border-border";
  const currency = order.currency;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/merchant/orders"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Orders
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Order Detail</h1>
          <span
            className={`rounded-full border px-3 py-0.5 text-sm font-semibold capitalize ${statusStyle}`}
          >
            {order.status}
          </span>
        </div>
        <StatusUpdateForm orderId={orderId} currentStatus={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Order info */}
        <div className="rounded-xl border border-border bg-muted/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Order Info
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Order ID</dt>
              <dd className="font-mono text-xs text-foreground">{orderId.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Placed</dt>
              <dd className="text-foreground">{formatDate(order.placedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Customer ID</dt>
              <dd className="font-mono text-xs text-foreground">
                {order.userId?.value?.slice(0, 8) ?? "—"}…
              </dd>
            </div>
          </dl>
        </div>

        {/* Shipping address */}
        <div className="rounded-xl border border-border bg-muted/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ship To
          </h2>
          {order.shippingAddress ? (
            <address className="not-italic text-sm text-foreground space-y-1">
              <p className="font-medium text-foreground">{order.shippingAddress.recipientName}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.city}
                {order.shippingAddress.province ? `, ${order.shippingAddress.province}` : ""}
              </p>
              <p>
                {order.shippingAddress.postalCode} · {order.shippingAddress.country}
              </p>
              <p className="text-muted-foreground">{order.shippingAddress.phone}</p>
            </address>
          ) : (
            <p className="text-sm text-muted-foreground">No address on record</p>
          )}
        </div>
      </div>

      {/* Order lines */}
      <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items
          </h2>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">Product</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">Size</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-muted-foreground text-center">
                Qty
              </th>
              <th className="px-5 py-2.5 text-xs font-semibold text-muted-foreground text-right">
                Unit Price
              </th>
              <th className="px-5 py-2.5 text-xs font-semibold text-muted-foreground text-right">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {(order.lines ?? []).map((line) => (
              <tr key={`${line.productId}-${line.size}`} className="border-t border-border">
                <td className="px-5 py-3 text-sm text-foreground">{line.productName}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground uppercase">{line.size}</td>
                <td className="px-5 py-3 text-sm text-foreground text-center">{line.quantity}</td>
                <td className="px-5 py-3 text-sm text-foreground text-right">
                  {formatAmount(Math.round(line.unitPrice.amount * 100), currency)}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-foreground text-right">
                  {formatAmount(Math.round(line.unitPrice.amount * 100) * line.quantity, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-border bg-muted/50 p-5">
        <dl className="space-y-2 text-sm">
          {order.discountCents > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Discount</dt>
              <dd className="text-success">−{formatAmount(order.discountCents, currency)}</dd>
            </div>
          )}
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Shipping</dt>
              <dd>{formatAmount(order.shippingCents, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
            <dt>Total</dt>
            <dd>{formatAmount(order.totalAmountInCents, currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
