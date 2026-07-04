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
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Fabric</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open your store — sell to thousands of customers
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <Suspense fallback={<div className="h-130 animate-pulse rounded-lg bg-secondary" />}>
            <StoreRegisterForm />
          </Suspense>
        </div>

        {/* Links */}
        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              Sign in
            </Link>
          </p>
          <p>
            Looking to shop instead?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              Customer sign-up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
