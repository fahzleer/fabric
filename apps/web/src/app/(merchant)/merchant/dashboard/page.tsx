import { ClearCartOnMount } from "@/app/(shop)/order/[id]/confirmation/_components/clear-cart-on-mount";
import { CountUpNumber } from "@/components/motion/count-up-number";
import { RevealGroup, RevealItem } from "@/components/motion/reveal";
import { type MerchantStatus, createMerchantApi } from "@/lib/merchant-api";
import { isOk, isSome } from "@fabric/types";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AnimatedCapacityBar } from "./_components/animated-capacity-bar";

export const metadata: Metadata = {
  title: "Dashboard — Merchant Portal",
};

const PLAN_COLOURS: Record<string, string> = {
  free: "bg-muted/50 text-foreground border-border",
  starter: "bg-info/20 text-info border-info/40",
  professional: "bg-info/20 text-info border-info/40",
  enterprise: "bg-warning/20 text-warning border-warning/40",
};

const STATUS_COLOURS: Record<string, string> = {
  active: "text-success",
  trialing: "text-info",
  past_due: "text-warning",
  canceled: "text-destructive",
  inactive: "text-muted-foreground",
};

function NotOnboardedView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome to your store</h1>
        <p className="mt-1 text-sm text-muted-foreground">Complete setup to start selling</p>
      </div>
      <div className="rounded-xl border border-success/30 bg-success/10 p-6">
        <h2 className="text-lg font-semibold text-success">Finish setting up your store</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your store profile hasn&apos;t been created yet. Click below to complete onboarding.
        </p>
        <Link
          href="/merchant/onboarding"
          className="mt-4 inline-block rounded-lg bg-success px-5 py-2.5 text-sm font-medium text-foreground hover:bg-success"
        >
          Complete onboarding →
        </Link>
      </div>
    </div>
  );
}

function StatsCards({
  billing,
  planKey,
  statusKey,
  maxProducts,
}: {
  billing: MerchantStatus;
  planKey: string;
  statusKey: string;
  maxProducts: string;
}) {
  return (
    <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <RevealItem className="rounded-xl border border-border bg-muted/50 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Current Plan
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${PLAN_COLOURS[planKey] ?? PLAN_COLOURS.free}`}
          >
            {planKey}
          </span>
        </div>
        <p
          className={`mt-2 text-sm font-medium capitalize ${STATUS_COLOURS[statusKey] ?? "text-muted-foreground"}`}
        >
          {statusKey}
        </p>
      </RevealItem>
      <RevealItem className="rounded-xl border border-border bg-muted/50 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Products
        </p>
        <p className="mt-2 text-3xl font-bold text-foreground">
          <CountUpNumber value={billing.productCount ?? 0} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">of {maxProducts} on your plan</p>
        {isSome(billing.productCapacityUsed) && (
          <AnimatedCapacityBar capacityPct={billing.productCapacityUsed.value} />
        )}
      </RevealItem>
      <RevealItem className="rounded-xl border border-border bg-muted/50 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Link href="/merchant/products" className="text-sm text-success hover:text-success">
            → View products
          </Link>
          <Link href="/merchant/billing" className="text-sm text-success hover:text-success">
            → Manage billing
          </Link>
          {planKey === "free" && (
            <Link
              href="/merchant/billing"
              className="text-sm font-medium text-warning hover:text-warning"
            >
              ↑ Upgrade plan
            </Link>
          )}
        </div>
      </RevealItem>
    </RevealGroup>
  );
}

function PlanLimits({ billing, maxProducts }: { billing: MerchantStatus; maxProducts: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6">
      <h2 className="text-sm font-semibold text-foreground">Plan limits</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <span className="text-muted-foreground">Max products</span>
          <p className="mt-0.5 font-medium text-foreground">{maxProducts}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Monthly orders</span>
          <p className="mt-0.5 font-medium text-foreground">
            {billing.limits.maxOrdersPerMonth === -1
              ? "Unlimited"
              : billing.limits.maxOrdersPerMonth.toLocaleString()}
          </p>
        </div>
        {isSome(billing.planExpiresAt) && (
          <div>
            <span className="text-muted-foreground">Renews</span>
            <p className="mt-0.5 font-medium text-foreground">
              {new Date(billing.planExpiresAt.value).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function MerchantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  await connection();
  const { welcome } = await searchParams;

  const maybeApi = await createMerchantApi();

  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        {welcome === "1" && <ClearCartOnMount />}
        <p className="text-muted-foreground">Unable to load merchant data. Please refresh.</p>
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
      <>
        {welcome === "1" && <ClearCartOnMount />}
        <NotOnboardedView />
      </>
    );
  }

  const billing = billingResult.value;

  const planKey = billing.plan ?? "free";
  const statusKey = billing.planStatus ?? "inactive";
  const maxProducts =
    billing.limits.maxProducts === -1 ? "∞" : String(billing.limits.maxProducts ?? 0);

  return (
    <div className="space-y-8">
      {welcome === "1" && <ClearCartOnMount />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your store at a glance</p>
        </div>
        <Link
          href="/merchant/products/new"
          className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-foreground hover:bg-success"
        >
          + New product
        </Link>
      </div>
      <StatsCards
        billing={billing}
        planKey={planKey}
        statusKey={statusKey}
        maxProducts={maxProducts}
      />
      <PlanLimits billing={billing} maxProducts={maxProducts} />
    </div>
  );
}
