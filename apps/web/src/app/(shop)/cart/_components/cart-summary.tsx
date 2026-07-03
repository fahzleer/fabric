import { getCartTotal } from "@/domain/cart/types";
import type { ShoppingCart } from "@/domain/cart/types";
import { formatPrice } from "@/lib/price";
import BigNumber from "bignumber.js";
import Link from "next/link";

interface CartSummaryProps {
  cart: ShoppingCart;
}

export function CartSummary({ cart }: CartSummaryProps) {
  const currency = cart.items[0]?.productSnapshot.price.currency ?? "THB";
  const formattedTotal = formatPrice({ amount: getCartTotal(cart), currency });

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>

      <div className="space-y-2">
        {cart.items.map((item) => {
          const lineAmount = new BigNumber(item.productSnapshot.price.amount).times(item.quantity);
          return (
            <div
              key={`${item.productId.value}:${item.size}`}
              className="flex justify-between text-sm text-muted-foreground"
            >
              <span>
                {item.productSnapshot.name.value} × {item.quantity}
              </span>
              <span>
                {formatPrice({
                  amount: lineAmount.toNumber(),
                  currency: item.productSnapshot.price.currency,
                })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex justify-between font-semibold text-foreground">
          <span>Total</span>
          <span>{formattedTotal}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="block w-full text-center rounded-lg bg-info px-4 py-3 text-white font-medium hover:bg-info/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Proceed to Checkout
      </Link>

      <Link
        href="/products"
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
