"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import type { ProductId, ProductPrice, ProductSize } from "@/domain/product/types";
import { dexieCartAdapter } from "@/infrastructure/dexie/dexie-cart.adapter";
import { trackEvent } from "@/lib/analytics";
import { EASE } from "@/lib/motion";
import { Atom, useAtom, useAtomSet } from "@effect-atom/atom-react";
import { type Maybe, None, Some, isNone, isSome } from "@fabric/types";
import { Button } from "@fabric/ui";
import { Effect, Option } from "effect";
import { AnimatePresence, motion } from "motion/react";

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
        trackEvent("cart_item_added", {
          productId: productId.value,
          productName,
          price: price.amount,
          currency: price.currency,
        });
      })
      .catch(() => setStatus("error"));
  };

  return (
    <div className="space-y-4">
      {/* Size selector — segmented toggle, kept as custom buttons (tokenized) */}
      <div>
        <h3 className="text-sm font-medium text-foreground">Size</h3>
        <div className="mt-2 flex gap-2 flex-wrap">
          {availableSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setSelectedSize(Some(size))}
              className={`border rounded px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSome(selectedSize) && selectedSize.value === size
                  ? "border-foreground bg-secondary text-foreground"
                  : "border-input text-foreground hover:border-border-strong"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        {status === "error" && isNone(selectedSize) && (
          <p className="mt-1 text-xs text-destructive">Please select a size first.</p>
        )}
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Quantity</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-8 w-8"
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-medium">{quantity}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setQuantity((q) => q + 1)}
            className="h-8 w-8"
          >
            +
          </Button>
        </div>
      </div>

      {/* Add to cart button — aria-disabled avoids accessibility-tree recalc (INP) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {status === "added" ? "Added to cart" : ""}
      </div>
      <Button
        type="button"
        size="lg"
        onClick={handleAddToCart}
        aria-disabled={status === "adding"}
        aria-label={
          status === "adding"
            ? "Adding to cart"
            : status === "added"
              ? "Added to cart"
              : "Add to cart"
        }
        className={`w-full [min-block-size:3rem] ${
          status === "added"
            ? "bg-success text-success-foreground hover:bg-success/90"
            : status === "adding"
              ? "pointer-events-none opacity-70"
              : ""
        }`}
      >
        {/* Label swaps with a quick pop for reassuring add-to-cart feedback.
            mode="wait" + short duration keeps the conversion path snappy. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            className="inline-block w-full text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE.settle }}
          >
            {status === "adding"
              ? "Adding..."
              : status === "added"
                ? "✓ Added to Cart"
                : "Add to Cart"}
          </motion.span>
        </AnimatePresence>
      </Button>
    </div>
  );
}
