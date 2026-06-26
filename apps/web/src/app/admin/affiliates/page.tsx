import { auth } from "@/lib/auth";
import type {
  Affiliate,
  AffiliateContact,
  AffiliateEarning,
  AffiliateLink,
  AffiliatePayout,
  ContactStatus,
  ContentPipelineItem,
  ContentPipelineStatus,
  Platform,
} from "@fabric/types";
import { PIPELINE_COLUMNS, PIPELINE_COLUMN_LABELS } from "@fabric/types";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Affiliates — Admin" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? "";

type EarningRow = {
  affiliateId: string;
  affiliateName: string;
  commissionRatePct: number;
  totalEarningsCents: number;
  currency: string;
};

type AffiliateApiData = {
  affiliates: Affiliate[];
  links: AffiliateLink[];
  earnings: AffiliateEarning[];
  payouts: (AffiliatePayout & { affiliateName: string })[];
  pipeline: ContentPipelineItem[];
  contacts: AffiliateContact[];
  earningsByAffiliate: EarningRow[];
  summary: {
    allTimeRevenueCents: number;
    thisYearRevenueCents: number;
    thisMonthRevenueCents: number;
    currency: string;
  };
};

async function issueAdminToken(userId: string, email: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/internal/issue-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": INTERNAL_SECRET },
      body: JSON.stringify({ userId, email, role: "admin" }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

async function getAffiliateData(token: string): Promise<AffiliateApiData | null> {
  try {
    const res = await fetch(`${API_BASE}/admin/affiliate/data`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AffiliateApiData;
  } catch {
    return null;
  }
}

function formatThb(cents: number): string {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const platformIcons: Record<Platform, string> = {
  tiktok: "🎵",
  youtube: "▶",
  instagram: "📷",
  facebook: "𝒇",
  x: "𝕏",
  linkedin: "in",
};

const contactStatusStyles: Record<ContactStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  contacted: "bg-info/20 text-info",
  responded: "bg-warning/20 text-warning",
  converted: "bg-success/20 text-success",
};

const pipelineColumnStyles: Record<ContentPipelineStatus, string> = {
  draft: "border-border bg-card/40",
  creating: "border-info/40 bg-info/30",
  editing: "border-info/40 bg-info/30",
  ready_to_post: "border-warning/40 bg-warning/30",
  published: "border-success/40 bg-success/30",
};

const pipelineHeaderStyles: Record<ContentPipelineStatus, string> = {
  draft: "text-muted-foreground",
  creating: "text-info",
  editing: "text-info",
  ready_to_post: "text-warning",
  published: "text-success",
};

export default async function AffiliatesPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-muted-foreground">Failed to authenticate</p>;

  const data = await getAffiliateData(token);
  if (!data) return <p className="text-muted-foreground">Failed to load affiliate data</p>;

  const allTimeTotal = data.payouts.reduce((s, p) => s + p.amountCents, 0);

  const pipelineByStatus = Object.fromEntries(
    PIPELINE_COLUMNS.map((col) => [col, data.pipeline.filter((c) => c.status === col)])
  ) as Record<ContentPipelineStatus, ContentPipelineItem[]>;

  const payoutsByMonth = data.payouts.reduce<Record<string, typeof data.payouts>>((acc, p) => {
    const key = p.month;
    if (!acc[key]) acc[key] = [];
    acc[key]?.push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-10 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Affiliate Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings · Links · Content pipeline · Contacts
        </p>
      </div>

      {/* Summary */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Summary Report
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "All Time Revenue",
              value: formatThb(data.summary.allTimeRevenueCents),
              note: "all programs combined",
              accent: "border-info/30 bg-info/5",
            },
            {
              label: `This Year (${new Date().getFullYear()})`,
              value: formatThb(data.summary.thisYearRevenueCents),
              note: `Jan–Dec ${new Date().getFullYear()}`,
              accent: "border-success/30 bg-success/5",
            },
            {
              label: "This Month",
              value: formatThb(data.summary.thisMonthRevenueCents),
              note: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
              accent: "border-warning/30 bg-warning/5",
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings per affiliate */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Earnings per Affiliate
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Program", "Commission", "Total Earnings", "Description"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.earningsByAffiliate.map((row) => {
                const aff = data.affiliates.find((a) => a.id === row.affiliateId);
                return (
                  <tr
                    key={row.affiliateId}
                    className="bg-card/30 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{row.affiliateName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-semibold text-success">
                        {row.commissionRatePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {row.totalEarningsCents > 0 ? (
                        formatThb(row.totalEarningsCents)
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">
                      {aff?.description ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Affiliate links */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Affiliate Links
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.links.map((link) => {
            const aff = data.affiliates.find((a) => a.id === link.affiliateId);
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3"
              >
                <span className="text-lg" title={link.platform}>
                  {platformIcons[link.platform]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {aff?.name ?? link.affiliateId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Payout tracking */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payout Tracking
        </h2>
        <div className="space-y-4">
          {Object.entries(payoutsByMonth)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, payouts]) => {
              const monthTotal = payouts.reduce((s, p) => s + p.amountCents, 0);
              return (
                <div key={month} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
                    <span className="text-sm font-semibold text-foreground">
                      {new Date(`${month}-01`).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-sm font-bold text-success">{formatThb(monthTotal)}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {payouts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-card/30 px-4 py-2"
                      >
                        <span className="text-sm text-foreground">{p.affiliateName}</span>
                        <span className="text-sm font-medium text-foreground">
                          {formatThb(p.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
        {allTimeTotal > 0 && (
          <div className="mt-3 flex justify-end">
            <p className="text-sm text-muted-foreground">
              Total paid out:{" "}
              <span className="font-bold text-foreground">{formatThb(allTimeTotal)}</span>
            </p>
          </div>
        )}
      </section>

      {/* Content pipeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Content Pipeline
        </h2>
        <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
          {PIPELINE_COLUMNS.map((col) => {
            const items = pipelineByStatus[col] ?? [];
            return (
              <div key={col} className={`rounded-xl border ${pipelineColumnStyles[col]} p-3`}>
                <div className="mb-3 flex items-center justify-between">
                  <h3
                    className={`text-xs font-semibold uppercase tracking-wider ${pipelineHeaderStyles[col]}`}
                  >
                    {PIPELINE_COLUMN_LABELS[col]}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const aff = item.affiliateId
                      ? data.affiliates.find((a) => a.id === item.affiliateId)
                      : null;
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-muted/60 px-3 py-2"
                      >
                        <p className="text-xs font-medium text-foreground leading-snug">
                          {item.title}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs" title={item.platform}>
                            {platformIcons[item.platform]}
                          </span>
                          {aff && (
                            <span className="truncate rounded-sm bg-muted px-1 text-xs text-muted-foreground">
                              {aff.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Platform breakdown */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Breakdown
        </h2>
        <div className="flex flex-wrap gap-3">
          {(["tiktok", "youtube", "instagram", "facebook", "x", "linkedin"] as Platform[]).map(
            (platform) => {
              const count = data.pipeline.filter((c) => c.platform === platform).length;
              return (
                <div
                  key={platform}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-4 py-2"
                >
                  <span className="text-base">{platformIcons[platform]}</span>
                  <span className="text-sm font-medium capitalize text-foreground">
                    {platform === "x"
                      ? "X (Twitter)"
                      : platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* Contacts */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts Management
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Name", "Email", "Program", "Status", "Notes"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.contacts.map((contact) => {
                const aff = contact.affiliateId
                  ? data.affiliates.find((a) => a.id === contact.affiliateId)
                  : null;
                return (
                  <tr key={contact.id} className="bg-card/30 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{contact.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {contact.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {aff?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${contactStatusStyles[contact.status]}`}
                      >
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                      {contact.notes ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
