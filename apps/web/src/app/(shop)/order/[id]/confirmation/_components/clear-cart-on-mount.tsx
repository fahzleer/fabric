"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import { cartDb } from "@/infrastructure/dexie/cart.db";
import { Atom, useAtomValue } from "@effect-atom/atom-react";
import { Effect, Option } from "effect";

const clearCartAtom = Atom.make((get) =>
  Effect.gen(function* () {
    yield* Effect.promise(() => cartDb.cartItems.clear());
    get.set(cartAtom, Option.some({ id: "local", items: [], updatedAt: new Date().toISOString() }));
  })
);

export function ClearCartOnMount() {
  useAtomValue(clearCartAtom);
  return null;
}
