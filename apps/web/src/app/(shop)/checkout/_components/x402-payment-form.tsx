"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import {
  placedOrderIdAtom,
  pricingPreviewAtom,
  shippingAddressAtom,
  voucherCodeAtom,
} from "@/application/atoms/checkout.atoms";
import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { formatPrice } from "@/lib/price";
import { syncCartToServer } from "@/lib/sync-cart";
import { Atom, Result, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { type Maybe, None, Some, isNone, isSome } from "@fabric/types";
import { Button } from "@fabric/ui";
import { Effect, Option } from "effect";
import { useRouter } from "next/navigation";
import { getAddress } from "viem";
import { base, baseSepolia } from "viem/chains";
import { useAccount, useConnect, useSignTypedData, useSwitchChain } from "wagmi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const MERCHANT_WALLET = process.env.NEXT_PUBLIC_MERCHANT_WALLET as `0x${string}` | undefined;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_X402_CHAIN_ID ?? "84532");
const TARGET_CHAIN = CHAIN_ID === 8453 ? base : baseSepolia;
const RATE_URL = "/api/crypto/rate";

const usdcEstimateAtom = Atom.make((get) => {
  const previewOpt = get(pricingPreviewAtom);
  const cart = get(cartAtom);
  const totalCents = Option.isSome(previewOpt)
    ? previewOpt.value.totalCents
    : Option.isSome(cart)
      ? getCartTotal(cart.value)
      : 0;
  if (totalCents === 0) return Effect.succeed(Option.none<number>());
  return Effect.tryPromise({
    try: async () => {
      const res = await fetch(RATE_URL);
      const data = (await res.json()) as { thbPerUsdc: number };
      const usdc = totalCents / 100 / data.thbPerUsdc;
      return Option.some(Math.ceil(usdc * 100) / 100);
    },
    catch: () => Option.none<number>(),
  });
});

type PaymentRequirements = {
  scheme: string;
  networkId: string;
  maxAmountRequired: string;
  resource: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: `0x${string}`;
  extra?: { name?: string; version?: string };
};

type X402ProbeResponse = {
  x402Version: number;
  accepts: PaymentRequirements[];
};

type X402PaymentFormProps = {
  cart: Maybe<ShoppingCart>;
  onBack: () => void;
};

type ShippingAddress = {
  recipientName: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  province: string;
};

type Status =
  | "idle"
  | "connecting"
  | "switching"
  | "probing"
  | "signing"
  | "submitting"
  | "done"
  | "error";

type X402PaymentDeps = {
  setStatus: (s: Status) => void;
  setError: (e: Maybe<string>) => void;
  setPlacedOrderId: (v: Option.Option<string>) => void;
  push: (url: string) => void;
  switchChainAsync: ReturnType<typeof useSwitchChain>["switchChainAsync"];
  signTypedDataAsync: ReturnType<typeof useSignTypedData>["signTypedDataAsync"];
};

const buildEip3009TypedData = (
  requirements: PaymentRequirements,
  from: `0x${string}`,
  chainId: number
) => {
  const validBefore = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;
  const nonce = `0x${crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}` as `0x${string}`;
  return {
    domain: {
      name: requirements.extra?.name ?? "USD Coin",
      version: requirements.extra?.version ?? "2",
      chainId,
      verifyingContract: requirements.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    } as const,
    primaryType: "TransferWithAuthorization" as const,
    message: {
      from,
      to: getAddress(requirements.payTo as `0x${string}`),
      value: BigInt(requirements.maxAmountRequired),
      validAfter: 0n,
      validBefore: BigInt(validBefore),
      nonce,
    },
    _nonce: nonce,
    _validBefore: validBefore,
  };
};

async function fetchSessionToken(): Promise<Maybe<string>> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = (await res.json()) as { session?: { token?: string } };
    return data.session?.token ? Some(data.session.token) : None();
  } catch {
    return None();
  }
}

type RawShippingAddress = Omit<ShippingAddress, "province"> & { province?: string };

function buildOrderBody(
  cartId: string,
  voucherCode: string,
  rawShipping: RawShippingAddress
): object {
  return {
    cartId,
    paymentMethod: "crypto",
    voucherCode: voucherCode || undefined,
    shippingAddress: { ...rawShipping, province: rawShipping.province ?? "Bangkok" },
  };
}

