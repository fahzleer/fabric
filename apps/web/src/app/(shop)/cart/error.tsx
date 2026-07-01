"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@fabric/ui";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CartError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Cart error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md space-y-6">
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load your cart</AlertTitle>
          <AlertDescription>
            Something went wrong while loading your cart. Your items are safe — please try again.
          </AlertDescription>
        </Alert>

        {process.env.NODE_ENV === "development" && (
          <Alert variant="warning" className="text-left">
            <AlertTitle className="font-mono text-sm">{error.message}</AlertTitle>
            {error.digest !== undefined && (
              <AlertDescription className="mt-2 text-xs">Error ID: {error.digest}</AlertDescription>
            )}
          </Alert>
        )}

        <div className="space-y-3">
          <Button type="button" onClick={reset} className="w-full">
            Try Again
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/products">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
