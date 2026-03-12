import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RegisterForm } from "./_components";

export const metadata: Metadata = {
  title: "Create Account — Fabric",
  description: "Create your Fabric account to start shopping.",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Fabric</h1>
          <p className="mt-2 text-sm text-gray-600">Create your account</p>
        </div>

        {/* Register Card — Suspense required because RegisterForm uses useSearchParams() */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-gray-100" />}>
            <RegisterForm />
          </Suspense>
        </div>

        {/* Login + store links */}
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
            Want to sell on Fabric?{" "}
            <Link
              href="/auth/register/store"
              className="font-medium text-gray-900 underline underline-offset-4 hover:text-gray-700"
            >
              Open a store
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