function buildXPaymentHeader(
  requirements: PaymentRequirements,
  address: `0x${string}`,
  signature: `0x${string}`,
  typedData: { _nonce: `0x${string}`; _validBefore: number }
): string {
  const payload = {
    x402Version: 1,
    scheme: "exact",
    networkId: requirements.networkId,
    payload: {
      signature,
      authorization: {
        from: address,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter: "0",
        validBefore: typedData._validBefore.toString(),
        nonce: typedData._nonce,
      },
    },
  };
  return btoa(JSON.stringify(payload));
}

function getX402ErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    402: "Payment was rejected. Please try again.",
    401: "Your session has expired. Please log in again.",
    429: "Too many attempts. Please wait a moment.",
    500: "Server error. Please try again in a few minutes.",
  };
  return messages[status] ?? "Order could not be placed. Please try again.";
}

function resolveErrorMessage(e: unknown): string {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (message.includes("User rejected") || message.includes("user rejected")) {
    return "Signature cancelled. Click Pay to try again.";
  }
  return message;
}

function resolveCurrency(cart: Maybe<ShoppingCart>): string {
  return isSome(cart) ? (cart.value.items[0]?.productSnapshot.price.currency ?? "THB") : "THB";
}

function resolveTotalCents(
  pricingPreview: Option.Option<{ totalCents: number }>,
  cart: Maybe<ShoppingCart>
): number {
  if (Option.isSome(pricingPreview)) return pricingPreview.value.totalCents;
  if (isSome(cart)) return getCartTotal(cart.value);
  return 0;
}

function resolveConnectButtonLabel(status: Status): string {
  return status === "connecting" ? "Connecting…" : "Connect Wallet";
}

function resolvePayButtonLabel(isLoading: boolean, estimatedUsdc: Option.Option<number>): string {
  if (isLoading) return "Processing…";
  if (Option.isSome(estimatedUsdc)) return `Pay ≈ ${estimatedUsdc.value.toFixed(2)} USDC`;
  return "Pay with USDC";
}

async function executeX402Payment(
  cart: ShoppingCart,
  voucherCode: string,
  shippingAddress: RawShippingAddress,
  address: `0x${string}`,
  isOnCorrectChain: boolean,
  deps: X402PaymentDeps
): Promise<void> {
  if (!isOnCorrectChain) {
    deps.setStatus("switching");
    await deps.switchChainAsync({ chainId: TARGET_CHAIN.id });
  }
  const authToken = await fetchSessionToken();
  if (isSome(authToken)) {
    await syncCartToServer(cart.items, authToken.value);
  }
  const orderBody = buildOrderBody(cart.id, voucherCode, shippingAddress);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(isSome(authToken) ? { Authorization: `Bearer ${authToken.value}` } : {}),
  };
  deps.setStatus("probing");
  const probeRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderBody),
  });
  if (probeRes.status !== 402) {
    deps.setError(Some("Expected payment challenge but received an unexpected response."));
    deps.setStatus("error");
    return;
  }
  const probe = (await probeRes.json()) as X402ProbeResponse;
  const requirements = probe.accepts[0];
  if (!requirements) {
    deps.setError(Some("Server did not return payment requirements."));
    deps.setStatus("error");
    return;
  }
  deps.setStatus("signing");
  const typedData = buildEip3009TypedData(requirements, address, TARGET_CHAIN.id);
  const signature = await deps.signTypedDataAsync(typedData);
  const xPaymentHeader = buildXPaymentHeader(requirements, address, signature, typedData);
  deps.setStatus("submitting");
  const orderRes = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: { ...headers, "X-Payment": xPaymentHeader },
    body: JSON.stringify(orderBody),
  });
  if (!orderRes.ok) {
    deps.setError(Some(getX402ErrorMessage(orderRes.status)));
    deps.setStatus("error");
    return;
  }
  const order = (await orderRes.json()) as { id?: { value?: string } };
  const orderId = order.id?.value;
  if (!orderId) {
    deps.setError(Some("Order placed but no order ID returned. Please contact support."));
    deps.setStatus("error");
    return;
  }
  deps.setPlacedOrderId(Option.some(orderId));
  deps.setStatus("done");
  deps.push(`/order/${orderId}/confirmation`);
}

const x402StatusAtom = Atom.make<Status>("idle");
const x402ErrorAtom = Atom.make<Maybe<string>>(None());

