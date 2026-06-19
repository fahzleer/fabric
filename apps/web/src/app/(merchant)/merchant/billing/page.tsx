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
    colour: "border-gray-600",
    badge: "bg-gray-700/50 text-gray-300",
  },
  starter: {
    name: "Starter",
    price: "฿990 / mo",
    description: "For growing stores",
    features: ["Up to 50 products", "1,000 orders / month", "Priority support"],
    colour: "border-blue-500/40",
    badge: "bg-blue-500/20 text-blue-300",
  },
  professional: {
    name: "Professional",
    price: "฿2,990 / mo",
    description: "For established businesses",
    features: ["Up to 500 products", "10,000 orders / month", "Dedicated support", "Custom domain"],
    colour: "border-purple-500/40",
    badge: "bg-purple-500/20 text-purple-300",
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    description: "For high-volume sellers",
    features: ["Unlimited products", "Unlimited orders", "SLA guarantee", "Account manager"],
    colour: "border-amber-500/40",
    badge: "bg-amber-500/20 text-amber-300",
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
    <div className="rounded-xl border border-white/10 bg-gray-800/50 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Current plan</h2>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-0.5 text-sm font-semibold ${PLAN_DETAILS[currentPlan]?.badge ?? ""}`}
            >
              {PLAN_DETAILS[currentPlan]?.name ?? currentPlan}
            </span>
            <span className={`text-xs ${isActive ? "text-emerald-400" : "text-amber-400"}`}>
              {billing.planStatus}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {billing.productCount} /{" "}
            {billing.limits.maxProducts === -1 ? "∞" : billing.limits.maxProducts} products used
          </p>
          {isSome(billing.planExpiresAt) && (
            <p className="mt-1 text-xs text-gray-500">
              Renews {new Date(billing.planExpiresAt.value).toLocaleDateString()}
            </p>
          )}
        </div>

        {billing.hasStripeAccount && (
          <form action={openBillingPortalAction}>
            <button
              type="submit"
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5"
            >
              Manage payment method →
            </button>
          </form>
        )}
      </div>

      {isActive && currentPlan !== "free" && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <form action={cancelSubscriptionAction}>
            <button type="submit" className="text-xs text-red-400 hover:text-red-300">
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
        isCurrent ? `${plan.colour} bg-white/5` : "border-white/10 bg-gray-800/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold uppercase tracking-wider rounded-full px-2.5 py-0.5 ${plan.badge}`}
        >
          {plan.name}
        </span>
        {isCurrent && <span className="text-xs text-emerald-400 font-medium">Current</span>}
      </div>
      <p className="mt-3 text-xl font-bold text-white">{plan.price}</p>
      <p className="mt-1 text-xs text-gray-400">{plan.description}</p>

      <ul className="mt-4 space-y-1.5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-300">
            <span className="text-emerald-400 mt-0.5">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {!isCurrent &&
        planId !== "free" &&
        (notOnboarded ? (
          <a
            href="/merchant/onboarding"
            className="mt-4 block w-full rounded-lg border border-amber-500/30 px-3 py-2 text-center text-xs font-medium text-amber-400 hover:bg-amber-500/10"
          >
            Set up store first →
          </a>
        ) : (
          <form action={subscribePlanAction} className="mt-4">
            <input type="hidden" name="planId" value={planId} />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
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
        <p className="text-gray-400">Unable to load billing. Please refresh.</p>
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
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-gray-400">Manage your subscription and payment method</p>
      </div>

      {/* Not onboarded notice */}
      {notOnboarded && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
          <p className="text-sm font-medium text-amber-300">Create your store first</p>
          <p className="mt-1 text-xs text-amber-400/80">
            You need to set up your merchant profile before subscribing to a plan.
          </p>
          <a
            href="/merchant/onboarding"
            className="mt-3 inline-block rounded-lg bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
          >
            Complete store setup →
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Current plan card */}
      {billing && (
        <CurrentPlanCard billing={billing} currentPlan={currentPlan} isActive={isActive} />
      )}

      {/* Plan picker */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
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
      <p className="text-xs text-gray-500">
        Payments processed by Stripe. Prices exclude applicable taxes. Subscriptions renew
        automatically — cancel any time.
      </p>
    </div>
  );
}
