"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProductModalNotFound() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.back();
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg p-8 text-center max-w-md">
        <div className="mx-auto mb-4 w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-faint"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Product Not Found</h2>
        <p className="text-muted-foreground">This product does not exist or has been removed.</p>
        <p className="text-sm text-muted-foreground mt-4">Going back...</p>
      </div>
    </div>
  );
}
