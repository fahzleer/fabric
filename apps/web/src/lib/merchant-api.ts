import { auth } from "@/lib/auth";
import type { Maybe } from "@fabric/types";
import { None, Some, isSome } from "@fabric/types";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const PRODUCT_BASE = process.env.PRODUCT_API_URL ?? API_BASE;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

async function issueToken(userId: string, email: string, role: string): Promise<Maybe<string>> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ userId, email, role }),
      cache: "no-store",
    });
    if (!res.ok) return None();
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ? Some(data.accessToken) : None();
  } catch {
    return None();
  }
}

export type MerchantStatus = {
  plan: string;
  planStatus: string;
  limits: { maxProducts: number; maxOrdersPerMonth: number };
  productCount: number;
  productCapacityUsed: Maybe<number>;
  planExpiresAt: Maybe<string>;
  hasStripeAccount: boolean;
  storeSlug: Maybe<string>;
  storeName: string;
  onboarded: Maybe<boolean>;
};

export type MerchantProduct = {
  id: string;
  name: string;
  price: number;
  priceCurrency: string;
  category: string;
  status: string;
  stock: Record<string, number>;
  images: { url: string; alt: string; isPrimary: boolean; order: number }[];
  ownerId: string;
  createdAt?: string;
};

export type MerchantAnalytics = {
  completedOrderCount: number;
  totalRevenueCents: number;
  productCount: number;
  plan: string;
  planStatus: string;
};

export type PayoutBalance = {
  totalRevenueCents: number;
  paidOutCents: number;
  platformFeePct: number;
  availableBalanceCents: number;
};

export type PayoutRequest = {
  id: string;
  userId: string;
  requestedAt: string;
  amountCents: number;
  bankInfo: string;
  status: "pending" | "approved" | "rejected";
  resolvedAt?: string;
  adminNote?: string;
};

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string; _tag?: string };

export async function createMerchantApi(): Promise<
  Maybe<Awaited<ReturnType<typeof _buildMerchantApi>>>
> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return None();
  const user = session.user as { id: string; email: string; role?: string };
  const maybeToken = await issueToken(user.id, user.email, user.role ?? "customer");
  if (!isSome(maybeToken)) return None();
  return Some(_buildMerchantApi(user, maybeToken.value));
}

