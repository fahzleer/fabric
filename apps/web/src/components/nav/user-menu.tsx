"use client";

import type { Session } from "@/lib/auth";
import { signOut } from "@/lib/auth-client";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { type Maybe, None, Some, getOrElse, isSome } from "@fabric/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

const isLoggingOutAtom = Atom.make(false);

interface UserMenuProps {
  initialSession: Maybe<Session>;
}

type RawUser = { email?: string; name?: string; role?: string; image?: string };

function resolveUser(maybeSession: Maybe<Session>): Maybe<RawUser> {
  if (!isSome(maybeSession)) return None();
  const user = maybeSession.value.user;
  return user ? Some(user as RawUser) : None();
}

export function UserMenu({ initialSession }: UserMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useAtom(isLoggingOutAtom);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    router.push("/auth/login");
    router.refresh();
  };

  const maybeUser = resolveUser(initialSession);

  if (!isSome(maybeUser)) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/products"
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Get started
        </Link>
      </div>
    );
  }

  const user = maybeUser.value;
  const maybeRole: Maybe<string> = user.role ? Some(user.role) : None();
  const role = getOrElse(maybeRole, "customer");
  const isAdmin = role === "admin";
  const isStoreOwner = role === "store_owner";

  return (
    <div className="flex items-center gap-3">
      {isAdmin && (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          Admin
        </span>
      )}

      {(isStoreOwner || isAdmin) && (
        <Link
          href="/merchant/dashboard"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          My Store
        </Link>
      )}

      {!(isStoreOwner || isAdmin) && (
        <Link
          href="/account/orders"
          className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          คำสั่งซื้อ
        </Link>
      )}

      <span className="hidden text-sm text-gray-500 sm:block">{user.name ?? user.email}</span>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
