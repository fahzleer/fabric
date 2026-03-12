"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import type { ProductId, ProductPrice, ProductSize } from "@/domain/product/types";
import { dexieCartAdapter } from "@/infrastructure/dexie/dexie-cart.adapter";
import { type Maybe, None, Some, isNone, isSome } from "@/lib/maybe";
import { Atom, useAtom, useAtomSet } from "@effect-atom/atom-react";
import { Effect, Option } from "effect";

const selectedSizeAtom = Atom.make<Maybe<ProductSize>>(None());
const quantityAtom = Atom.make(1);
const cartStatusAtom = Atom.make<"idle" | "adding" | "added" | "error">("idle");

interface AddToCartButtonProps {
  productId: ProductId;
  availableSizes: ProductSize[];
  price: ProductPrice;
  productName: string;
  productImageUrl: string;
}

export function AddToCartButton({
  productId,
  availableSizes,
  price,
  productName,
  productImageUrl,
}: AddToCartButtonProps) {
  const setCart = useAtomSet(cartAtom);
  const [selectedSize, setSelectedSize] = useAtom(selectedSizeAtom);
  const [quantity, setQuantity] = useAtom(quantityAtom);
  const [status, setStatus] = useAtom(cartStatusAtom);

  const handleAddToCart = () => {
    if (isNone(selectedSize)) {
      setStatus("error");
      return;
    }
    setStatus("adding");

    Effect.runPromise(
      dexieCartAdapter.addItem(productId, selectedSize.value, quantity, {
        amount: price.amount,
        currency: price.currency,
        productName,
        productImageUrl,
      })
    )
      .then((cart) => {
        setCart(Option.some(cart));
        setStatus("added");
        setTimeout(() => setStatus("idle"), 2000);
      })
      .catch(() => setStatus("error"));
  };

  return (
    <div className="space-y-4">
      {/* Size selector */}
      <div>
        <h3 className="text-sm font-medium text-gray-900">Size</h3>
        <div className="mt-2 flex gap-2 flex-wrap">
          {availableSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setSelectedSize(Some(size))}
              className={`border rounded px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSome(selectedSize) && selectedSize.value === size
                  ? "border-blue-600 bg-blue-50 text-blue-600"
                  : "border-gray-300 text-gray-900 hover:border-gray-400"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        {status === "error" && isNone(selectedSize) && (
          <p className="mt-1 text-xs text-red-500">Please select a size first.</p>
        )}
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">Quantity</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-8 w-8 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="h-8 w-8 rounded border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>

      {/* Add to cart button */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={status === "adding"}
        className={`w-full rounded-lg px-6 py-3 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
          status === "added"
            ? "bg-green-600 hover:bg-green-700"
            : status === "adding"
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {status === "adding" ? "Adding..." : status === "added" ? "✓ Added to Cart" : "Add to Cart"}
      </button>
    </div>
  );
}
