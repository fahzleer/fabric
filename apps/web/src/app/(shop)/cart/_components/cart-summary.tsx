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
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Order Summary</h2>

      <div className="space-y-2">
        {cart.items.map((item) => {
          const lineAmount = new BigNumber(item.productSnapshot.price.amount).times(item.quantity);
          return (
            <div
              key={`${item.productId.value}:${item.size}`}
              className="flex justify-between text-sm text-gray-600"
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

      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>{formattedTotal}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="block w-full text-center rounded-lg bg-info px-4 py-3 text-white font-medium hover:bg-info/90 focus:outline-none focus:ring-2 focus:ring-info"
      >
        Proceed to Checkout
      </Link>

      <Link
        href="/products"
        className="block w-full text-center text-sm text-gray-600 hover:text-gray-800"
      >
        Continue Shopping
      </Link>
    </div>
  );
}
