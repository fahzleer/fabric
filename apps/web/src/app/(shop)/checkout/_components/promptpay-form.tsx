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
import { syncCartToServer } from "@/lib/sync-cart";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { Option } from "effect";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const POLL_INTERVAL_MS = 3_000;
const QR_DURATION_MS = 15 * 60 * 1000;

type PromptPayFormProps = {
  cart: Maybe<ShoppingCart>;
  onBack: () => void;
};

type PromptPayStatus = "pending" | "successful" | "failed" | "expired";

type Phase =
  | { _tag: "idle" }
  | { _tag: "placing" }
  | { _tag: "generating" }
  | { _tag: "waiting"; chargeId: string; qrImageUrl: string; expiresAt: Date; orderId: string }
  | { _tag: "paid"; orderId: string }
  | { _tag: "error"; message: string }
  | { _tag: "expired" };

type PromptPayShippingAddress = {
  recipientName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  province: string;
};

type RawShippingAddress = Omit<PromptPayShippingAddress, "province"> & { province?: string };

type OrderResult = { ok: true; orderId: string } | { ok: false; message: string };
type QrResult =
  | { ok: true; chargeId: string; qrImageUrl: string; expiresAt: Date }
  | { ok: false; message: string };
type PollAction = "continue" | "expire" | "failed" | "paid";

type PromptPayFlowDeps = {
  setPhase: (p: Phase) => void;
  startCountdown: (expiresAt: Date) => void;
  startPolling: (chargeId: string, orderId: string, expiresAt: Date) => void;
};

type PollCallbacks = {
  clearTimers: () => void;
  setPhase: (p: Phase) => void;
  setPlacedOrderId: (v: Option.Option<string>) => void;
  push: (url: string) => void;
};

const promptPayPhaseAtom = Atom.make<Phase>({ _tag: "idle" });
const promptPayTimeLeftAtom = Atom.make<number>(QR_DURATION_MS);

async function fetchPromptPayAuthToken(): Promise<Maybe<string>> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = (await res.json()) as { session?: { token?: string } };
    return data.session?.token ? Some(data.session.token) : None();
  } catch {
    return None();
  }
}

async function createPromptPayOrder(
  cartId: string,
  voucherCode: string,
  shippingAddress: PromptPayShippingAddress,
  authToken: Maybe<string>
): Promise<OrderResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      cartId,
      paymentMethod: "promptpay",
      voucherCode: voucherCode || undefined,
      shippingAddress,
    }),
  });
  if (!res.ok) {
    const message =
      res.status === 401
        ? "Session expired. Please sign in again."
        : res.status === 422
          ? "Invalid order. Please go back and check your cart."
          : "Could not create order. Please try again.";
    return { ok: false, message };
  }
  const order = (await res.json()) as { id?: { value?: string } | string };
  const orderId = typeof order.id === "string" ? order.id : order.id?.value;
  if (!orderId) {
    return { ok: false, message: "Order created but ID missing. Contact support." };
  }
  return { ok: true, orderId };
}

async function createPromptPayQr(orderId: string, authToken: Maybe<string>): Promise<QrResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {}),
  };
  const res = await fetch(`${API_BASE}/api/payment/promptpay/create`, {
    method: "POST",
    headers,
    body: JSON.stringify({ orderId }),
  });
  if (!res.ok) {
    return { ok: false, message: "Could not generate QR code. Please try again." };
  }
  const data = (await res.json()) as {
    chargeId?: string;
    qrImageUrl?: string;
    expiresAt?: string;
  };
  if (!(data.chargeId && data.qrImageUrl)) {
    return { ok: false, message: "QR code data incomplete. Please try again." };
  }
  const expiresAt = data.expiresAt
    ? new Date(data.expiresAt)
    : new Date(Date.now() + QR_DURATION_MS);
  return { ok: true, chargeId: data.chargeId, qrImageUrl: data.qrImageUrl, expiresAt };
}

