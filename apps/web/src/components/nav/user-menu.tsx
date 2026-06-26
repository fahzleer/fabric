"use client";

import type { Session } from "@/lib/auth";
import { signOut } from "@/lib/auth-client";
import { Atom, useAtom } from "@effect-atom/atom-react";
import { type Maybe, None, Some, getOrElse, isSome } from "@fabric/types";
import { Button } from "@fabric/ui";
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
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
        <Button asChild size="sm">
          <Link href="/products">Get started</Link>
        </Button>
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
        <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
          Admin
        </span>
      )}

      {(isStoreOwner || isAdmin) && (
        <Link
          href="/merchant/dashboard"
          className="text-sm font-medium text-success hover:text-success/80 transition-colors"
        >
          My Store
        </Link>
      )}

      {!(isStoreOwner || isAdmin) && (
        <Link
          href="/account/orders"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          คำสั่งซื้อ
        </Link>
      )}

      <span className="hidden text-sm text-muted-foreground sm:block">
        {user.name ?? user.email}
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
