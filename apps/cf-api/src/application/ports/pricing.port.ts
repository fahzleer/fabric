import type { Result } from "@fabric/types";
import type { CartItem } from "../../domain/cart/cart.entity";
import type { VoucherForRoc } from "./voucher.repository.port";

export type CheckoutCalculation = {
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly shippingCents: number;
  readonly taxCents?: number;
  readonly totalCents: number;
  readonly currency: string;
  readonly lines: ReadonlyArray<{
    readonly productId: string;
    readonly unitCents: number;
    readonly quantity: number;
  }>;
};

export type PricingError = {
  readonly _tag: string;
  readonly message: string;
};

export const PRICING_SERVICE = Symbol("PRICING_SERVICE");

export interface PricingPort {
  calculateCheckout(
    items: ReadonlyArray<CartItem>,
    voucher: VoucherForRoc | undefined,
    shippingAddress: { country: string; province: string },
    currency: string
  ): Promise<Result<CheckoutCalculation, PricingError>>;
}

export type { VoucherForRoc };
