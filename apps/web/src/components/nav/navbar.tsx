import { auth } from "@/lib/auth";
import type { Session } from "@/lib/auth";
import type { Maybe } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { headers } from "next/headers";
import Link from "next/link";
import { NavLinks } from "./nav-links";
import { NavbarClientParts } from "./navbar-dynamic";
import { SearchInput } from "./search-input";

export function NavbarSkeleton() {
  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="h-7 w-16 animate-pulse rounded bg-secondary" />
        <div className="h-8 w-20 animate-pulse rounded bg-secondary" />
      </div>
    </nav>
  );
}

export async function Navbar({ session: sessionProp }: { session?: Maybe<Session> } = {}) {
  const session: Maybe<Session> =
    sessionProp !== undefined
      ? sessionProp
      : await auth.api
          .getSession({ headers: await headers() })
          .then((s) => (s ? Some(s) : None<Session>()));

  const isLoggedIn = isSome(session);
  const isAdmin = isLoggedIn && (session.value.user as { role?: string }).role === "admin";

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        {/* Brand — Kanit Black, gig-poster wordmark */}
        <Link href="/products" className="flex shrink-0 items-center gap-2">
          <span className="font-display tracking-wordmark text-xl font-black text-foreground">
            FABRIC
          </span>
        </Link>

        {/* Genre nav — Client Component with active link styling */}
        <NavLinks isAdmin={isAdmin} />

        <div className="flex flex-1 items-center justify-end gap-2">
          <SearchInput />
          {/* Cart badge and user menu — client-only, via Client Component wrapper */}
          <NavbarClientParts session={session} />
        </div>
      </div>
    </nav>
  );
}
