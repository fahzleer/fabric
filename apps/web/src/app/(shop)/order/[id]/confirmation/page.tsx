import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import { type Maybe, None, Some, isNone, isSome } from "@fabric/types";
import { headers } from "next/headers";
import Link from "next/link";
import { ClearCartOnMount } from "./_components/clear-cart-on-mount";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type OrderLine = {
  productId: { value: string };
  productName: string;
  unitPrice: { amount: number; currency: string };
  size: string;
  quantity: number;
};

type OrderDetail = {
  id: { value: string };
  status: string;
  totalAmountInCents: number;
  shippingCents: number;
  discountCents: number;
  currency: string;
  lines: OrderLine[];
  shippingAddress: {
    recipientName: string;
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  placedAt: string;
};

type PriceBreakdown = {
  subtotalCents: number;
  currency: string;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

const STATUS_LABELS: Record<string, { label: string; colour: string }> = {
  pending: { label: "Payment Pending", colour: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  confirmed: { label: "Confirmed", colour: "text-green-700  bg-green-50  border-green-200" },
  processing: { label: "Processing", colour: "text-blue-700   bg-blue-50   border-blue-200" },
  shipped: { label: "Shipped", colour: "text-blue-700   bg-blue-50   border-blue-200" },
  delivered: { label: "Delivered", colour: "text-green-700  bg-green-50  border-green-200" },
  cancelled: { label: "Cancelled", colour: "text-red-700    bg-red-50    border-red-200" },
};

async function getAuthToken(): Promise<Maybe<string>> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return None();

  const user = session.user as { id: string; email: string; role?: string };
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        role: user.role === "user" || !user.role ? "customer" : user.role,
      }),
      cache: "no-store",
    });
    if (!res.ok) return None();
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ? Some(data.accessToken) : None();
  } catch {
    return None();
  }
}

async function fetchOrderDetail(
  id: string,
  authToken: Maybe<string>
): Promise<{ order: Maybe<OrderDetail>; fetchError: Maybe<string> }> {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${id}`, {
      headers: isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {},
      cache: "no-store",
    });
    if (res.ok) {
      return { order: Some((await res.json()) as OrderDetail), fetchError: None() };
    }
    return { order: None(), fetchError: Some("Could not load order details.") };
  } catch {
    return { order: None(), fetchError: Some("Network error loading order details.") };
  }
}

function computePriceBreakdown(order: Maybe<OrderDetail>): PriceBreakdown {
  if (isNone(order)) {
    return {
      subtotalCents: 0,
      currency: "THB",
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
    };
  }
  const o = order.value;
  const subtotalCents = o.lines.reduce(
    (acc, l) => acc + Math.round(l.unitPrice.amount * 100) * l.quantity,
    0
  );
  const taxCents = Math.max(
    0,
    o.totalAmountInCents - (subtotalCents - o.discountCents + o.shippingCents)
  );
  return {
    subtotalCents,
    currency: o.currency,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    taxCents,
    totalCents: o.totalAmountInCents,
  };
}

function getStatusInfo(order: Maybe<OrderDetail>) {
  if (isNone(order)) return { label: "", colour: "text-gray-700 bg-gray-50 border-gray-200" };
  const status = order.value.status;
  return (
    STATUS_LABELS[status] ?? { label: status, colour: "text-gray-700 bg-gray-50 border-gray-200" }
  );
}

function OrderLineItems({ lines, currency }: { lines: OrderLine[]; currency: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="px-6 py-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Items Ordered</h2>
      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={`${line.productId.value}:${line.size}`}
            className="flex justify-between items-start"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{line.productName}</p>
              <p className="text-xs text-gray-500">
                Size: {line.size} · Qty: {line.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {formatPrice({ amount: line.unitPrice.amount * line.quantity, currency })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderPriceBreakdown({ breakdown }: { breakdown: PriceBreakdown }) {
  const { subtotalCents, currency, discountCents, shippingCents, taxCents, totalCents } = breakdown;
  return (
    <div className="px-6 py-4 space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>Subtotal</span>
        <span>{formatPrice({ amount: subtotalCents / 100, currency })}</span>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-sm text-green-600">
          <span>Discount</span>
          <span>−{formatPrice({ amount: discountCents / 100, currency })}</span>
        </div>
      )}
      <div className="flex justify-between text-sm text-gray-600">
        <span>Shipping</span>
        <span>
          {shippingCents === 0 ? "Free" : formatPrice({ amount: shippingCents / 100, currency })}
        </span>
      </div>
      {taxCents > 0 && (
        <div className="flex justify-between text-sm text-gray-600">
          <span>VAT (7%)</span>
          <span>{formatPrice({ amount: taxCents / 100, currency })}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-100 pt-2 mt-1">
        <span>Total</span>
        <span>{formatPrice({ amount: totalCents / 100, currency })}</span>
      </div>
    </div>
  );
}

function ShippingInfo({ address }: { address: OrderDetail["shippingAddress"] }) {
  return (
    <div className="px-6 py-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Ship to</h2>
      <p className="text-sm text-gray-600">{address.recipientName}</p>
      <p className="text-sm text-gray-600">{address.street}</p>
      <p className="text-sm text-gray-600">
        {address.city}, {address.country} {address.postalCode}
      </p>
    </div>
  );
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { id } = await params;
  const authToken = await getAuthToken();
  const { order, fetchError } = await fetchOrderDetail(id, authToken);
  const breakdown = computePriceBreakdown(order);
  const statusInfo = getStatusInfo(order);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Runs client-side: clears IndexedDB cart after order is confirmed */}
      <ClearCartOnMount />

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Order Placed!</h1>
          <p className="mt-2 text-gray-600">Thank you for your order. Your order ID is:</p>
          <p className="mt-1 text-lg font-mono font-semibold text-blue-600">#{id}</p>
        </div>

        {/* Order detail card */}
        <div className="rounded-lg bg-white border border-gray-200 divide-y divide-gray-100">
          {/* Status */}
          {isSome(order) && (
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Status</span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${statusInfo.colour}`}
              >
                {statusInfo.label}
              </span>
            </div>
          )}

          {isSome(fetchError) && (
            <div className="px-6 py-4 text-sm text-red-600">{fetchError.value}</div>
          )}

          {/* Line items */}
          {isSome(order) && (
            <OrderLineItems lines={order.value.lines} currency={breakdown.currency} />
          )}

          {/* Pricing breakdown */}
          {isSome(order) && <OrderPriceBreakdown breakdown={breakdown} />}

          {/* Shipping address */}
          {isSome(order) && <ShippingInfo address={order.value.shippingAddress} />}

          {/* What happens next */}
          <div className="px-6 py-4 space-y-1">
            <h2 className="text-sm font-semibold text-gray-900">What happens next?</h2>
            <p className="text-sm text-gray-600">You will receive an email confirmation shortly.</p>
            <p className="text-sm text-gray-600">
              Your order will be processed and shipped within 2–3 business days.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/products"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 text-center"
          >
            Continue Shopping
          </Link>
          <Link
            href="/account/orders"
            className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 text-center"
          >
            View My Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
