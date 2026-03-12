"use client";

import {
  pricingPreviewAtom,
  pricingPreviewFetchAtom,
  voucherCodeAtom,
} from "@/application/atoms/checkout.atoms";
import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { type Maybe, isNone, isSome } from "@/lib/maybe";
import { formatPrice } from "@/lib/price";
import { Atom, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react";
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
              <p className="text-sm font-medium text-gray-900">{item.productSnapshot.name.value}</p>
              <p className="text-xs text-gray-500">
                Size: {item.size} · Qty: {item.quantity}
              </p>
            </div>
            <p className="text-sm font-medium text-gray-900">
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
    <div className="border-t border-gray-100 pt-4">
      <label htmlFor="voucher-input" className="block text-sm font-medium text-gray-700 mb-1">
        Voucher / Promo Code
      </label>
      <div className="flex gap-2">
        <input
          id="voucher-input"
          type="text"
          value={voucherInput}
          onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
          placeholder="e.g. SAVE10"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {appliedVoucherCode ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={onApply}
            disabled={!voucherInput.trim()}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Apply
          </button>
        )}
      </div>
      {voucherError.length > 0 && <p className="mt-1.5 text-xs text-red-600">{voucherError}</p>}
      {appliedVoucherCode && voucherError.length === 0 && discountAmount > 0 && (
        <p className="mt-1.5 text-xs text-green-600">
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
    <div className="border-t border-gray-200 pt-4 space-y-2">
      {previewLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-100 rounded w-full" />
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      ) : (
        <>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatPrice({ amount: subtotalAmount, currency })}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount{appliedVoucherCode ? ` (${appliedVoucherCode})` : ""}</span>
              <span>−{formatPrice({ amount: discountAmount, currency })}</span>
            </div>
          )}

          <div className="flex justify-between text-sm text-gray-600">
            <span>Shipping</span>
            <span>
              {hasPreview && shippingAmount === 0 ? (
                <span className="text-green-600 font-medium">Free</span>
              ) : (
                formatPrice({ amount: shippingAmount, currency })
              )}
            </span>
          </div>

          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT (7%)</span>
              <span>{formatPrice({ amount: taxAmount, currency })}</span>
            </div>
          )}

          {!hasPreview && (
            <p className="text-xs text-gray-400 italic">
              Shipping &amp; tax calculated at order placement
            </p>
          )}
        </>
      )}

      <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-3 mt-1">
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
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
        <p className="text-gray-600">Your cart is empty.</p>
        <Link href="/cart" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
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
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>

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
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700"
        >
          Continue to Payment
        </button>
      </div>

      <Link href="/cart" className="block text-center text-xs text-gray-500 hover:text-gray-700">
        Edit Cart
      </Link>
    </div>
  );
}
