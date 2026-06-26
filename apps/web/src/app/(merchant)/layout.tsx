import { MerchantSidebar } from "@/components/merchant/merchant-sidebar";
import { Navbar, NavbarSkeleton } from "@/components/nav/navbar";
import { auth } from "@/lib/auth";
import { Some } from "@fabric/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";

export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) {
    redirect("/auth/login?callbackUrl=/merchant/dashboard");
  }
  if (role !== "store_owner" && role !== "admin") {
    redirect("/");
  }

  return (
    // `dark` activates the token system's dark palette for the dashboard shell;
    // the shared Navbar uses hardcoded light classes so it stays light on top.
    <div className="dark min-h-screen bg-background text-foreground">
      <Suspense fallback={<NavbarSkeleton />}>
        <Navbar session={Some(session)} />
      </Suspense>
      <div className="flex min-h-[calc(100vh-65px)]">
        <MerchantSidebar />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
