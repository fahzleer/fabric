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
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Fabric</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        {/* Login Card — Suspense required because LoginForm uses useSearchParams() */}
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-secondary" />}>
            <LoginForm enabledProviders={enabledProviders} />
          </Suspense>
        </div>

        {/* Register link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
