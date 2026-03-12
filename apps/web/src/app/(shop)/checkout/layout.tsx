import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CheckoutWagmiProvider } from "./_components/wagmi-provider";

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session === null || session === undefined) {
    redirect("/auth/login?callbackUrl=/checkout");
  }

  return <CheckoutWagmiProvider>{children}</CheckoutWagmiProvider>;
}
