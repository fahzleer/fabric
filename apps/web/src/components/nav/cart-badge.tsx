"use client";

import { cartAtom } from "@/application/atoms/cart.atoms";
import { getCartItemCount } from "@/domain/cart/types";
import { useDexieCartSync } from "@/infrastructure/dexie/use-dexie-cart-sync";
import { useAtomValue } from "@effect-atom/atom-react";
import BigNumber from "bignumber.js";
import { Option } from "effect";
import Link from "next/link";

export function CartBadge() {
  useDexieCartSync();
  const cartOption = useAtomValue(cartAtom);

  const count = Option.isSome(cartOption)
    ? new BigNumber(getCartItemCount(cartOption.value)).toNumber()
    : 0;

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center p-2 text-gray-400 hover:text-white transition-colors"
    >
      {/* Cart icon */}
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {count > 99 ? "99+" : String(count)}
        </span>
      )}
    </Link>
  );
}
