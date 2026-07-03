"use client";

import {
  pricingPreviewAtom,
  pricingPreviewFetchAtom,
  voucherCodeAtom,
} from "@/application/atoms/checkout.atoms";
import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { formatPrice } from "@/lib/price";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { type Maybe, isNone, isSome } from "@fabric/types";
import { Button, Input } from "@fabric/ui";
import BigNumber from "bignumber.js";
import Link from "next/link";

const voucherInputAtom = Atom.make("");

interface OrderSummaryProps {
  cart: Maybe<ShoppingCart>;
  onNext: () => void;
  onBack: () => void;
}

function CartLineItems({ items }: { items: ShoppingCart["items"] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const lineAmount = new BigNumber(item.productSnapshot.price.amount).times(item.quantity);
        return (
          <div
            key={`${item.productId.value}:${item.size}`}
            className="flex justify-between items-start"
          >
            <div>
              <p className="text-sm font-medium text-foreground">
                {item.productSnapshot.name.value}
              </p>
              <p className="text-xs text-muted-foreground">
                Size: {item.size} · Qty: {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatPrice({
                amount: lineAmount.toNumber(),
                currency: item.productSnapshot.price.currency,
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

interface VoucherSectionProps {
  voucherInput: string;
  setVoucherInput: (v: string) => void;
  appliedVoucherCode: string;
  onApply: () => void;
  onRemove: () => void;
  voucherError: string;
  discountAmount: number;
  currency: string;
}

function VoucherSection({
  voucherInput,
  setVoucherInput,
  appliedVoucherCode,
  onApply,
  onRemove,
  voucherError,
  discountAmount,
  currency,
}: VoucherSectionProps) {
  return (
    <div className="border-t border-border pt-4">
      <label htmlFor="voucher-input" className="block text-sm font-medium text-foreground mb-1">
        Voucher / Promo Code
      </label>
      <div className="flex gap-2">
        <Input
          id="voucher-input"
          type="text"
          value={voucherInput}
          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
          placeholder="e.g. SAVE10"
          className="flex-1 uppercase tracking-wider"
        />
        {appliedVoucherCode ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRemove}
            className="border-destructive/40 text-destructive hover:bg-destructive-subtle hover:text-destructive/80"
          >
            Remove
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={onApply}
            disabled={!voucherInput.trim()}
          >
            Apply
          </Button>
        )}
      </div>
      {voucherError.length > 0 && <p className="mt-1.5 text-xs text-destructive">{voucherError}</p>}
      {appliedVoucherCode && voucherError.length === 0 && discountAmount > 0 && (
        <p className="mt-1.5 text-xs text-success">
          Voucher applied — saving {formatPrice({ amount: discountAmount, currency })} ✓
        </p>
      )}
    </div>
  );
}

interface PricingBreakdownProps {
  previewLoading: boolean;
  hasPreview: boolean;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  appliedVoucherCode: string;
}

function PricingBreakdown({
  previewLoading,
  hasPreview,
  subtotalAmount,
  discountAmount,
  shippingAmount,
  taxAmount,
  totalAmount,
  currency,
  appliedVoucherCode,
}: PricingBreakdownProps) {
  return (
    <div className="border-t border-border pt-4 space-y-2">
      {previewLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-secondary rounded w-full" />
          <div className="h-4 bg-secondary rounded w-3/4" />
          <div className="h-4 bg-secondary rounded w-2/3" />
          <div className="h-4 bg-secondary rounded w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatPrice({ amount: subtotalAmount, currency })}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount{appliedVoucherCode ? ` (${appliedVoucherCode})` : ""}</span>
              <span>−{formatPrice({ amount: discountAmount, currency })}</span>
            </div>
          )}

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Shipping</span>
            <span>
              {hasPreview && shippingAmount === 0 ? (
                <span className="text-success font-medium">Free</span>
              ) : (
                formatPrice({ amount: shippingAmount, currency })
              )}
            </span>
          </div>

          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>VAT (7%)</span>
              <span>{formatPrice({ amount: taxAmount, currency })}</span>
            </div>
          )}

          {!hasPreview && (
            <p className="text-xs text-faint italic">
              Shipping &amp; tax calculated at order placement
            </p>
          )}
        </>
      )}

      <div className="flex justify-between font-semibold text-foreground border-t border-border pt-3 mt-1">
        <span>Total</span>
        <span>{formatPrice({ amount: totalAmount, currency })}</span>
      </div>
    </div>
  );
}

export function OrderSummary({ cart, onNext, onBack }: OrderSummaryProps) {
  const appliedVoucherCode = useAtomValue(voucherCodeAtom);
  const setVoucherCode = useAtomSet(voucherCodeAtom);
  const previewFetch = useAtomValue(pricingPreviewFetchAtom);
  const preview = useAtomValue(pricingPreviewAtom);
  const [voucherInput, setVoucherInput] = useAtom(voucherInputAtom);

  const currency = isSome(cart)
    ? (cart.value.items[0]?.productSnapshot.price.currency ?? "THB")
    : "THB";

  const handleApplyVoucher = () => {
    setVoucherCode(voucherInput.trim());
  };
  const handleRemoveVoucher = () => {
    setVoucherInput("");
    setVoucherCode("");
  };

  if (isNone(cart) || cart.value.items.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/cart" className="mt-4 inline-block text-info hover:text-info/80">
          Go to Cart
        </Link>
      </div>
    );
  }

  const hasPreview = isSome(preview);

  const subtotalAmount = hasPreview ? preview.value.subtotalCents / 100 : getCartTotal(cart.value);
  const discountAmount = hasPreview ? preview.value.discountCents / 100 : 0;
  const shippingAmount = hasPreview ? preview.value.shippingCents / 100 : 0;
  const taxAmount = hasPreview ? preview.value.taxCents / 100 : 0;
  const totalAmount = hasPreview ? preview.value.totalCents / 100 : getCartTotal(cart.value);
  const voucherError = hasPreview ? (preview.value.voucherError ?? "") : "";

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>

      <CartLineItems items={cart.value.items} />

      <VoucherSection
        voucherInput={voucherInput}
        setVoucherInput={setVoucherInput}
        appliedVoucherCode={appliedVoucherCode}
        onApply={handleApplyVoucher}
        onRemove={handleRemoveVoucher}
        voucherError={voucherError}
        discountAmount={discountAmount}
        currency={currency}
      />

      <PricingBreakdown
        previewLoading={previewFetch.waiting}
        hasPreview={hasPreview}
        subtotalAmount={subtotalAmount}
        discountAmount={discountAmount}
        shippingAmount={shippingAmount}
        taxAmount={taxAmount}
        totalAmount={totalAmount}
        currency={currency}
        appliedVoucherCode={appliedVoucherCode}
      />

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="flex-1">
          ← Back
        </Button>
        <Button type="button" size="lg" onClick={onNext} className="flex-1">
          Continue to Payment
        </Button>
      </div>

      <Link
        href="/cart"
        className="block text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Edit Cart
      </Link>
    </div>
  );
}
