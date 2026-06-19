import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Affiliates — Merchant Portal" };

const PIPELINE_COLUMNS = ["draft", "creating", "editing", "ready_to_post", "published"] as const;
type PipelineStatus = (typeof PIPELINE_COLUMNS)[number];
const PIPELINE_LABELS: Record<PipelineStatus, string> = {
  draft: "In Draft",
  creating: "Creating",
  editing: "Editing",
  ready_to_post: "Ready to Post",
  published: "Published",
};
const PIPELINE_STYLES: Record<PipelineStatus, string> = {
  draft: "border-gray-700 bg-gray-900/40 text-gray-400",
  creating: "border-blue-700/40 bg-blue-950/30 text-blue-400",
  editing: "border-violet-700/40 bg-violet-950/30 text-violet-400",
  ready_to_post: "border-amber-700/40 bg-amber-950/30 text-amber-400",
  published: "border-emerald-700/40 bg-emerald-950/30 text-emerald-400",
};
const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "🎵",
  youtube: "▶",
  instagram: "📷",
  facebook: "𝒇",
  x: "𝕏",
  linkedin: "in",
};
const CONTACT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400",
  contacted: "bg-blue-500/20 text-blue-300",
  responded: "bg-amber-500/20 text-amber-300",
  converted: "bg-emerald-500/20 text-emerald-300",
};

function formatThb(cents: number) {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export default async function MerchantAffiliatesPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return <p className="text-gray-400">Unable to load data. Please refresh.</p>;
  }

  const result = await maybeApi.value.getMerchantAffiliates();
  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Affiliate Marketing</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {result.error}
        </div>
      </div>
    );
  }

  const data = result.value;
  const pipelineByStatus = Object.fromEntries(
    PIPELINE_COLUMNS.map((col) => [col, data.pipeline.filter((c) => c.status === col)])
  ) as Record<PipelineStatus, typeof data.pipeline>;

  const payoutsByMonth = data.payouts.reduce<Record<string, typeof data.payouts>>((acc, p) => {
    const bucket = acc[p.month] ?? [];
    bucket.push(p);
    acc[p.month] = bucket;
    return acc;
  }, {});

  const allTimeTotal = data.payouts.reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Affiliate Marketing</h1>
        <p className="mt-1 text-sm text-gray-400">Earnings · Links · Content pipeline · Contacts</p>
      </div>

      {/* Summary */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Summary
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
            <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-white">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings per affiliate */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Earnings per Program
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

      {/* Links */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Affiliate Links
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.links.map((link) => {
            const aff = data.affiliates.find((a) => a.id === link.affiliateId);
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-gray-900/40 px-4 py-3"
              >
                <span className="text-lg">{PLATFORM_ICONS[link.platform] ?? "🔗"}</span>
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

      {/* Payouts */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Payout Tracking
        </h2>
        <div className="space-y-3">
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
          <p className="mt-3 text-right text-sm text-gray-400">
            Total paid out: <span className="font-bold text-white">{formatThb(allTimeTotal)}</span>
          </p>
        )}
      </section>

      {/* Content Pipeline */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Content Pipeline
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_COLUMNS.map((col) => {
            const items = pipelineByStatus[col] ?? [];
            const style = PIPELINE_STYLES[col];
            return (
              <div key={col} className={`rounded-xl border p-3 ${style}`}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider">
                    {PIPELINE_LABELS[col]}
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
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-xs">{PLATFORM_ICONS[item.platform] ?? "🔗"}</span>
                          {aff && (
                            <span className="truncate rounded bg-white/5 px-1 text-xs text-gray-500">
                              {aff.name}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <p className="py-3 text-center text-xs text-gray-600">empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contacts */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Contacts
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
              {data.contacts.map((c) => {
                const aff = c.affiliateId
                  ? data.affiliates.find((a) => a.id === c.affiliateId)
                  : null;
                return (
                  <tr key={c.id} className="bg-gray-900/30 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {aff?.name ?? <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTACT_STATUS_STYLES[c.status] ?? "bg-gray-500/20 text-gray-400"}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
                      {c.notes ?? <span className="text-gray-600">—</span>}
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
