import { createMerchantApi } from "@/lib/merchant-api";
import { type Maybe, isOk, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";
import {
  cancelSubscriptionAction,
  openBillingPortalAction,
  subscribePlanAction,
} from "./_lib/actions";

export const metadata: Metadata = {
  title: "Billing — Merchant Portal",
};

const PLAN_DETAILS = {
  free: {
    name: "Free",
    price: "฿0 / mo",
    description: "Perfect for getting started",
    features: ["Up to 5 products", "100 orders / month", "Basic analytics"],
    colour: "border-border",
    badge: "bg-muted/50 text-foreground",
  },
  starter: {
    name: "Starter",
    price: "฿990 / mo",
    description: "For growing stores",
    features: ["Up to 50 products", "1,000 orders / month", "Priority support"],
    colour: "border-info/40",
    badge: "bg-info/20 text-info",
  },
  professional: {
    name: "Professional",
    price: "฿2,990 / mo",
    description: "For established businesses",
    features: ["Up to 500 products", "10,000 orders / month", "Dedicated support", "Custom domain"],
    colour: "border-info/40",
    badge: "bg-info/20 text-info",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    description: "For high-volume sellers",
    features: ["Unlimited products", "Unlimited orders", "SLA guarantee", "Account manager"],
    colour: "border-warning/40",
    badge: "bg-warning/20 text-warning",
  },
} as const;

type PlanId = keyof typeof PLAN_DETAILS;

type BillingInfo = {
  plan: string;
  planStatus: string;
  planExpiresAt: Maybe<string>;
  productCount: number;
  limits: { maxProducts: number; maxOrdersPerMonth: number };
  hasStripeAccount: boolean;
  onboarded: Maybe<boolean>;
};

function CurrentPlanCard({
  billing,
  currentPlan,
  isActive,
}: {
  billing: BillingInfo;
  currentPlan: PlanId;
  isActive: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Current plan
      </h2>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-0.5 text-sm font-semibold ${PLAN_DETAILS[currentPlan]?.badge ?? ""}`}
            >
              {PLAN_DETAILS[currentPlan]?.name ?? currentPlan}
            </span>
            <span className={`text-xs ${isActive ? "text-success" : "text-warning"}`}>
              {billing.planStatus}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {billing.productCount} /{" "}
            {billing.limits.maxProducts === -1 ? "∞" : billing.limits.maxProducts} products used
          </p>
          {isSome(billing.planExpiresAt) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Renews {new Date(billing.planExpiresAt.value).toLocaleDateString()}
            </p>
          )}
        </div>

        {billing.hasStripeAccount && (
          <form action={openBillingPortalAction}>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Manage payment method →
            </button>
          </form>
        )}
      </div>

      {isActive && currentPlan !== "free" && (
        <div className="mt-6 border-t border-border pt-4">
          <form action={cancelSubscriptionAction}>
            <button type="submit" className="text-xs text-destructive hover:text-destructive">
              Cancel subscription (takes effect at period end)
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function PlanCard({
  planId,
  plan,
  isCurrent,
  notOnboarded,
}: {
  planId: PlanId;
  plan: (typeof PLAN_DETAILS)[PlanId];
  isCurrent: boolean;
  notOnboarded: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col ${
        isCurrent ? `${plan.colour} bg-muted` : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${plan.badge}`}
        >
          {plan.name}
        </span>
        {isCurrent && <span className="text-xs text-success font-medium">Current</span>}
      </div>
      <p className="mt-3 text-xl font-bold text-foreground">{plan.price}</p>
      <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>

      <ul className="mt-4 space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-foreground">
            <span className="text-success mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {!isCurrent &&
        planId !== "free" &&
        (notOnboarded ? (
          <a
            href="/merchant/onboarding"
            className="mt-4 block w-full rounded-lg border border-warning/30 px-3 py-2 text-center text-xs font-medium text-warning hover:bg-warning/10"
          >
            Set up store first →
          </a>
        ) : (
          <form action={subscribePlanAction} className="mt-4">
            <input type="hidden" name="planId" value={planId} />
            <button
              type="submit"
              className="w-full rounded-lg bg-success px-3 py-2 text-xs font-medium text-foreground hover:bg-success"
            >
              {planId === "enterprise" ? "Contact sales" : `Upgrade to ${plan.name}`}
            </button>
          </form>
        ))}
    </div>
  );
}

export default async function MerchantBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();

  const { error } = await searchParams;

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unable to load billing. Please refresh.</p>
      </div>
    );
  }
  const api = maybeApi.value;

  const billingResult = await api.getBillingStatus();
  const notOnboarded =
    isOk(billingResult) &&
    isSome(billingResult.value.onboarded) &&
    !billingResult.value.onboarded.value;
  const billing = isOk(billingResult) ? billingResult.value : undefined;
  const currentPlan = (billing?.plan ?? "free") as PlanId;
  const isActive = billing?.planStatus === "active" || billing?.planStatus === "trialing";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and payment method
        </p>
      </div>

      {/* Not onboarded notice */}
      {notOnboarded && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-5 py-4">
          <p className="text-sm font-medium text-warning">Create your store first</p>
          <p className="mt-1 text-xs text-warning/80">
            You need to set up your merchant profile before subscribing to a plan.
          </p>
          <a
            href="/merchant/onboarding"
            className="mt-3 inline-block rounded-lg bg-warning/20 px-4 py-1.5 text-xs font-semibold text-warning hover:bg-warning/30"
          >
            Complete store setup →
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Current plan card */}
      {billing && (
        <CurrentPlanCard billing={billing} currentPlan={currentPlan} isActive={isActive} />
      )}

      {/* Plan picker */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {currentPlan === "free" ? "Upgrade your plan" : "Change plan"}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.entries(PLAN_DETAILS) as [PlanId, (typeof PLAN_DETAILS)[PlanId]][]).map(
            ([planId, plan]) => (
              <PlanCard
                key={planId}
                planId={planId}
                plan={plan}
                isCurrent={planId === currentPlan}
                notOnboarded={notOnboarded}
              />
            )
          )}
        </div>
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Payments processed by Stripe. Prices exclude applicable taxes. Subscriptions renew
        automatically — cancel any time.
      </p>
    </div>
  );
}
