"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import { useAtomSet } from "@effect-atom/atom-react";
import { useLiveQuery } from "dexie-react-hooks";
import { Option } from "effect";
import { cartDb, dexieItemsToCart } from "./cart.db";

export function useDexieCartSync() {
  const setCart = useAtomSet(cartAtom);

  useLiveQuery(async () => {
    const items = await cartDb.cartItems.toArray();
    const cart = dexieItemsToCart(items);
    setCart(Option.some(cart));
  });
}
