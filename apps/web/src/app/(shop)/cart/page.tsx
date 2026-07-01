"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import { getCartItemCount, isCartEmpty } from "@/domain/cart/types";
import { useDexieCartSync } from "@/infrastructure/dexie/use-dexie-cart-sync";
import { useAtomValue } from "@effect-atom/atom-react";
import { Button, EmptyState } from "@fabric/ui";
import { Option } from "effect";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { CartItemRow } from "./_components/cart-item-row";
import { CartSummary } from "./_components/cart-summary";

export default function CartPage() {
  useDexieCartSync();
  const cartOption = useAtomValue(cartAtom);

  if (Option.isNone(cartOption)) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-pulse text-faint">Loading cart...</div>
      </div>
    );
  }

  const cart = cartOption.value;

  if (isCartEmpty(cart)) {
    return (
      <div className="min-h-screen bg-muted">
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            icon={<ShoppingCart />}
            title="Your cart is empty"
            description="Add some products to get started."
          >
            <Button asChild>
              <Link href="/products">Browse Products</Link>
            </Button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground mb-8">
          Shopping Cart ({getCartItemCount(cart)} items)
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {cart.items.map((item) => (
              <CartItemRow key={`${item.productId.value}:${item.size}`} item={item} />
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <CartSummary cart={cart} />
          </div>
        </div>
      </div>
    </div>
  );
}
