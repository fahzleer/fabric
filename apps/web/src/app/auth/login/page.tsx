import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm, type SocialProvider } from "./_components";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In — Fabric",
  description: "Sign in to your Fabric account to browse and purchase products.",
};

export default function LoginPage() {
  const enabledProviders = [
    process.env.GOOGLE_CLIENT_ID && "google",
    process.env.FACEBOOK_CLIENT_ID && "facebook",
    process.env.LINE_CHANNEL_ID && "line",
  ].filter(Boolean) as SocialProvider[];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Fabric</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Card — Suspense required because LoginForm uses useSearchParams() */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-gray-100" />}>
            <LoginForm enabledProviders={enabledProviders} />
          </Suspense>
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-gray-900 underline underline-offset-4 hover:text-gray-700"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
