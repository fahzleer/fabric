import type { ReactNode } from "react";
import { CheckoutWagmiProvider } from "./_components/wagmi-provider";

// Guest checkout is supported — no session required to reach checkout.
// cf-api resolves order ownership via session token when present, or via
// the email captured in AddressForm otherwise.
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <CheckoutWagmiProvider>{children}</CheckoutWagmiProvider>;
}
