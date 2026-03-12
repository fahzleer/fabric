import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "You're offline — Fabric",
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-3xl">
        📡
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">You&apos;re offline</h1>
        <p className="text-sm text-gray-500">Check your internet connection and try again.</p>
      </div>

      <Link
        href="/"
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
      >
        Try again
      </Link>
    </div>
  );
}
