"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { base, baseSepolia } from "viem/chains";
import { http, WagmiProvider, createConfig } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),
    ...(WALLETCONNECT_PROJECT_ID ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })] : []),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
});

export function CheckoutWagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