export function X402PaymentForm({ cart, onBack }: X402PaymentFormProps) {
  const router = useRouter();
  const shippingAddressOption = useAtomValue(shippingAddressAtom);
  const setPlacedOrderId = useAtomSet(placedOrderIdAtom);
  const voucherCode = useAtomValue(voucherCodeAtom);
  const pricingPreviewOption = useAtomValue(pricingPreviewAtom);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  const [status, setStatus] = useAtom(x402StatusAtom);
  const [error, setError] = useAtom(x402ErrorAtom);

  const usdcResult = useAtomValue(usdcEstimateAtom);
  const estimatedUsdc = Result.isSuccess(usdcResult) ? usdcResult.value : Option.none<number>();

  const currency = resolveCurrency(cart);
  const totalCents = resolveTotalCents(pricingPreviewOption, cart);
  const isOnCorrectChain = chain?.id === TARGET_CHAIN.id;

  const handleConnect = () => {
    setError(None());
    setStatus("connecting");
    const injectedConnector = connectors.find((c) => c.type === "injected");
    if (!injectedConnector) {
      setError(Some("No Web3 wallet found. Install MetaMask or another injected wallet."));
      setStatus("error");
      return;
    }
    connect(
      { connector: injectedConnector },
      {
        onError: (e) => {
          setError(Some(e.message));
          setStatus("error");
        },
        onSuccess: () => setStatus("idle"),
      }
    );
  };

  const handlePay = async () => {
    if (isNone(cart) || cart.value.items.length === 0) return;
    if (Option.isNone(shippingAddressOption)) {
      onBack();
      return;
    }
    setError(None());
    try {
      await executeX402Payment(
        cart.value,
        voucherCode,
        shippingAddressOption.value,
        address as `0x${string}`,
        isOnCorrectChain,
        {
          setStatus,
          setError,
          setPlacedOrderId,
          push: router.push,
          switchChainAsync,
          signTypedDataAsync,
        }
      );
    } catch (e) {
      setError(Some(resolveErrorMessage(e)));
      setStatus("error");
    }
  };

  const isLoading = ["connecting", "switching", "probing", "signing", "submitting"].includes(
    status
  );

  const loadingLabel: Partial<Record<Status, string>> = {
    connecting: "Connecting wallet...",
    switching: `Switching to ${TARGET_CHAIN.name}...`,
    probing: "Fetching payment details...",
    signing: "Waiting for signature...",
    submitting: "Confirming order...",
  };

  return (
    <div className="bg-white rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Pay with USDC</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-info-subtle border border-info px-2.5 py-1 text-xs font-medium text-info">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="9" />
          </svg>
          Base · USDC
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Network: <span className="font-medium text-muted-foreground">{TARGET_CHAIN.name}</span>
        {MERCHANT_WALLET && (
          <>
            {" "}
            · To:{" "}
            <span className="font-mono">
              {MERCHANT_WALLET.slice(0, 6)}…{MERCHANT_WALLET.slice(-4)}
            </span>
          </>
        )}
      </p>

      {isConnected && address ? (
        <div className="rounded-lg bg-success-subtle border border-success p-3 text-sm text-success">
          <span className="font-medium">Wallet connected: </span>
          <span className="font-mono">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          {!isOnCorrectChain && (
            <span className="ml-2 text-warning font-medium">
              (wrong network — will switch to {TARGET_CHAIN.name})
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-muted border border-border p-3 text-sm text-muted-foreground">
          Connect a Web3 wallet (MetaMask or compatible) to pay with USDC.
        </div>
      )}

      {status === "error" && isSome(error) && (
        <div className="rounded-lg bg-destructive-subtle border border-destructive p-3 text-xs text-destructive">
          {error.value}
        </div>
      )}

      {isLoading && loadingLabel[status] && (
        <div className="rounded-lg bg-info-subtle border border-info p-3 text-xs text-info flex items-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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

      <div className="border-t border-border pt-4 space-y-1">
        <div className="flex justify-between font-semibold text-foreground">
          <span>Total to pay</span>
          <span>{formatPrice({ amount: totalCents / 100, currency })}</span>
        </div>
        {Option.isSome(estimatedUsdc) && (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Approx. USDC</span>
            <span>≈ {estimatedUsdc.value.toFixed(2)} USDC</span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1"
        >
          ← Back
        </Button>
        {!isConnected ? (
          <Button
            type="button"
            size="lg"
            onClick={handleConnect}
            disabled={isLoading}
            className="flex-1"
          >
            {resolveConnectButtonLabel(status)}
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={handlePay}
            disabled={isLoading}
            className="flex-1"
          >
            {resolvePayButtonLabel(isLoading, estimatedUsdc)}
          </Button>
        )}
      </div>
    </div>
  );
}
