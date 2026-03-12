import { createMerchantApi } from "@/lib/merchant-api";
import { isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Dashboard — Merchant Portal",
};

const PLAN_COLOURS: Record<string, string> = {
  free: "bg-gray-700/50 text-gray-300 border-gray-600",
  starter: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  professional: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  enterprise: "bg-amber-500/20 text-amber-300 border-amber-500/40",
};

const STATUS_COLOURS: Record<string, string> = {
  active: "text-emerald-400",
  trialing: "text-blue-400",
  past_due: "text-amber-400",
  canceled: "text-red-400",
  inactive: "text-gray-500",
};

function NotOnboardedView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome to your store</h1>
        <p className="mt-1 text-sm text-gray-400">Complete setup to start selling</p>
      </div>
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
        <h2 className="text-lg font-semibold text-emerald-300">Finish setting up your store</h2>
        <p className="mt-2 text-sm text-gray-400">
          Your store profile hasn&apos;t been created yet. Click below to complete onboarding.
        </p>
        <Link
          href="/merchant/onboarding"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Complete onboarding →
        </Link>
      </div>
    </div>
  );
}

function CapacityBar({ capacityPct }: { capacityPct: number }) {
  const barColour =
    capacityPct >= 90 ? "bg-red-500" : capacityPct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
      <div
        className={`h-full rounded-full ${barColour}`}
        style={{ width: `${Math.min(100, capacityPct)}%` }}
      />
    </div>
  );
}

export default async function MerchantDashboardPage() {
  await connection();

  const maybeApi = await createMerchantApi();

  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400">Unable to load merchant data. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const billingResult = await api.getBillingStatus();

  const isOnboarded =
    billingResult.ok &&
    isSome(billingResult.value.onboarded) &&
    billingResult.value.onboarded.value;
  if (!isOnboarded) {
    return <NotOnboardedView />;
  }

  const billing = billingResult.value;

  const planKey = billing.plan ?? "free";
  const statusKey = billing.planStatus ?? "inactive";
  const capacityPct = billing.productCapacityUsed;
  const maxProducts =
    billing.limits.maxProducts === -1 ? "∞" : String(billing.limits.maxProducts ?? 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-400">Your store at a glance</p>
        </div>
        <Link
          href="/merchant/products/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + New product
        </Link>
      </div>

      {/* Plan + status cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Plan */}
        <div className="rounded-xl border border-white/10 bg-gray-800/50 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Current Plan</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_COLOURS[planKey] ?? PLAN_COLOURS.free}`}
            >
              {planKey}
            </span>
          </div>
          <p
            className={`mt-2 text-sm font-medium capitalize ${STATUS_COLOURS[statusKey] ?? "text-gray-400"}`}
          >
            {statusKey}
          </p>
        </div>

        {/* Product capacity */}
        <div className="rounded-xl border border-white/10 bg-gray-800/50 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Products</p>
          <p className="mt-2 text-3xl font-bold text-white">{billing?.productCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">of {maxProducts} on your plan</p>
          {isSome(capacityPct) && <CapacityBar capacityPct={capacityPct.value} />}
        </div>

        {/* Quick actions */}
        <div className="rounded-xl border border-white/10 bg-gray-800/50 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Quick Actions
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href="/merchant/products"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              → View products
            </Link>
            <Link
              href="/merchant/billing"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              → Manage billing
            </Link>
            {planKey === "free" && (
              <Link
                href="/merchant/billing"
                className="text-sm font-medium text-amber-400 hover:text-amber-300"
              >
                ↑ Upgrade plan
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Plan limits info */}
      {billing && (
        <div className="rounded-xl border border-white/10 bg-gray-800/30 p-6">
          <h2 className="text-sm font-semibold text-gray-300">Plan limits</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <span className="text-gray-400">Max products</span>
              <p className="mt-0.5 font-medium text-white">{maxProducts}</p>
            </div>
            <div>
              <span className="text-gray-400">Monthly orders</span>
              <p className="mt-0.5 font-medium text-white">
                {billing.limits.maxOrdersPerMonth === -1
                  ? "Unlimited"
                  : billing.limits.maxOrdersPerMonth.toLocaleString()}
              </p>
            </div>
            {isSome(billing.planExpiresAt) && (
              <div>
                <span className="text-gray-400">Renews</span>
                <p className="mt-0.5 font-medium text-white">
                  {new Date(billing.planExpiresAt.value).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
