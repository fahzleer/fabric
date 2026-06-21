import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StatusUpdateForm } from "../_components/status-update-form";

export const metadata: Metadata = { title: "Order Detail — Merchant Portal" };

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  confirmed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  shipped: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  delivered: "bg-green-500/20 text-green-300 border-green-500/40",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/40",
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
        <p className="text-gray-400">Unable to load data. Please refresh.</p>
      </div>
    );
  }

  const result = await maybeApi.value.getMerchantOrderById(id);
  if (isErr(result)) notFound();

  const order = result.value;
  const orderId = order.id?.value ?? id;
  const statusStyle = STATUS_STYLES[order.status] ?? "bg-gray-700/50 text-gray-300 border-gray-600";
  const currency = order.currency;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/merchant/orders" className="text-sm text-gray-400 hover:text-white">
            ← Orders
          </Link>
          <h1 className="text-2xl font-bold text-white">Order Detail</h1>
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
        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Order Info
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Order ID</dt>
              <dd className="font-mono text-xs text-gray-200">{orderId.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Placed</dt>
              <dd className="text-gray-200">{formatDate(order.placedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Customer ID</dt>
              <dd className="font-mono text-xs text-gray-200">
                {order.userId?.value?.slice(0, 8) ?? "—"}…
              </dd>
            </div>
          </dl>
        </div>

        {/* Shipping address */}
        <div className="rounded-xl border border-white/10 bg-gray-800/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Ship To</h2>
          {order.shippingAddress ? (
            <address className="not-italic text-sm text-gray-200 space-y-1">
              <p className="font-medium text-white">{order.shippingAddress.recipientName}</p>
              <p>{order.shippingAddress.street}</p>
              <p>
                {order.shippingAddress.city}
                {order.shippingAddress.province ? `, ${order.shippingAddress.province}` : ""}
              </p>
              <p>
                {order.shippingAddress.postalCode} · {order.shippingAddress.country}
              </p>
              <p className="text-gray-400">{order.shippingAddress.phone}</p>
            </address>
          ) : (
            <p className="text-sm text-gray-400">No address on record</p>
          )}
        </div>
      </div>

      {/* Order lines */}
      <div className="rounded-xl border border-white/10 bg-gray-800/50 overflow-hidden">
        <div className="border-b border-white/10 px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Items</h2>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-400">Product</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-400">Size</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 text-center">Qty</th>
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 text-right">
                Unit Price
              </th>
              <th className="px-5 py-2.5 text-xs font-semibold text-gray-400 text-right">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {(order.lines ?? []).map((line) => (
              <tr key={`${line.productId}-${line.size}`} className="border-t border-white/5">
                <td className="px-5 py-3 text-sm text-white">{line.productName}</td>
                <td className="px-5 py-3 text-sm text-gray-400 uppercase">{line.size}</td>
                <td className="px-5 py-3 text-sm text-gray-200 text-center">{line.quantity}</td>
                <td className="px-5 py-3 text-sm text-gray-200 text-right">
                  {formatAmount(Math.round(line.unitPrice.amount * 100), currency)}
                </td>
                <td className="px-5 py-3 text-sm font-medium text-white text-right">
                  {formatAmount(Math.round(line.unitPrice.amount * 100) * line.quantity, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="rounded-xl border border-white/10 bg-gray-800/50 p-5">
        <dl className="space-y-2 text-sm">
          {order.discountCents > 0 && (
            <div className="flex justify-between text-gray-400">
              <dt>Discount</dt>
              <dd className="text-emerald-400">−{formatAmount(order.discountCents, currency)}</dd>
            </div>
          )}
          {order.shippingCents > 0 && (
            <div className="flex justify-between text-gray-400">
              <dt>Shipping</dt>
              <dd>{formatAmount(order.shippingCents, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold text-white">
            <dt>Total</dt>
            <dd>{formatAmount(order.totalAmountInCents, currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
