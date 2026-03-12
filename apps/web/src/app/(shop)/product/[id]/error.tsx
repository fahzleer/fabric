"use client";

import Link from "next/link";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Product page error:", error);
  }, [error]);

  const isNetworkError = error.message.includes("fetch") || error.message.includes("network");
  const isNotFound = error.message.includes("not found") || error.message.includes("404");

  let errorTitle = "Something went wrong!";
  let errorMessage = "We encountered an error while loading this product.";

  if (isNetworkError) {
    errorTitle = "Connection Error";
    errorMessage = "Unable to load product. Please check your internet connection.";
  } else if (isNotFound) {
    errorTitle = "Product Not Found";
    errorMessage = "This product does not exist or has been removed.";
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{errorTitle}</h1>
        <p className="mt-2 text-gray-600">{errorMessage}</p>

        {/* Error details (development only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mt-4 p-4 bg-gray-100 rounded text-left">
            <p className="text-sm text-gray-700 font-mono">{error.message}</p>
            {error.digest !== undefined && (
              <p className="mt-2 text-xs text-gray-500">Error ID: {error.digest}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>

          <Link
            href="/products"
            className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back to Products
          </Link>

          <Link href="/" className="block w-full text-sm text-blue-600 hover:text-blue-800">
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
