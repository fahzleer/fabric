"use client";

import {
  placedOrderIdAtom,
  pricingPreviewAtom,
  shippingAddressAtom,
  voucherCodeAtom,
} from "@/application/atoms/checkout.atoms";
import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { type Maybe, None, Some, isNone, isSome } from "@/lib/maybe";
import { formatPrice } from "@/lib/price";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Option } from "effect";
import { useRouter } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

type StripeInstance = {
  createToken: (
    type: "card",
    data: StripeCardData
  ) => Promise<{ token?: { id: string }; error?: { message?: string } }>;
};

type StripeCardData = {
  name: string;
  number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
};

type ShippingAddress = {
  recipientName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
};

interface StripePaymentFormProps {
  cart: Maybe<ShoppingCart>;
  onBack: () => void;
}

type StripeStatus = "idle" | "tokenizing" | "processing" | "failed";

type OrderResult = { success: true; orderId: string } | { success: false; error: string };

type StripeOrderDeps = {
  setStatus: (s: StripeStatus) => void;
  setError: (e: Maybe<string>) => void;
  setPlacedOrderId: (v: Option.Option<string>) => void;
  push: (url: string) => void;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

const stripeReadyAtom = Atom.make(
  typeof window !== "undefined" && !!window.Stripe && !!STRIPE_PUBLISHABLE_KEY
);
const stripeStatusAtom = Atom.make<StripeStatus>("idle");
const stripeErrorAtom = Atom.make<Maybe<string>>(None());
const cardholderNameAtom = Atom.make("");
const stripeCardNumberAtom = Atom.make("");
const stripeExpiryAtom = Atom.make("");
const stripeCvvAtom = Atom.make("");

function formatCardNumber(raw: string): string {
  return raw
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function buildCardData(
  name: string,
  cardNumber: string,
  expiry: string,
  cvv: string
): StripeCardData {
  const [expMonth, expYear] = expiry.split("/");
  return {
    name: name.trim(),
    number: cardNumber.replace(/\s/g, ""),
    exp_month: Number(expMonth),
    exp_year: Number(`20${expYear}`),
    cvc: cvv,
  };
}

async function fetchSessionToken(): Promise<Maybe<string>> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = (await res.json()) as { session?: { token?: string } };
    return data.session?.token ? Some(data.session.token) : None();
  } catch {
    return None();
  }
}

function getOrderErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    401: "Your session has expired. Please log in again and retry.",
    422: "Your cart contains invalid items. Please review it and try again.",
    429: "Too many attempts. Please wait a moment before trying again.",
    500: "Our servers encountered an error. Please try again in a few minutes.",
    502: "Our servers encountered an error. Please try again in a few minutes.",
    503: "Our servers are temporarily unavailable. Please try again shortly.",
  };
  return messages[status] ?? "Order could not be placed. Please try again.";
}

async function submitOrder(
  cartId: string,
  paymentToken: string,
  voucherCode: string,
  shippingAddress: ShippingAddress,
  authToken: Maybe<string>
): Promise<OrderResult> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {}),
    },
    body: JSON.stringify({
      cartId,
      paymentToken,
      voucherCode: voucherCode || undefined,
      shippingAddress,
    }),
  });
  if (!res.ok) {
    return { success: false, error: getOrderErrorMessage(res.status) };
  }
  const order = (await res.json()) as { id?: { value?: string } };
  const orderId = order.id?.value;
  if (!orderId) {
    return {
      success: false,
      error: "Order was placed but the server did not return an order ID. Please contact support.",
    };
  }
  return { success: true, orderId };
}

async function executeStripeOrder(
  cart: ShoppingCart,
  tokenId: string,
  voucherCode: string,
  shippingAddress: ShippingAddress,
  deps: StripeOrderDeps
): Promise<void> {
  const authToken = await fetchSessionToken();
  const result = await submitOrder(cart.id, tokenId, voucherCode, shippingAddress, authToken);
  if (!result.success) {
    deps.setError(Some(result.error));
    deps.setStatus("failed");
    return;
  }
  deps.setPlacedOrderId(Option.some(result.orderId));
  deps.push(`/order/${result.orderId}/confirmation`);
}

