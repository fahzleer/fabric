import { Reveal } from "@/components/motion/reveal";
import { auth } from "@/lib/auth";
import { formatPrice } from "@/lib/price";
import { type Maybe, None, Some, isNone, isSome } from "@fabric/types";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { ClearCartOnMount } from "./_components/clear-cart-on-mount";
import { OrderSuccessHeader } from "./_components/order-success-header";
import { OrderTracker } from "./_components/order-tracker";

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
  pending: { label: "Payment Pending", colour: "text-warning bg-warning-subtle border-warning" },
  confirmed: { label: "Confirmed", colour: "text-success  bg-success-subtle  border-success" },
  processing: { label: "Processing", colour: "text-info   bg-info-subtle   border-info" },
  shipped: { label: "Shipped", colour: "text-info   bg-info-subtle   border-info" },
  delivered: { label: "Delivered", colour: "text-success  bg-success-subtle  border-success" },
  cancelled: {
    label: "Cancelled",
    colour: "text-destructive    bg-destructive-subtle    border-destructive",
  },
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

async function getGuestEmail(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("fabric_guest_email")?.value;
}

async function fetchOrderDetail(
  id: string,
  authToken: Maybe<string>,
  guestEmail: string | undefined
): Promise<{ order: Maybe<OrderDetail>; fetchError: Maybe<string> }> {
  try {
    const res = await fetch(`${API_BASE}/api/orders/${id}`, {
      headers: isSome(authToken)
        ? { Authorization: `Bearer ${authToken.value}` }
        : guestEmail
          ? { "x-guest-email": guestEmail }
          : {},
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
  if (isNone(order)) return { label: "", colour: "text-muted-foreground bg-muted border-border" };
  const status = order.value.status;
  return (
    STATUS_LABELS[status] ?? {
      label: status,
      colour: "text-muted-foreground bg-muted border-border",
    }
  );
}

function OrderLineItems({ lines, currency }: { lines: OrderLine[]; currency: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="px-6 py-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Items Ordered</h2>
      <div className="space-y-3">
        {lines.map((line) => (
          <div
            key={`${line.productId.value}:${line.size}`}
            className="flex justify-between items-start"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{line.productName}</p>
              <p className="text-xs text-muted-foreground">
                Size: {line.size} · Qty: {line.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground">
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
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Subtotal</span>
        <span>{formatPrice({ amount: subtotalCents / 100, currency })}</span>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-sm text-success">
          <span>Discount</span>
          <span>−{formatPrice({ amount: discountCents / 100, currency })}</span>
        </div>
      )}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Shipping</span>
        <span>
          {shippingCents === 0 ? "Free" : formatPrice({ amount: shippingCents / 100, currency })}
        </span>
      </div>
      {taxCents > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>VAT (7%)</span>
          <span>{formatPrice({ amount: taxCents / 100, currency })}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold text-foreground border-t border-border pt-2 mt-1">
        <span>Total</span>
        <span>{formatPrice({ amount: totalCents / 100, currency })}</span>
      </div>
    </div>
  );
}

function ShippingInfo({ address }: { address: OrderDetail["shippingAddress"] }) {
  return (
    <div className="px-6 py-4">
      <h2 className="text-sm font-semibold text-foreground mb-1">Ship to</h2>
      <p className="text-sm text-muted-foreground">{address.recipientName}</p>
      <p className="text-sm text-muted-foreground">{address.street}</p>
      <p className="text-sm text-muted-foreground">
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
  const guestEmail = isNone(authToken) ? await getGuestEmail() : undefined;
  const { order, fetchError } = await fetchOrderDetail(id, authToken, guestEmail);
  const breakdown = computePriceBreakdown(order);
  const statusInfo = getStatusInfo(order);
  const isGuest = isNone(authToken) && isSome(order);

  return (
    <div className="min-h-screen bg-muted">
      <ClearCartOnMount />
      {isSome(order) && (
        <OrderTracker
          orderId={id}
          totalCents={order.value.totalAmountInCents}
          currency={order.value.currency}
          itemCount={order.value.lines.length}
        />
      )}

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Success header — the animated completion moment */}
        <OrderSuccessHeader orderId={id} />

        {/* Order detail card */}
        <Reveal
          delay={0.1}
          className="rounded-lg bg-card border border-border divide-y divide-border"
        >
          {/* Status */}
          {isSome(order) && (
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Status</span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-medium ${statusInfo.colour}`}
              >
                {statusInfo.label}
              </span>
            </div>
          )}

          {isSome(fetchError) && (
            <div className="px-6 py-4 text-sm text-destructive">{fetchError.value}</div>
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
            <h2 className="text-sm font-semibold text-foreground">What happens next?</h2>
            <p className="text-sm text-muted-foreground">
              You will receive an email confirmation shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              Your order will be processed and shipped within 2–3 business days.
            </p>
          </div>
        </Reveal>

        {/* Optional post-purchase account upsell — guest checkout is never gated,
            but creating an account afterwards makes future order tracking easier. */}
        {isGuest && (
          <div className="mt-6 rounded-lg border border-info bg-info-subtle p-4 text-center">
            <p className="text-sm text-foreground">
              Save this order to an account to track it and check out faster next time.
            </p>
            <Link
              href="/auth/register"
              className="mt-2 inline-block text-sm font-medium text-info hover:text-info/80 underline"
            >
              Create an account
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/products"
            className="rounded-lg bg-info px-6 py-3 text-white font-medium hover:bg-info/90 text-center"
          >
            Continue Shopping
          </Link>
          {!isGuest && (
            <Link
              href="/account/orders"
              className="rounded-lg border border-border-strong px-6 py-3 text-muted-foreground font-medium hover:bg-muted text-center"
            >
              View My Orders
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
