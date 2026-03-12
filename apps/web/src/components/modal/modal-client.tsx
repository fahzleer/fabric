"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Modal = dynamic(() => import("./modal").then((mod) => mod.Modal), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="h-32 w-full max-w-2xl animate-pulse rounded-lg bg-white/80" />
    </div>
  ),
});

interface ModalClientProps {
  children: ReactNode;
}

export function ModalClient({ children }: ModalClientProps) {
  return <Modal>{children}</Modal>;
}
