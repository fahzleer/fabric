"use client";

import {
  loadShippingAddress,
  placedOrderIdAtom,
  pricingPreviewAtom,
  shippingAddressAtom,
  voucherCodeAtom,
} from "@/application/atoms/checkout.atoms";
import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { formatPrice } from "@/lib/price";
import { syncCartToServer } from "@/lib/sync-cart";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Err, type Maybe, None, Ok, type Result, Some, isErr, isNone, isSome } from "@fabric/types";
import { Option } from "effect";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const OMISE_PUBLIC_KEY = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY ?? "";

declare global {
  interface Window {
    Omise?: {
      setPublicKey: (key: string) => void;
      createToken: (
        type: "card",
        data: OmiseCardData,
        callback: (statusCode: number, response: OmiseTokenResponse) => void
      ) => void;
    };
  }
}

interface OmiseCardData {
  name: string;
  number: string;
  expiration_month: number;
  expiration_year: number;
  security_code: string;
}

interface OmiseTokenResponse {
  id?: string;
  object?: string;
  code?: string;
  message?: string;
}

type OmiseCardFormProps = {
  cart: Maybe<ShoppingCart>;
  onBack: () => void;
};

type Status = "idle" | "tokenizing" | "submitting" | "done" | "error";

type OmiseShippingAddress = {
  recipientName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  province: string;
};

type OmiseOrderResult = Result<string, string>;

type RawShippingAddress = Omit<OmiseShippingAddress, "province"> & { province?: string };

type PaymentDeps = {
  setError: (v: Maybe<string>) => void;
  setStatus: (v: Status) => void;
  setPlacedOrderId: (v: Option.Option<string>) => void;
  push: (url: string) => void;
};

const omiseStatusAtom = Atom.make<Status>("idle");
const omiseErrorAtom = Atom.make<Maybe<string>>(None());
const omiseReadyAtom = Atom.make(
  typeof window !== "undefined" && !!window.Omise && !!OMISE_PUBLIC_KEY
);
const cardNameAtom = Atom.make("");
const omiseCardNumAtom = Atom.make("");
const omiseExpMonthAtom = Atom.make("");
const omiseExpYearAtom = Atom.make("");
const omiseCvvAtom = Atom.make("");

async function fetchOmiseAuthToken(): Promise<Maybe<string>> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = (await res.json()) as { session?: { token?: string } };
    return data.session?.token ? Some(data.session.token) : None();
  } catch {
    return None();
  }
}

async function submitOmiseOrder(
  token: string,
  cartId: string,
  voucherCode: string,
  shippingAddress: OmiseShippingAddress,
  authToken: Maybe<string>
): Promise<OmiseOrderResult> {
  const statusMessages: Record<number, string> = {
    402: "Payment declined. Please try another card.",
    401: "Your session has expired. Please sign in again.",
    422: "Invalid order details. Please go back and check your cart.",
    500: "Server error. Please try again in a few minutes.",
  };

  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {}),
    },
    body: JSON.stringify({
      cartId,
      paymentMethod: "card",
      paymentToken: token,
      voucherCode: voucherCode || undefined,
      shippingAddress,
    }),
  });

  if (!res.ok) {
    return Err(statusMessages[res.status] ?? "Order could not be placed. Please try again.");
  }

  const order = (await res.json()) as { id?: { value?: string } | string };
  const orderId = typeof order.id === "string" ? order.id : order.id?.value;
  if (!orderId) {
    return Err("Order placed but no order ID returned. Please contact support.");
  }
  return Ok(orderId);
}

async function executeOmisePayment(
  tokenId: string,
  cart: ShoppingCart,
  voucherCode: string,
  rawShipping: RawShippingAddress,
  deps: PaymentDeps
): Promise<void> {
  const authToken = await fetchOmiseAuthToken();
  if (isSome(authToken)) {
    await syncCartToServer(cart.items, authToken.value);
  }
  const result = await submitOmiseOrder(
    tokenId,
    cart.id,
    voucherCode,
    { ...rawShipping, province: rawShipping.province ?? "Bangkok" },
    authToken
  );
  if (isErr(result)) {
    deps.setError(Some(result.error));
    deps.setStatus("error");
    return;
  }
  deps.setPlacedOrderId(Option.some(result.value));
  deps.setStatus("done");
  deps.push(`/order/${result.value}/confirmation`);
}

const MOCK_MODE = !OMISE_PUBLIC_KEY;

