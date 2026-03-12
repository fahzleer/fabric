import type { ShoppingCart } from "@/domain/cart/types";
import { Atom } from "@effect-atom/atom-react";
import { Option } from "effect";

export const cartAtom = Atom.make(Option.none<ShoppingCart>());
export const cartLoadingAtom = Atom.make(false);
export const cartErrorAtom = Atom.make(Option.none<string>());
