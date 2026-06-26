"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Forbidden() {
  useEffect(() => {
    console.error("[403] Forbidden access:", window.location.pathname);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 403 Icon */}
        <div className="mx-auto mb-8 w-24 h-24 bg-warning-subtle rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-warning"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access Denied</h1>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          You don&apos;t have permission to access this resource. If you believe this is an error,
          please contact support.
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
        <p className="mt-8 text-sm text-gray-500">Error code: 403 Forbidden</p>
      </div>
    </div>
  );
}