async function checkPromptPayStatus(
  chargeId: string,
  authToken: Maybe<string>,
  expiresAt: Date
): Promise<PollAction> {
  if (Date.now() >= expiresAt.getTime()) return "expire";
  try {
    const res = await fetch(`${API_BASE}/api/payment/promptpay/${chargeId}/status`, {
      headers: isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {},
    });
    if (!res.ok) return "continue";
    const data = (await res.json()) as { status?: PromptPayStatus };
    if (data.status === "successful") return "paid";
    if (data.status === "failed" || data.status === "expired") return "failed";
    return "continue";
  } catch {
    return "continue";
  }
}

async function runPollTick(
  chargeId: string,
  authToken: Maybe<string>,
  expiresAt: Date,
  orderId: string,
  cb: PollCallbacks
): Promise<void> {
  const action = await checkPromptPayStatus(chargeId, authToken, expiresAt);
  if (action === "expire" || action === "failed") {
    cb.clearTimers();
    cb.setPhase({ _tag: "expired" });
  } else if (action === "paid") {
    cb.clearTimers();
    cb.setPlacedOrderId(Option.some(orderId));
    cb.setPhase({ _tag: "paid", orderId });
    cb.push(`/order/${orderId}/confirmation`);
  }
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function isIdlePhase(phase: Phase): boolean {
  return phase._tag === "idle" || phase._tag === "error" || phase._tag === "expired";
}

function showStartButton(phase: Phase): boolean {
  return phase._tag !== "waiting" && phase._tag !== "paid";
}

function getStartButtonLabel(phase: Phase, isLoading: boolean): string {
  if (isLoading) return "Please wait…";
  if (phase._tag === "expired") return "Generate New QR";
  return "Generate QR Code";
}

function resolveCurrency(cart: Maybe<ShoppingCart>): string {
  return isSome(cart) ? (cart.value.items[0]?.productSnapshot.price.currency ?? "THB") : "THB";
}

function resolveTotalAmount(
  pricingPreview: Option.Option<{ totalCents: number }>,
  cart: Maybe<ShoppingCart>
): number {
  if (Option.isSome(pricingPreview)) return pricingPreview.value.totalCents / 100;
  if (isSome(cart)) return getCartTotal(cart.value);
  return 0;
}

async function executePromptPayFlow(
  cart: ShoppingCart,
  voucherCode: string,
  rawShipping: RawShippingAddress,
  authToken: Maybe<string>,
  deps: PromptPayFlowDeps
): Promise<void> {
  const shipping: PromptPayShippingAddress = {
    ...rawShipping,
    province: rawShipping.province ?? "Bangkok",
  };
  const orderResult = await createPromptPayOrder(cart.id, voucherCode, shipping, authToken);
  if (!orderResult.ok) {
    deps.setPhase({ _tag: "error", message: orderResult.message });
    return;
  }
  deps.setPhase({ _tag: "generating" });
  const qrResult = await createPromptPayQr(orderResult.orderId, authToken);
  if (!qrResult.ok) {
    deps.setPhase({ _tag: "error", message: qrResult.message });
    return;
  }
  deps.setPhase({
    _tag: "waiting",
    chargeId: qrResult.chargeId,
    qrImageUrl: qrResult.qrImageUrl,
    expiresAt: qrResult.expiresAt,
    orderId: orderResult.orderId,
  });
  deps.startCountdown(qrResult.expiresAt);
  deps.startPolling(qrResult.chargeId, orderResult.orderId, qrResult.expiresAt);
}

function WaitingSection({ phase, timeLeft }: { phase: Phase; timeLeft: number }) {
  if (phase._tag !== "waiting") return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">QR expires in</span>
        <span
          className={`font-mono font-semibold text-lg ${timeLeft < 60_000 ? "text-red-600" : "text-gray-900"}`}
        >
          {formatCountdown(timeLeft)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${timeLeft < 60_000 ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.max(0, (timeLeft / QR_DURATION_MS) * 100)}%` }}
        />
      </div>
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="rounded-xl border-2 border-emerald-200 p-4 bg-white shadow-sm">
          <img
            src={phase.qrImageUrl}
            alt="PromptPay QR code"
            width={220}
            height={220}
            className="block"
          />
        </div>
        <p className="text-center text-sm text-gray-500 max-w-xs">
          Open your banking app, choose <span className="font-medium">PromptPay</span>, and scan
          this QR code to pay.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        Waiting for payment confirmation…
      </div>
    </div>
  );
}

export function PromptPayForm({ cart, onBack }: PromptPayFormProps) {
  const router = useRouter();
  const shippingAddressOption = useAtomValue(shippingAddressAtom);
  const setPlacedOrderId = useAtomSet(placedOrderIdAtom);
  const voucherCode = useAtomValue(voucherCodeAtom);
  const pricingPreviewOption = useAtomValue(pricingPreviewAtom);

  const [phase, setPhase] = useAtom(promptPayPhaseAtom);
  const [timeLeft, setTimeLeft] = useAtom(promptPayTimeLeftAtom);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authTokenRef = useRef<Maybe<string>>(None());

  const currency = resolveCurrency(cart);
  const totalAmount = resolveTotalAmount(pricingPreviewOption, cart);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startPolling = useCallback(
    (chargeId: string, orderId: string, expiresAt: Date) => {
      if (pollRef.current) clearInterval(pollRef.current);
      const clearTimers = () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
      pollRef.current = setInterval(
        () =>
          runPollTick(chargeId, authTokenRef.current, expiresAt, orderId, {
            clearTimers,
            setPhase,
            setPlacedOrderId,
            push: router.push,
          }),
        POLL_INTERVAL_MS
      );
    },
    [router, setPlacedOrderId, setPhase]
  );

  const startCountdown = useCallback(
    (expiresAt: Date) => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setTimeLeft(expiresAt.getTime() - Date.now());
      countdownRef.current = setInterval(() => {
        const remaining = expiresAt.getTime() - Date.now();
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setTimeLeft(0);
        } else {
          setTimeLeft(remaining);
        }
      }, 1_000);
    },
    [setTimeLeft]
  );

  const handleStart = async () => {
    if (isNone(cart) || cart.value.items.length === 0) return;
    if (Option.isNone(shippingAddressOption)) {
      onBack();
      return;
    }
    const shippingAddress = shippingAddressOption.value;
    const authToken = await fetchPromptPayAuthToken();
    authTokenRef.current = authToken;
    if (isSome(authToken)) {
      await syncCartToServer(cart.value.items, authToken.value);
    }
    setPhase({ _tag: "placing" });
    try {
      await executePromptPayFlow(cart.value, voucherCode, shippingAddress, authToken, {
        setPhase,
        startCountdown,
        startPolling,
      });
    } catch (e) {
      setPhase({ _tag: "error", message: e instanceof Error ? e.message : "Unknown error" });
    }
  };

  const isLoading = phase._tag === "placing" || phase._tag === "generating";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pay via PromptPay</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
          PromptPay QR
        </span>
      </div>

      <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex justify-between font-semibold text-gray-900">
        <span>Total</span>
        <span>{formatPrice({ amount: totalAmount, currency })}</span>
      </div>

      {isIdlePhase(phase) && (
        <>
          {phase._tag === "error" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {phase.message}
            </div>
          )}
          {phase._tag === "expired" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              QR code has expired. Click below to generate a new one.
            </div>
          )}
          <p className="text-sm text-gray-500">
            A QR code will be generated for you to scan with your banking app. The QR code is valid
            for <span className="font-medium">15 minutes</span>.
          </p>
        </>
      )}

      {isLoading && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-center gap-3 text-sm text-blue-700">
          <svg
            className="h-5 w-5 animate-spin shrink-0"
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
          {phase._tag === "placing" ? "Creating order…" : "Generating QR code…"}
        </div>
      )}

      <WaitingSection phase={phase} timeLeft={timeLeft} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading || phase._tag === "paid"}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← Back
        </button>
        {showStartButton(phase) && (
          <button
            type="button"
            onClick={handleStart}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {getStartButtonLabel(phase, isLoading)}
          </button>
        )}
      </div>
    </div>
  );
}
