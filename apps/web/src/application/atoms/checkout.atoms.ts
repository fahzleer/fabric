import { Atom } from "@effect-atom/atom-react";
import { Effect, Option } from "effect";
import { cartAtom } from "./cart.atoms";

export type CheckoutStep = "address" | "summary" | "payment" | "confirmation";

export type ShippingAddressFormData = {
  readonly recipientName: string;
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
  readonly country: string;
  readonly phone: string;
  readonly province?: string;
};

export type PricingPreview = {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  voucherError: string | null;
};

export const checkoutStepAtom = Atom.make<CheckoutStep>("address");
export const shippingAddressAtom = Atom.make(Option.none<ShippingAddressFormData>());
export const placedOrderIdAtom = Atom.make(Option.none<string>());
export const voucherCodeAtom = Atom.make("");
export const pricingPreviewAtom = Atom.make(Option.none<PricingPreview>());

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";

export const pricingPreviewFetchAtom = Atom.make((get) => {
  const shippingAddress = get(shippingAddressAtom);
  const voucherCode = get(voucherCodeAtom);
  const cart = get(cartAtom);

  if (Option.isNone(shippingAddress) || Option.isNone(cart)) {
    return Effect.sync(() => {
      get.set(pricingPreviewAtom, Option.none());
    });
  }

  const addr = shippingAddress.value;
  const cartValue = cart.value;

  return Effect.gen(function* () {
    const sessionRes = yield* Effect.tryPromise(() =>
      fetch("/api/auth/get-session", { credentials: "include" }).then(
        (r) => r.json() as Promise<{ session?: { token?: string } }>
      )
    );
    const authToken = sessionRes.session?.token;

    const res = yield* Effect.tryPromise(() =>
      fetch(`${API_BASE}/api/orders/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          cartId: cartValue.id,
          country: addr.country,
          province: addr.city,
          voucherCode: voucherCode || undefined,
        }),
      })
    );

    if (!res.ok) {
      get.set(pricingPreviewAtom, Option.none());
      return;
    }

    const data = yield* Effect.tryPromise(() => res.json() as Promise<PricingPreview>);
    get.set(pricingPreviewAtom, Option.some(data));
  }).pipe(
    Effect.catchAll(() =>
      Effect.sync(() => {
        get.set(pricingPreviewAtom, Option.none());
      })
    )
  );
});
