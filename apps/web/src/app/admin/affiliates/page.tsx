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
  pending: "bg-gray-500/20 text-gray-400",
  contacted: "bg-blue-500/20 text-blue-300",
  responded: "bg-amber-500/20 text-amber-300",
  converted: "bg-emerald-500/20 text-emerald-300",
};

const pipelineColumnStyles: Record<ContentPipelineStatus, string> = {
  draft: "border-gray-700 bg-gray-900/40",
  creating: "border-blue-700/40 bg-blue-950/30",
  editing: "border-violet-700/40 bg-violet-950/30",
  ready_to_post: "border-amber-700/40 bg-amber-950/30",
  published: "border-emerald-700/40 bg-emerald-950/30",
};

const pipelineHeaderStyles: Record<ContentPipelineStatus, string> = {
  draft: "text-gray-400",
  creating: "text-blue-400",
  editing: "text-violet-400",
  ready_to_post: "text-amber-400",
  published: "text-emerald-400",
};

export default async function AffiliatesPage() {
  await connection();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/login");

  const user = session.user as { id: string; email: string };
  const token = await issueAdminToken(user.id, user.email);
  if (!token) return <p className="text-gray-400">Failed to authenticate</p>;

  const data = await getAffiliateData(token);
  if (!data) return <p className="text-gray-400">Failed to load affiliate data</p>;

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
        <h1 className="text-2xl font-bold text-white">Affiliate Marketing</h1>
        <p className="mt-1 text-sm text-gray-400">Earnings · Links · Content pipeline · Contacts</p>
      </div>

      {/* Summary */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Summary Report
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              label: "All Time Revenue",
              value: formatThb(data.summary.allTimeRevenueCents),
              note: "all programs combined",
              accent: "border-violet-500/30 bg-violet-500/5",
            },
            {
              label: `This Year (${new Date().getFullYear()})`,
              value: formatThb(data.summary.thisYearRevenueCents),
              note: `Jan–Dec ${new Date().getFullYear()}`,
              accent: "border-emerald-500/30 bg-emerald-500/5",
            },
            {
              label: "This Month",
              value: formatThb(data.summary.thisMonthRevenueCents),
              note: new Date().toLocaleString("en-US", { month: "long", year: "numeric" }),
              accent: "border-amber-500/30 bg-amber-500/5",
            },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl border px-6 py-5 ${card.accent}`}>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {card.label}
              </p>
              <p className="mt-2 text-3xl font-bold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings per affiliate */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Earnings per Affiliate
        </h2>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/50">
                {["Program", "Commission", "Total Earnings", "Description"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.earningsByAffiliate.map((row) => {
                const aff = data.affiliates.find((a) => a.id === row.affiliateId);
                return (
                  <tr
                    key={row.affiliateId}
                    className="bg-gray-900/30 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-white">{row.affiliateName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                        {row.commissionRatePct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {row.totalEarningsCents > 0 ? (
                        formatThb(row.totalEarningsCents)
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs">
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Affiliate Links
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.links.map((link) => {
            const aff = data.affiliates.find((a) => a.id === link.affiliateId);
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-gray-900/40 px-4 py-3"
              >
                <span className="text-lg" title={link.platform}>
                  {platformIcons[link.platform]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {aff?.name ?? link.affiliateId}
                  </p>
                  <p className="truncate text-xs text-gray-500">{link.url}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Payout tracking */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Payout Tracking
        </h2>
        <div className="space-y-4">
          {Object.entries(payoutsByMonth)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([month, payouts]) => {
              const monthTotal = payouts.reduce((s, p) => s + p.amountCents, 0);
              return (
                <div key={month} className="overflow-hidden rounded-xl border border-white/10">
                  <div className="flex items-center justify-between border-b border-white/10 bg-gray-800/50 px-4 py-2">
                    <span className="text-sm font-semibold text-white">
                      {new Date(`${month}-01`).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatThb(monthTotal)}
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {payouts.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-gray-900/30 px-4 py-2"
                      >
                        <span className="text-sm text-gray-300">{p.affiliateName}</span>
                        <span className="text-sm font-medium text-white">
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
            <p className="text-sm text-gray-400">
              Total paid out:{" "}
              <span className="font-bold text-white">{formatThb(allTimeTotal)}</span>
            </p>
          </div>
        )}
      </section>

      {/* Content pipeline */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
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
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400">
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
                        className="rounded-lg border border-white/10 bg-gray-800/60 px-3 py-2"
                      >
                        <p className="text-xs font-medium text-white leading-snug">{item.title}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs" title={item.platform}>
                            {platformIcons[item.platform]}
                          </span>
                          {aff && (
                            <span className="truncate rounded-sm bg-white/5 px-1 text-xs text-gray-500">
                              {aff.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="py-4 text-center text-xs text-gray-600">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Platform breakdown */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Platform Breakdown
        </h2>
        <div className="flex flex-wrap gap-3">
          {(["tiktok", "youtube", "instagram", "facebook", "x", "linkedin"] as Platform[]).map(
            (platform) => {
              const count = data.pipeline.filter((c) => c.platform === platform).length;
              return (
                <div
                  key={platform}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-gray-900/40 px-4 py-2"
                >
                  <span className="text-base">{platformIcons[platform]}</span>
                  <span className="text-sm font-medium capitalize text-white">
                    {platform === "x"
                      ? "X (Twitter)"
                      : platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-400">
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
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Contacts Management
        </h2>
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-gray-800/50">
                {["Name", "Email", "Program", "Status", "Notes"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.contacts.map((contact) => {
                const aff = contact.affiliateId
                  ? data.affiliates.find((a) => a.id === contact.affiliateId)
                  : null;
                return (
                  <tr
                    key={contact.id}
                    className="bg-gray-900/30 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-white">{contact.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{contact.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {aff?.name ?? <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${contactStatusStyles[contact.status]}`}
                      >
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                      {contact.notes ?? <span className="text-gray-600">—</span>}
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
