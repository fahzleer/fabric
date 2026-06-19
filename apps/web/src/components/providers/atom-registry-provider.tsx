"use client";

import { RegistryProvider } from "@effect-atom/atom-react/RegistryContext";
import type { ReactNode } from "react";

export function AtomRegistryProvider({ children }: { children: ReactNode }) {
  return <RegistryProvider>{children}</RegistryProvider>;
}
