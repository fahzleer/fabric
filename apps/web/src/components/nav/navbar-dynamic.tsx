"use client";

import type { Session } from "@/lib/auth";
import { type Maybe, isSome } from "@fabric/types";
import dynamic from "next/dynamic";

const CartBadgeDynamic = dynamic(() => import("./cart-badge").then((m) => m.CartBadge), {
  ssr: false,
  loading: () => (
    <div className="relative inline-flex items-center p-2">
      <div className="h-6 w-6" />
    </div>
  ),
});

const UserMenuDynamic = dynamic(() => import("./user-menu").then((m) => m.UserMenu), {
  ssr: false,
  loading: () => <div className="h-8 w-24" aria-hidden />,
});

export function NavbarClientParts({ session }: { session: Maybe<Session> }) {
  const role = isSome(session) ? (session.value.user as { role?: string }).role : undefined;
  const isMerchant = role === "store_owner" || role === "admin";

  return (
    <div className="flex items-center gap-1">
      {!isMerchant && <CartBadgeDynamic />}
      <UserMenuDynamic initialSession={session} />
    </div>
  );
}
