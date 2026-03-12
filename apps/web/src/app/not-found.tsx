"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    console.error("[404] Page not found:", window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Icon */}
        <div className="mx-auto mb-8 w-24 h-24 bg-gray-900 rounded-full flex items-center justify-center">
          <span className="text-4xl font-bold text-white">404</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Page Not Found</h1>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or
          doesn&apos;t exist.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/products"
            className="block w-full rounded-lg bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            Browse Products
          </Link>

          <Link
            href="/"
            className="block w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
          >
            Go Home
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-gray-500">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
}
