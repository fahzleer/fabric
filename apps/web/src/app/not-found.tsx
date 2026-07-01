"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    console.error("[404] Page not found:", window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mx-auto mb-8 w-24 h-24 bg-primary rounded-full flex items-center justify-center">
          <span className="text-4xl font-bold text-primary-foreground">404</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-4">Page Not Found</h1>

        {/* Description */}
        <p className="text-muted-foreground mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or
          doesn&apos;t exist.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/products"
            className="block w-full rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
          >
            Browse Products
          </Link>

          <Link
            href="/"
            className="block w-full rounded-lg border border-border-strong px-6 py-3 text-muted-foreground font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
          >
            Go Home
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-muted-foreground">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
