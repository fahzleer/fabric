"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import type { ShoppingCart } from "@/domain/cart/types";
import { useDexieCartSync } from "@/infrastructure/dexie/use-dexie-cart-sync";
import { type Maybe, None, Some } from "@/lib/maybe";
import { useAtomValue } from "@effect-atom/atom-react";
import { Option } from "effect";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { AddressForm } from "./_components/address-form";
import { OmiseCardForm } from "./_components/omise-card-form";
import { OrderSummary } from "./_components/order-summary";
import { PromptPayForm } from "./_components/promptpay-form";
import { X402PaymentForm } from "./_components/x402-payment-form";

const STEPS = ["address", "summary", "payment"] as const;
const PAYMENT_METHODS = ["card", "promptpay", "crypto"] as const;

export default function CheckoutPage() {
  useDexieCartSync();

  const [step, setStep] = useQueryState("step", parseAsStringLiteral(STEPS).withDefault("address"));
  const [paymentMethod, setPaymentMethod] = useQueryState(
    "paymentMethod",
    parseAsStringLiteral(PAYMENT_METHODS).withDefault("card")
  );
  const cartOption = useAtomValue(cartAtom);

  const cart: Maybe<ShoppingCart> = Option.isSome(cartOption) ? Some(cartOption.value) : None();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : STEPS.indexOf(step) > i
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-sm font-medium text-gray-600 capitalize">{s}</span>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-gray-300" />}
            </div>
          ))}
        </div>

        {step === "address" && <AddressForm onNext={() => setStep("summary")} />}
        {step === "summary" && (
          <OrderSummary
            cart={cart}
            onNext={() => setStep("payment")}
            onBack={() => setStep("address")}
          />
        )}
        {step === "payment" && (
          <div className="space-y-4">
            {/* Payment method tabs */}
            <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1">
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  paymentMethod === "card"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Credit Card
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("promptpay")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  paymentMethod === "promptpay"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                PromptPay
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("crypto")}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  paymentMethod === "crypto"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                USDC
              </button>
            </div>

            {paymentMethod === "card" && (
              <OmiseCardForm cart={cart} onBack={() => setStep("summary")} />
            )}
            {paymentMethod === "promptpay" && (
              <PromptPayForm cart={cart} onBack={() => setStep("summary")} />
            )}
            {paymentMethod === "crypto" && (
              <X402PaymentForm cart={cart} onBack={() => setStep("summary")} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
