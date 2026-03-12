import { Navbar, NavbarSkeleton } from "@/components/nav/navbar";
import { type ReactNode, Suspense } from "react";

interface ShopLayoutProps {
  children: ReactNode;
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  return (
    <>
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar />
      </Suspense>
      <main>{children}</main>
    </>
  );
}
