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
  activeClassName = "text-gray-900 font-semibold",
}: NavLinkProps) {
  return (
    <Link href={href} className="text-sm font-medium transition-colors">
      <NavLinkInner className={className} activeClassName={activeClassName} href={href}>
        {children}
      </NavLinkInner>
    </Link>
  );
}

interface NavLinksProps {
  isLoggedIn: boolean;
  isAdmin: boolean;
}

export function NavLinks({ isLoggedIn, isAdmin }: NavLinksProps) {
  return (
    <div className="flex items-center gap-6">
      {isLoggedIn && (
        <NavLink
          href="/products"
          className="text-gray-500 hover:text-gray-900"
          activeClassName="text-gray-900 font-semibold"
        >
          Products
        </NavLink>
      )}
      {isAdmin && (
        <NavLink
          href="/admin"
          className="text-amber-600 hover:text-amber-700"
          activeClassName="text-amber-700 font-bold"
        >
          Admin Panel
        </NavLink>
      )}
      {isAdmin && (
        <NavLink
          href="/analytics"
          className="text-purple-600 hover:text-purple-700"
          activeClassName="text-purple-700 font-bold"
        >
          Analytics
        </NavLink>
      )}
    </div>
  );
}