export function OmiseCardForm({ cart, onBack }: OmiseCardFormProps) {
  const router = useRouter();
  const shippingAddressFromAtom = useAtomValue(shippingAddressAtom);
  const shippingAddress = Option.isSome(shippingAddressFromAtom)
    ? shippingAddressFromAtom
    : loadShippingAddress();
  const setPlacedOrderId = useAtomSet(placedOrderIdAtom);
  const voucherCode = useAtomValue(voucherCodeAtom);
  const pricingPreviewOption = useAtomValue(pricingPreviewAtom);

  const [status, setStatus] = useAtom(omiseStatusAtom);
  const [error, setError] = useAtom(omiseErrorAtom);
  const [omiseReady, setOmiseReady] = useAtom(omiseReadyAtom);

  const [cardName, setCardName] = useAtom(cardNameAtom);
  const [cardNumber, setCardNumber] = useAtom(omiseCardNumAtom);
  const [expMonth, setExpMonth] = useAtom(omiseExpMonthAtom);
  const [expYear, setExpYear] = useAtom(omiseExpYearAtom);
  const [cvv, setCvv] = useAtom(omiseCvvAtom);

  const currency = isSome(cart)
    ? (cart.value.items[0]?.productSnapshot.price.currency ?? "THB")
    : "THB";

  const totalAmount = Option.isSome(pricingPreviewOption)
    ? pricingPreviewOption.value.totalCents / 100
    : isSome(cart)
      ? getCartTotal(cart.value)
      : 0;

  const initOmise = () => {
    if (window.Omise && OMISE_PUBLIC_KEY) {
      window.Omise.setPublicKey(OMISE_PUBLIC_KEY);
      setOmiseReady(true);
    }
  };

  const handleMockPay = async () => {
    if (isNone(cart) || cart.value.items.length === 0) return;
    if (Option.isNone(shippingAddress)) {
      onBack();
      return;
    }
    setError(None());
    setStatus("submitting");
    const deps: PaymentDeps = { setError, setStatus, setPlacedOrderId, push: router.push };
    try {
      await executeOmisePayment(
        `tok_mock_${crypto.randomUUID()}`,
        cart.value,
        voucherCode,
        shippingAddress.value,
        deps
      );
    } catch (e) {
      setError(Some(e instanceof Error ? e.message : "Unknown error"));
      setStatus("error");
    }
  };

  const tokenizeAndPay = (
    deps: PaymentDeps,
    cartValue: NonNullable<typeof cart>["value"],
    shippingValue: NonNullable<typeof shippingAddress>["value"]
  ) => {
    window.Omise.createToken(
      "card",
      {
        name: cardName.trim(),
        number: cardNumber.replace(/\s/g, ""),
        expiration_month: Number.parseInt(expMonth, 10),
        expiration_year: Number.parseInt(expYear, 10),
        security_code: cvv.trim(),
      },
      async (statusCode, response) => {
        if (statusCode !== 200 || !response.id) {
          setError(Some(response.message ?? "Card tokenization failed. Please check your card details."));
          setStatus("error");
          return;
        }
        setStatus("submitting");
        try {
          await executeOmisePayment(response.id, cartValue, voucherCode, shippingValue, deps);
        } catch (e) {
          setError(Some(e instanceof Error ? e.message : "Unknown error"));
          setStatus("error");
        }
      }
    );
  };

  const handlePay = async () => {
    if (isNone(cart) || cart.value.items.length === 0) return;
    if (Option.isNone(shippingAddress)) { onBack(); return; }
    if (!(window.Omise && omiseReady)) {
      setError(Some("Payment library not ready. Please wait a moment and try again."));
      return;
    }
    if (!(cardName.trim() && cardNumber.trim() && expMonth && expYear && cvv.trim())) {
      setError(Some("Please fill in all card details."));
      return;
    }

    setError(None());
    setStatus("tokenizing");

    const deps: PaymentDeps = { setError, setStatus, setPlacedOrderId, push: router.push };
    tokenizeAndPay(deps, cart.value, shippingAddress.value);
  };

  const isLoading = status === "tokenizing" || status === "submitting";

  const loadingLabel: Partial<Record<Status, string>> = {
    tokenizing: "Securing card details…",
    submitting: "Placing order…",
  };

  if (MOCK_MODE) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pay by Card</h2>
          <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
            Test mode
          </span>
        </div>
        <p className="text-sm text-gray-500">
          No Omise key configured — using mock payment gateway. Click the button to simulate a
          successful payment.
        </p>
        {status === "error" && isSome(error) && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error.value}
          </div>
        )}
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatPrice({ amount: totalAmount, currency })}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={status === "submitting"}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleMockPay}
            disabled={status === "submitting"}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {status === "submitting"
              ? "Placing order…"
              : `Pay ${formatPrice({ amount: totalAmount, currency })}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script
        id="omise-js"
        src="https://cdn.omise.co/omise.js"
        strategy="lazyOnload"
        onLoad={initOmise}
        onError={() =>
          setError(Some("Failed to load payment library. Please refresh and try again."))
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pay by Card</h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <svg
              className="h-3.5 w-3.5 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Secured by Omise
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="card-name" className="block text-sm font-medium text-gray-700 mb-1">
              Cardholder Name
            </label>
            <input
              id="card-name"
              type="text"
              autoComplete="cc-name"
              placeholder="Name as it appears on card"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label htmlFor="card-number" className="block text-sm font-medium text-gray-700 mb-1">
              Card Number
            </label>
            <input
              id="card-number"
              type="text"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              value={cardNumber}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw;
                setCardNumber(formatted);
              }}
              disabled={isLoading}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="exp-month" className="block text-sm font-medium text-gray-700 mb-1">
                Month
              </label>
              <input
                id="exp-month"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp-month"
                placeholder="MM"
                maxLength={2}
                value={expMonth}
                onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="exp-year" className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                id="exp-year"
                type="text"
                inputMode="numeric"
                autoComplete="cc-exp-year"
                placeholder="YYYY"
                maxLength={4}
                value={expYear}
                onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                CVV
              </label>
              <input
                id="cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="•••"
                maxLength={4}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>
        </div>

        {status === "error" && isSome(error) && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error.value}
          </div>
        )}

        {isLoading && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700 flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {loadingLabel[status]}
          </div>
        )}

        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatPrice({ amount: totalAmount, currency })}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={isLoading || !omiseReady}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Processing…" : `Pay ${formatPrice({ amount: totalAmount, currency })}`}
          </button>
        </div>

        {!(omiseReady || error) && (
          <p className="text-center text-xs text-gray-400">Loading payment library…</p>
        )}
      </div>
    </>
  );
}
