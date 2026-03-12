"use client";

import Link from "next/link";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            {/* Error Icon */}
            <div className="mx-auto mb-8 w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-600"
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

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Something Went Wrong</h1>

            {/* Description */}
            <p className="text-gray-600 mb-2">
              We&apos;re sorry, but something went wrong on our end.
            </p>

            {/* Error digest (production only) */}
            {error.digest && (
              <p className="text-sm text-gray-500 mb-8">
                Error ID: <code className="bg-gray-100 px-2 py-1 rounded">{error.digest}</code>
              </p>
            )}

            {/* Development error details */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
                <p className="text-sm font-mono text-red-800 break-all">{error.message}</p>
                {error.stack && (
                  <pre className="mt-2 text-xs text-red-700 overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={reset}
                className="block w-full rounded-lg bg-gray-900 px-6 py-3 text-white font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
              >
                Try Again
              </button>

              <Link
                href="/"
                className="block w-full rounded-lg border border-gray-300 px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
              >
                Go Home
              </Link>
            </div>

            {/* Support */}
            <p className="mt-8 text-sm text-gray-500">
              If this problem persists, please contact{" "}
              <a href="mailto:support@fabric.com" className="text-blue-600 hover:underline">
                support
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
