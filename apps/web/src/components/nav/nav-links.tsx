"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

interface NavLinkInnerProps {
  children: React.ReactNode;
  className: string;
  activeClassName: string;
  href: string;
}

function NavLinkInner({ children, className, activeClassName, href }: NavLinkInnerProps) {
  const { pending } = useLinkStatus();
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  const baseClasses = "text-sm font-medium transition-colors";
  const combinedClasses = [baseClasses, className, isActive || pending ? activeClassName : ""]
    .filter(Boolean)
    .join(" ");

  return <span className={combinedClasses}>{children}</span>;
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

function NavLink({
  href,
  children,
  className = "",
  activeClassName = "text-foreground font-semibold",
}: NavLinkProps) {
  return (
    <Link href={href} className="text-sm font-medium transition-colors">
      <NavLinkInner className={className} activeClassName={activeClassName} href={href}>
        {children}
      </NavLinkInner>
    </Link>
  );
}

// Genre nav — direct links into the catalog filter, reusing the same genre
// keys as GENRE_LABELS/getGenreOptions in products/_lib/product-helpers.ts.
// Kept as a small local list (rather than importing from _lib) since this is
// the site-wide header, outside the (shop)/products route's own module tree.
const GENRE_NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/products?genre=punk", label: "Punk" },
  { href: "/products?genre=metal", label: "Metal" },
  { href: "/products?genre=emo", label: "Emo" },
  { href: "/products?genre=hardcore", label: "Hardcore" },
  { href: "/products?genre=deathcore", label: "Deathcore" },
];

interface NavLinksProps {
  isAdmin: boolean;
}

export function NavLinks({ isAdmin }: NavLinksProps) {
  return (
    <div className="hidden items-center gap-6 md:flex">
      {GENRE_NAV.map((genre) => (
        <NavLink
          key={genre.href}
          href={genre.href}
          className="text-muted-foreground hover:text-foreground"
          activeClassName="text-brand font-semibold"
        >
          {genre.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          href="/admin"
          className="text-warning hover:text-warning/80"
          activeClassName="text-warning font-bold"
        >
          Admin Panel
        </NavLink>
      )}
      {isAdmin && (
        <NavLink
          href="/analytics"
          className="text-info hover:text-info/80"
          activeClassName="text-info font-bold"
        >
          Analytics
        </NavLink>
      )}
    </div>
  );
}
