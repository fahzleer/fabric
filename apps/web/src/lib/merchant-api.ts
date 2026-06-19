import { auth } from "@/lib/auth";
import type {
  Affiliate,
  AffiliateContact,
  AffiliateEarning,
  AffiliateEarningRow,
  AffiliateLink,
  AffiliatePayoutRow,
  AffiliateSummaryStats,
  ContentPipelineItem,
  Maybe,
} from "@fabric/types";
import { Err, None, Ok, type Result, Some, isSome } from "@fabric/types";
import { headers } from "next/headers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
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

export type MerchantInventoryProduct = {
  id: string;
  name: string;
  category: string;
  status: string;
  priceCents: number;
  currency: string;
  stock: Record<string, number>;
  totalStock: number;
  createdAt: string;
};

export type MerchantOrderSummary = {
  id: string;
  status: string;
  itemCount: number;
  totalAmountInCents: number;
  currency: string;
  placedAt: string;
  customerId: string;
};

export type MerchantOrderLine = {
  productId: { value: string };
  productName: string;
  size: string;
  quantity: number;
  unitPrice: { amount: number; currency: string };
};

export type MerchantOrderDetail = {
  id: { value: string };
  status: string;
  totalAmountInCents: number;
  shippingCents: number;
  discountCents: number;
  currency: string;
  placedAt: string;
  userId: { value: string };
  lines: MerchantOrderLine[];
  shippingAddress: {
    recipientName: string;
    street: string;
    city: string;
    province: string;
    country: string;
    postalCode: string;
    phone: string;
  };
};

export type MerchantAffiliatesData = {
  affiliates: Affiliate[];
  links: AffiliateLink[];
  earnings: AffiliateEarning[];
  payouts: AffiliatePayoutRow[];
  pipeline: ContentPipelineItem[];
  contacts: AffiliateContact[];
  earningsByAffiliate: AffiliateEarningRow[];
  summary: AffiliateSummaryStats;
};

function formatApiError(tag: string | undefined, message: string): string {
  return tag ? `[${tag}] ${message}` : message;
}

