import { createMerchantApi } from "@/lib/merchant-api";
import { isOk, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SubmitButton } from "./_components/submit-button";
import { onboardMerchantAction } from "./_lib/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fabric.cool";

export const metadata: Metadata = {
  title: "Store Setup — Merchant Portal",
};

function Step({
  number,
  title,
  description,
  done,
  cta,
  ctaHref,
  optional = false,
}: {
  number: number;
  title: string;
  description: string;
  done: boolean;
  cta?: string;
  ctaHref?: string;
  optional?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-5 transition-colors ${
        done ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-gray-800/50"
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-emerald-500 text-white" : "bg-gray-700 text-gray-400"
        }`}
      >
        {done ? (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-semibold ${done ? "text-emerald-300" : "text-white"}`}>
            {title}
          </h3>
          {optional && (
            <span className="rounded-full bg-gray-700/60 px-2 py-0.5 text-xs text-gray-400">
              optional
            </span>
          )}
          {done && <span className="text-xs font-medium text-emerald-400">Done</span>}
        </div>
        <p className="mt-1 text-xs text-gray-400">{description}</p>
        {!done && cta && ctaHref && (
          <Link
            href={ctaHref}
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            {cta} →
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function MerchantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  await connection();

  const { error, success } = await searchParams;

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Unable to load onboarding. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const billingResult = await api.getBillingStatus();

  const isOnboarded =
    isOk(billingResult) &&
    isSome(billingResult.value.onboarded) &&
    billingResult.value.onboarded.value;

  if (!isOnboarded) {
    return (
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Create your store</h1>
          <p className="mt-1 text-sm text-gray-400">
            Set up your merchant profile to start selling on Fabric.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form action={onboardMerchantAction} className="space-y-5">
          <div>
            <label htmlFor="storeName" className="block text-sm font-medium text-gray-300">
              Store name
            </label>
            <input
              id="storeName"
              name="storeName"
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. Bangkok Threads"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30"
            />
            <p className="mt-1 text-xs text-gray-500">
              This will be displayed to customers and used in your store URL.
            </p>
          </div>

          <SubmitButton />
        </form>
      </div>
    );
  }

  const billing = billingResult.value;
  const hasProduct = (billing.productCount ?? 0) > 0;
  const hasUpgraded = billing.plan !== "free" && billing.plan !== undefined;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Store setup</h1>
        <p className="mt-1 text-sm text-gray-400">
          Complete these steps to get your store ready for customers.
        </p>
      </div>

      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-medium text-emerald-300">
            Store created! Complete the steps below to start selling.
          </p>
        </div>
      )}

      {/* All-done banner */}
      {hasProduct && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-base font-semibold text-emerald-300">Your store is ready to sell!</p>
          <p className="mt-1 text-sm text-gray-400">
            All required steps are complete. Head to your dashboard to manage your store.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/merchant/dashboard"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Go to dashboard
            </Link>
            <Link
              href="/merchant/products"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5"
            >
              Manage products
            </Link>
          </div>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-3">
        <Step
          number={1}
          title="Register your store"
          description="Your merchant account and store profile have been created."
          done={true}
        />

        <Step
          number={2}
          title="Add your first product"
          description="Create at least one product so customers can browse and order from your store."
          done={hasProduct}
          cta="Create product"
          ctaHref="/merchant/products/new"
        />

        <Step
          number={3}
          title="Upgrade your plan"
          description="Free plan is limited to 5 products and 50 orders/month. Upgrade to unlock higher limits."
          done={hasUpgraded}
          cta="View plans"
          ctaHref="/merchant/billing"
          optional
        />
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-white/10 bg-gray-800/30 p-4">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Setup progress</span>
          <span>{[true, hasProduct].filter(Boolean).length} / 2 required steps done</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${([true, hasProduct].filter(Boolean).length / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* Store URL */}
      {isSome(billing.storeSlug) && (
        <div className="rounded-xl border border-white/10 bg-gray-800/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Your store URL
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-gray-900 px-2.5 py-1 text-sm text-emerald-300">
              {APP_URL}/store/{billing.storeSlug.value}
            </code>
            <Link
              href={`/store/${billing.storeSlug.value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Open ↗
            </Link>
          </div>
        </div>
      )}

      <Link
        href="/merchant/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-300"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
