import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StoreRegisterForm } from "./_components/store-register-form";

export const metadata: Metadata = {
  title: "Open a Store — Fabric",
  description: "Create your Fabric store account and start selling.",
};

export default function StoreRegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Fabric</h1>
          <p className="mt-2 text-sm text-gray-600">
            Open your store — sell to thousands of customers
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="h-130 animate-pulse rounded-lg bg-gray-100" />}>
            <StoreRegisterForm />
          </Suspense>
        </div>

        {/* Links */}
        <div className="mt-6 space-y-2 text-center text-sm text-gray-600">
          <p>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-gray-900 underline underline-offset-4 hover:text-gray-700"
            >
              Sign in
            </Link>
          </p>
          <p>
            Looking to shop instead?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-gray-900 underline underline-offset-4 hover:text-gray-700"
            >
              Customer sign-up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