function _buildMerchantApi(user: { id: string; email: string; role?: string }, token: string) {
  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  return {
    userId: user.id,
    role: user.role ?? "customer",

    async getBillingStatus(): Promise<ApiResult<MerchantStatus>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/billing/status`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantStatus & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load billing status",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error loading billing status" };
      }
    },

    async onboardMerchant(
      storeName: string
    ): Promise<ApiResult<{ userId: string; storeName: string; plan: string }>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/onboard`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ storeName }),
          cache: "no-store",
        });
        const data = (await res.json()) as {
          userId?: string;
          storeName?: string;
          plan?: string;
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Onboarding failed",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return {
          ok: true,
          value: {
            userId: data.userId ?? "",
            storeName: data.storeName ?? "",
            plan: data.plan ?? "free",
          },
        };
      } catch {
        return { ok: false, error: "Network error during onboarding" };
      }
    },

    async getProductById(id: string): Promise<ApiResult<MerchantProduct>> {
      try {
        const res = await fetch(`${PRODUCT_BASE}/products/${id}`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Product not found",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error loading product" };
      }
    },

    async getMyProducts(
      page = 1,
      perPage = 20
    ): Promise<ApiResult<{ items: MerchantProduct[]; total: number }>> {
      try {
        const url = new URL(`${PRODUCT_BASE}/products`);
        url.searchParams.set("page", String(page));
        url.searchParams.set("perPage", String(perPage));
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = (await res.json()) as {
          items?: MerchantProduct[];
          total?: number;
          error?: string;
        };
        if (!res.ok) return { ok: false, error: data.error ?? "Failed to load products" };
        const items = (data.items ?? []).filter((p) => p.ownerId === user.id);
        return { ok: true, value: { items, total: items.length } };
      } catch {
        return { ok: false, error: "Network error loading products" };
      }
    },

    async createProduct(body: {
      name: string;
      description?: string;
      price: number;
      priceCurrency?: string;
      category: string;
      stock: Record<string, number>;
      images: { url: string; alt: string; isPrimary: boolean; order: number }[];
    }): Promise<ApiResult<MerchantProduct>> {
      try {
        const res = await fetch(`${PRODUCT_BASE}/products`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ ...body, merchantId: user.id }),
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to create product",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error creating product" };
      }
    },

    async updateProduct(
      id: string,
      body: Partial<{
        name: string;
        description: string;
        price: number;
        priceCurrency: string;
        category: string;
        status: string;
        stock: Record<string, number>;
        images: { url: string; alt: string; isPrimary: boolean; order: number }[];
      }>
    ): Promise<ApiResult<MerchantProduct>> {
      try {
        const res = await fetch(`${PRODUCT_BASE}/products/${id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to update product",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error updating product" };
      }
    },

    async getBillingPortalUrl(): Promise<ApiResult<string>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/billing/portal`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as { url?: string; error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to get portal URL",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data.url ?? "" };
      } catch {
        return { ok: false, error: "Network error getting portal URL" };
      }
    },

    async subscribeToPlan(
      planId: "starter" | "professional" | "enterprise"
    ): Promise<ApiResult<{ plan: string; planStatus: string }>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/billing/subscribe`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ planId }),
          cache: "no-store",
        });
        const data = (await res.json()) as {
          plan?: string;
          planStatus?: string;
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to subscribe",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: { plan: data.plan ?? "", planStatus: data.planStatus ?? "" } };
      } catch {
        return { ok: false, error: "Network error subscribing to plan" };
      }
    },

    async getAnalytics(): Promise<ApiResult<MerchantAnalytics>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/analytics/summary`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantAnalytics & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load analytics",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error loading analytics" };
      }
    },

    async cancelSubscription(): Promise<ApiResult<void>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/billing/cancel`, {
          method: "POST",
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to cancel subscription",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "Network error cancelling subscription" };
      }
    },

    async getPayoutBalance(): Promise<ApiResult<PayoutBalance>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/payouts/balance`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as PayoutBalance & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load payout balance",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error loading payout balance" };
      }
    },

    async listPayouts(): Promise<ApiResult<PayoutRequest[]>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/payouts`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as {
          payouts?: PayoutRequest[];
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load payouts",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data.payouts ?? [] };
      } catch {
        return { ok: false, error: "Network error loading payouts" };
      }
    },

    async requestPayout(amountCents: number, bankInfo: string): Promise<ApiResult<PayoutRequest>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/payouts/request`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ amountCents, bankInfo }),
          cache: "no-store",
        });
        const data = (await res.json()) as PayoutRequest & { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to request payout",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data };
      } catch {
        return { ok: false, error: "Network error requesting payout" };
      }
    },

    async listAllPendingPayouts(): Promise<ApiResult<PayoutRequest[]>> {
      try {
        const res = await fetch(`${API_BASE}/admin/payouts`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as {
          payouts?: PayoutRequest[];
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load pending payouts",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data.payouts ?? [] };
      } catch {
        return { ok: false, error: "Network error loading pending payouts" };
      }
    },

    async approvePayout(requestId: string, ownerUserId: string): Promise<ApiResult<void>> {
      try {
        const res = await fetch(`${API_BASE}/admin/payouts/${requestId}/approve`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ ownerUserId }),
          cache: "no-store",
        });
        const data = (await res.json()) as { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to approve payout",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "Network error approving payout" };
      }
    },

    async rejectPayout(
      requestId: string,
      ownerUserId: string,
      reason: string
    ): Promise<ApiResult<void>> {
      try {
        const res = await fetch(`${API_BASE}/admin/payouts/${requestId}/reject`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({ ownerUserId, reason }),
          cache: "no-store",
        });
        const data = (await res.json()) as { error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to reject payout",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: undefined };
      } catch {
        return { ok: false, error: "Network error rejecting payout" };
      }
    },

    async listMerchants(): Promise<ApiResult<unknown[]>> {
      try {
        const res = await fetch(`${API_BASE}/admin/merchants`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as { merchants?: unknown[]; error?: string; _tag?: string };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load merchants",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data.merchants ?? [] };
      } catch {
        return { ok: false, error: "Network error loading merchants" };
      }
    },

    async listKycSubmissions(): Promise<ApiResult<unknown[]>> {
      try {
        const res = await fetch(`${API_BASE}/admin/kyc`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as {
          submissions?: unknown[];
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            error: data.error ?? "Failed to load KYC submissions",
            ...(data._tag ? { _tag: data._tag } : {}),
          };
        return { ok: true, value: data.submissions ?? [] };
      } catch {
        return { ok: false, error: "Network error loading KYC submissions" };
      }
    },
  };
}
