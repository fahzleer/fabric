import { MotionProvider } from "@/components/motion/motion-provider";
import { Navbar, NavbarSkeleton } from "@/components/nav/navbar";
import { type ReactNode, Suspense } from "react";

interface ShopLayoutProps {
  children: ReactNode;
}

export default function ShopLayout({ children }: ShopLayoutProps) {
  return (
    <MotionProvider>
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar />
      </Suspense>
      <main>{children}</main>
    </MotionProvider>
  );
}
