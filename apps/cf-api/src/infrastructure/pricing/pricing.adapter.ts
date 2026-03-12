import type { Result } from "@fabric/types";
import type {
  CheckoutCalculation,
  PricingError,
  PricingPort,
} from "../../application/ports/pricing.port";
import type { VoucherForRoc } from "../../application/ports/voucher.repository.port";
import type { CartItem } from "../../domain/cart/cart.entity";
import { composeSignals } from "../../shared/abort/abort.util";
import { log } from "../monitoring/logger";

export class HttpPricingAdapter implements PricingPort {
  private readonly baseUrl: string;

  constructor(pricingUrl: string = process.env.PRICING_SERVICE_URL ?? "http://localhost:8082") {
    this.baseUrl = pricingUrl;
  }

  async calculateCheckout(
    items: ReadonlyArray<CartItem>,
    voucher: VoucherForRoc | undefined,
    shippingAddress: { country: string; province: string },
    currency: string,
    requestSignal?: AbortSignal | null
  ): Promise<Result<CheckoutCalculation, PricingError>> {
    try {
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

      const signal = composeSignals(requestSignal, 5000);

      const res = await fetch(`${this.baseUrl}/checkout/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
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
    } catch (cause) {
      log.warn("Pricing service unavailable", { error: String(cause) });
      return {
        _tag: "Err",
        error: {
          _tag: "ServiceUnavailable",
          message: "Pricing service unavailable",
        } as unknown as PricingError,
      };
    }
  }
}
