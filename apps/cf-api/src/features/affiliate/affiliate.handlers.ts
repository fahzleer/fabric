import type { Hono } from "hono";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import type { FirebaseAffiliateRepository } from "../../infrastructure/firebase/firebase-affiliate.repository";
import { requireAuth } from "../../infrastructure/guards/auth.middleware";

async function buildAffiliateResponse(affiliateRepo: FirebaseAffiliateRepository) {
  const data = await affiliateRepo.getData();

  const earningsByAffiliate = new Map<string, number>();
  for (const e of data.earnings) {
    earningsByAffiliate.set(
      e.affiliateId,
      (earningsByAffiliate.get(e.affiliateId) ?? 0) + e.amountCents
    );
  }

  const allTimeRevenueCents = data.earnings.reduce((s, e) => s + e.amountCents, 0);
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisYearRevenueCents = data.earnings
    .filter((e) => e.month.startsWith(currentYear))
    .reduce((s, e) => s + e.amountCents, 0);
  const thisMonthRevenueCents = data.earnings
    .filter((e) => e.month === currentMonth)
    .reduce((s, e) => s + e.amountCents, 0);

  return {
    affiliates: data.affiliates,
    links: data.links,
    earnings: data.earnings,
    payouts: data.payouts.map((p) => ({
      ...p,
      affiliateName: data.affiliates.find((a) => a.id === p.affiliateId)?.name ?? p.affiliateId,
    })),
    pipeline: data.pipeline,
    contacts: data.contacts,
    earningsByAffiliate: data.affiliates.map((a) => ({
      affiliateId: a.id,
      affiliateName: a.name,
      commissionRatePct: a.commissionRatePct,
      totalEarningsCents: earningsByAffiliate.get(a.id) ?? 0,
      currency: "THB",
    })),
    summary: {
      allTimeRevenueCents,
      thisYearRevenueCents,
      thisMonthRevenueCents,
      currency: "THB",
    },
  };
}

export function registerAffiliateRoutes(
  app: Hono,
  affiliateRepo: FirebaseAffiliateRepository,
  verifier: PasetoVerifierService
): void {
  app.get("/admin/affiliate/data", requireAuth(verifier), async (c) => {
    if (c.get("userRole") !== "admin") return c.json({ error: "Forbidden" }, 403);
    return c.json(await buildAffiliateResponse(affiliateRepo));
  });

  app.get("/merchant/affiliate/data", requireAuth(verifier), async (c) => {
    const role = c.get("userRole") as string;
    if (role !== "store_owner" && role !== "admin") return c.json({ error: "Forbidden" }, 403);
    return c.json(await buildAffiliateResponse(affiliateRepo));
  });
}