export function StripePaymentForm({ cart, onBack }: StripePaymentFormProps) {
  const router = useRouter();
  const shippingAddressOption = useAtomValue(shippingAddressAtom);
  const setPlacedOrderId = useAtomSet(placedOrderIdAtom);
  const voucherCode = useAtomValue(voucherCodeAtom);
  const pricingPreviewOption = useAtomValue(pricingPreviewAtom);

  const [stripeReady, setStripeReady] = useAtom(stripeReadyAtom);
  const [status, setStatus] = useAtom(stripeStatusAtom);
  const [error, setError] = useAtom(stripeErrorAtom);

  const [cardholderName, setCardholderName] = useAtom(cardholderNameAtom);
  const [cardNumber, setCardNumber] = useAtom(stripeCardNumberAtom);
  const [expiry, setExpiry] = useAtom(stripeExpiryAtom);
  const [cvv, setCvv] = useAtom(stripeCvvAtom);

  const currency = isSome(cart)
    ? (cart.value.items[0]?.productSnapshot.price.currency ?? "THB")
    : "THB";
  const totalCents = Option.isSome(pricingPreviewOption)
    ? pricingPreviewOption.value.totalCents
    : isSome(cart)
      ? getCartTotal(cart.value)
      : 0;

  const initStripe = () => {
    if (window.Stripe && STRIPE_PUBLISHABLE_KEY) {
      setStripeReady(true);
    }
  };

  const handlePay = async () => {
    if (isNone(cart) || cart.value.items.length === 0) return;
    if (Option.isNone(shippingAddressOption)) {
      onBack();
      return;
    }
    if (!(stripeReady && window.Stripe)) {
      setError(Some("Payment system is loading. Please wait."));
      return;
    }
    setError(None());
    setStatus("tokenizing");
    const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
    const { token, error: stripeError } = await stripe.createToken(
      "card",
      buildCardData(cardholderName, cardNumber, expiry, cvv)
    );
    if (!token?.id || stripeError) {
      setError(
        Some(stripeError?.message ?? "Card tokenisation failed. Please check your card details.")
      );
      setStatus("failed");
      return;
    }
    setStatus("processing");
    try {
      await executeStripeOrder(cart.value, token.id, voucherCode, shippingAddressOption.value, {
        setStatus,
        setError,
        setPlacedOrderId,
        push: router.push,
      });
    } catch {
      setError(Some("Network error. Please try again."));
      setStatus("failed");
    }
  };

  const isLoading = status === "tokenizing" || status === "processing";

  return (
    <>
      <Script
        id="stripe-js"
        src="https://js.stripe.com/v3/"
        strategy="lazyOnload"
        onLoad={initStripe}
      />
      <div className="bg-card rounded-sm border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Payment</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                clipRule="evenodd"
              />
            </svg>
            Secured by Stripe
          </span>
        </div>

        <div>
          <label
            htmlFor="cardholderName"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Cardholder Name
          </label>
          <input
            id="cardholderName"
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted"
            placeholder="Name on card"
            autoComplete="cc-name"
          />
        </div>

        <div>
          <label htmlFor="cardNumber" className="block text-sm font-medium text-foreground mb-1">
            Card Number
          </label>
          <input
            id="cardNumber"
            type="text"
            inputMode="numeric"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            disabled={isLoading}
            maxLength={19}
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-price text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted"
            placeholder="1234 5678 9012 3456"
            autoComplete="cc-number"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="expiry" className="block text-sm font-medium text-foreground mb-1">
              Expiry
            </label>
            <input
              id="expiry"
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              disabled={isLoading}
              maxLength={5}
              className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-price text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted"
              placeholder="MM/YY"
              autoComplete="cc-exp"
            />
          </div>
          <div>
            <label htmlFor="cvv" className="block text-sm font-medium text-foreground mb-1">
              CVV
            </label>
            <input
              id="cvv"
              type="text"
              inputMode="numeric"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
              disabled={isLoading}
              maxLength={4}
              className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm font-price text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted"
              placeholder="CVV"
              autoComplete="cc-csc"
            />
          </div>
        </div>

        {isSome(error) && (
          <div className="rounded-sm bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {error.value}
          </div>
        )}

        <div className="border-t border-border pt-4 flex justify-between font-semibold text-foreground">
          <span>Total to pay</span>
          <span className="font-price">{formatPrice({ amount: totalCents / 100, currency })}</span>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1 rounded-sm border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={isLoading || !stripeReady}
            className="flex-1 rounded-sm bg-primary px-4 py-3 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
          >
            {status === "tokenizing"
              ? "Verifying card..."
              : status === "processing"
                ? "Processing..."
                : `Pay ${formatPrice({ amount: totalCents / 100, currency })}`}
          </button>
        </div>
      </div>
    </>
  );
}
