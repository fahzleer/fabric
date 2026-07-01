"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@fabric/ui";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CheckoutError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Checkout error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md space-y-6">
        <Alert variant="destructive">
          <AlertTitle>Checkout couldn&apos;t be completed</AlertTitle>
          <AlertDescription>
            Something went wrong while processing your checkout. Your cart is safe — please try
            again.
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
            <Link href="/cart">Back to Cart</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
