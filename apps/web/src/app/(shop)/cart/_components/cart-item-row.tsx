"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import type { CartItem } from "@/domain/cart/types";
import { dexieCartAdapter } from "@/infrastructure/dexie/dexie-cart.adapter";
import { formatPrice } from "@/lib/price";
import { useAtomSet } from "@effect-atom/atom-react";
import { Button } from "@fabric/ui";
import BigNumber from "bignumber.js";
import { Effect } from "effect";
import { Option } from "effect";
import Image from "next/image";

interface CartItemRowProps {
  item: CartItem;
}

export function CartItemRow({ item }: CartItemRowProps) {
  const setCart = useAtomSet(cartAtom);

  const lineTotal = new BigNumber(item.productSnapshot.price.amount).times(item.quantity);

  const formattedLineTotal = formatPrice({
    amount: lineTotal.toNumber(),
    currency: item.productSnapshot.price.currency,
  });

  const handleRemove = () => {
    Effect.runPromise(dexieCartAdapter.removeItem(item.productId, item.size))
      .then((cart) => setCart(Option.some(cart)))
      .catch(console.error);
  };

  const handleQuantityChange = (delta: number) => {
    const newQty = Math.max(1, item.quantity + delta);
    Effect.runPromise(dexieCartAdapter.updateQuantity(item.productId, item.size, newQty))
      .then((cart) => setCart(Option.some(cart)))
      .catch(console.error);
  };

  return (
    <div className="flex gap-4 bg-card rounded-lg border border-border p-4">
      {/* Image */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
        <Image
          src={item.productSnapshot.image.url}
          alt={item.productSnapshot.name.value}
          fill
          className="object-cover"
          sizes="96px"
        />
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {item.productSnapshot.name.value}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Size: {item.size}</p>
          </div>
          <p className="text-sm font-medium text-foreground">{formattedLineTotal}</p>
        </div>

        <div className="mt-auto flex items-center justify-between">
          {/* Quantity stepper */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(-1)}
              className="h-7 w-7"
              disabled={item.quantity <= 1}
            >
              −
            </Button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => handleQuantityChange(1)}
              className="h-7 w-7"
            >
              +
            </Button>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            className="rounded-sm text-xs text-destructive hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