export type ApiResult<T> = Result<T, string>;

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
          return Err(formatApiError(data._tag, data.error ?? "Failed to load billing status"));
        return Ok(data);
      } catch {
        return Err("Network error loading billing status");
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
        if (!res.ok) return Err(formatApiError(data._tag, data.error ?? "Onboarding failed"));
        return Ok({
          userId: data.userId ?? "",
          storeName: data.storeName ?? "",
          plan: data.plan ?? "free",
        });
      } catch {
        return Err("Network error during onboarding");
      }
    },

    async getProductById(id: string): Promise<ApiResult<MerchantProduct>> {
      try {
        const res = await fetch(`${API_BASE}/api/products/${id}`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok) return Err(formatApiError(data._tag, data.error ?? "Product not found"));
        return Ok(data);
      } catch {
        return Err("Network error loading product");
      }
    },

    async getMyProducts(
      page = 1,
      perPage = 20
    ): Promise<ApiResult<{ items: MerchantProduct[]; total: number }>> {
      try {
        const url = new URL(`${API_BASE}/merchant/products`);
        url.searchParams.set("page", String(page));
        url.searchParams.set("perPage", String(perPage));
        const res = await fetch(url.toString(), { headers: authHeaders, cache: "no-store" });
        const data = (await res.json()) as {
          items?: MerchantProduct[];
          total?: number;
          error?: string;
        };
        if (!res.ok) return Err(data.error ?? "Failed to load products");
        return Ok({ items: data.items ?? [], total: data.total ?? 0 });
      } catch {
        return Err("Network error loading products");
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
        const res = await fetch(`${API_BASE}/api/products`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok)
          return Err(formatApiError(data._tag, data.error ?? "Failed to create product"));
        return Ok(data);
      } catch {
        return Err("Network error creating product");
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
        const res = await fetch(`${API_BASE}/api/products/${id}`, {
          method: "PUT",
          headers: authHeaders,
          body: JSON.stringify(body),
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantProduct & { error?: string; _tag?: string };
        if (!res.ok)
          return Err(formatApiError(data._tag, data.error ?? "Failed to update product"));
        return Ok(data);
      } catch {
        return Err("Network error updating product");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to get portal URL"));
        return Ok(data.url ?? "");
      } catch {
        return Err("Network error getting portal URL");
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
        if (!res.ok) return Err(formatApiError(data._tag, data.error ?? "Failed to subscribe"));
        return Ok({ plan: data.plan ?? "", planStatus: data.planStatus ?? "" });
      } catch {
        return Err("Network error subscribing to plan");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to load analytics"));
        return Ok(data);
      } catch {
        return Err("Network error loading analytics");
      }
    },

    async getMerchantInventory(): Promise<ApiResult<MerchantInventoryProduct[]>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/inventory`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as {
          products?: MerchantInventoryProduct[];
          error?: string;
        };
        if (!res.ok) return Err(data.error ?? "Failed to load inventory");
        return Ok(data.products ?? []);
      } catch {
        return Err("Network error loading inventory");
      }
    },

    async getMerchantAffiliates(): Promise<ApiResult<MerchantAffiliatesData>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/affiliate/data`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantAffiliatesData & {
          error?: string;
          _tag?: string;
        };
        if (!res.ok)
          return Err(formatApiError(data._tag, data.error ?? "Failed to load affiliates"));
        return Ok(data);
      } catch {
        return Err("Network error loading affiliates");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to cancel subscription"));
        return Ok(undefined);
      } catch {
        return Err("Network error cancelling subscription");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to load payout balance"));
        return Ok(data);
      } catch {
        return Err("Network error loading payout balance");
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
        if (!res.ok) return Err(formatApiError(data._tag, data.error ?? "Failed to load payouts"));
        return Ok(data.payouts ?? []);
      } catch {
        return Err("Network error loading payouts");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to request payout"));
        return Ok(data);
      } catch {
        return Err("Network error requesting payout");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to load pending payouts"));
        return Ok(data.payouts ?? []);
      } catch {
        return Err("Network error loading pending payouts");
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
          return Err(formatApiError(data._tag, data.error ?? "Failed to approve payout"));
        return Ok(undefined);
      } catch {
        return Err("Network error approving payout");
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
        if (!res.ok) return Err(formatApiError(data._tag, data.error ?? "Failed to reject payout"));
        return Ok(undefined);
      } catch {
        return Err("Network error rejecting payout");
      }
    },

    async getMerchantOrders(
      page = 1,
      perPage = 20
    ): Promise<
      ApiResult<{ items: MerchantOrderSummary[]; total: number; page: number; perPage: number }>
    > {
      try {
        const url = new URL(`${API_BASE}/merchant/orders`);
        url.searchParams.set("page", String(page));
        url.searchParams.set("perPage", String(perPage));
        const res = await fetch(url.toString(), { headers: authHeaders, cache: "no-store" });
        const data = (await res.json()) as {
          items?: MerchantOrderSummary[];
          total?: number;
          error?: string;
        };
        if (!res.ok) return Err(data.error ?? "Failed to load orders");
        return Ok({ items: data.items ?? [], total: data.total ?? 0, page, perPage });
      } catch {
        return Err("Network error loading orders");
      }
    },

    async getMerchantOrderById(id: string): Promise<ApiResult<MerchantOrderDetail>> {
      try {
        const res = await fetch(`${API_BASE}/merchant/orders/${id}`, {
          headers: authHeaders,
          cache: "no-store",
        });
        const data = (await res.json()) as MerchantOrderDetail & { error?: string };
        if (!res.ok) return Err(data.error ?? "Order not found");
        return Ok(data);
      } catch {
        return Err("Network error loading order");
      }
    },
  };
}
