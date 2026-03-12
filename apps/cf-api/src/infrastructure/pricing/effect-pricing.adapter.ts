import type { Result } from "@fabric/types";
import { Duration, Effect, Schedule } from "effect";
import type { CheckoutCalculation, PricingError } from "../../application/ports/pricing.port";
import type { VoucherForRoc } from "../../application/ports/voucher.repository.port";
import type { CartItem } from "../../domain/cart/cart.entity";
import { log } from "../monitoring/logger";

type PricingResult = Result<CheckoutCalculation, PricingError>;

const retryPolicy = Schedule.intersect(
  Schedule.exponential(Duration.millis(100), 2),
  Schedule.recurs(2)
);

const fetchCheckout = (url: string, body: unknown): Effect.Effect<PricingResult, Error> =>
  Effect.tryPromise({
    try: async (): Promise<PricingResult> => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok: boolean;
        value?: CheckoutCalculation;
        error?: { tag: string; message: string };
      };

      if (!(data.ok && data.value)) {
        return {
          _tag: "Err",
          error: {
            _tag: (data.error?.tag ?? "UnknownError") as PricingError["_tag"],
            message: data.error?.message ?? "Pricing service error",
          } as PricingError,
        };
      }
      return { _tag: "Ok", value: data.value };
    },
    catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
  });

export const calculateCheckoutEffect = (
  items: ReadonlyArray<CartItem>,
  voucher: VoucherForRoc | undefined,
  shippingAddress: { country: string; province: string },
  currency: string,
  baseUrl = process.env.PRICING_SERVICE_URL ?? "http://localhost:8082"
): Effect.Effect<PricingResult, never> => {
  const body = {
    items: items.map((item) => ({
      productId: item.productId.value,
      quantity: item.quantity.value,
      unitPriceCents: Math.round(item.unitPrice.amount * 100),
      size: item.size,
    })),
    voucher: voucher ?? null,
    shippingAddress,
    currency,
  };

  const retried = Effect.retry(fetchCheckout(`${baseUrl}/checkout/calculate`, body), retryPolicy);

  return Effect.catchAll(retried, (cause) => {
    log.warn("Pricing service unavailable after retries", { error: cause.message });
    return Effect.succeed<PricingResult>({
      _tag: "Err",
      error: {
        _tag: "ServiceUnavailable",
        message: "Pricing service unavailable",
      } as unknown as PricingError,
    });
  });
};
