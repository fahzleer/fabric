import { createMerchantApi } from "@/lib/merchant-api";
import { isErr, isSome } from "@fabric/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@fabric/ui";
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
  draft: "border-border bg-card/40 text-muted-foreground",
  creating: "border-info/40 bg-info/30 text-info",
  editing: "border-info/40 bg-info/30 text-info",
  ready_to_post: "border-warning/40 bg-warning/30 text-warning",
  published: "border-success/40 bg-success/30 text-success",
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
  pending: "bg-muted text-muted-foreground",
  contacted: "bg-info/20 text-info",
  responded: "bg-warning/20 text-warning",
  converted: "bg-success/20 text-success",
};

function formatThb(cents: number) {
  return `฿${(cents / 100).toLocaleString("th-TH", { minimumFractionDigits: 0 })}`;
}

export default async function MerchantAffiliatesPage() {
  await connection();

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return <p className="text-muted-foreground">Unable to load data. Please refresh.</p>;
  }

  const result = await maybeApi.value.getMerchantAffiliates();
  if (isErr(result)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Affiliate Marketing</h1>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
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
        <h1 className="text-2xl font-bold text-foreground">Affiliate Marketing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings · Links · Content pipeline · Contacts
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="links">Links</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8">
          {/* Summary */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
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
                <div key={card.label} className={`rounded-xl border px-5 py-4 ${card.accent}`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Earnings per affiliate */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Earnings per Program
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
                        <td className="px-4 py-3 font-medium text-foreground">
                          {row.affiliateName}
                        </td>
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
        </TabsContent>

        <TabsContent value="links" className="space-y-8">
          {/* Links */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Affiliate Links
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.links.map((link) => {
                const aff = data.affiliates.find((a) => a.id === link.affiliateId);
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3"
                  >
                    <span className="text-lg">{PLATFORM_ICONS[link.platform] ?? "🔗"}</span>
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
        </TabsContent>

        <TabsContent value="payouts" className="space-y-8">
          {/* Payouts */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payout Tracking
            </h2>
            <div className="space-y-3">
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
                        <span className="text-sm font-bold text-success">
                          {formatThb(monthTotal)}
                        </span>
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
              <p className="mt-3 text-right text-sm text-muted-foreground">
                Total paid out:{" "}
                <span className="font-bold text-foreground">{formatThb(allTimeTotal)}</span>
              </p>
            )}
          </section>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-8">
          {/* Content Pipeline */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                            <div className="mt-1 flex items-center gap-1">
                              <span className="text-xs">
                                {PLATFORM_ICONS[item.platform] ?? "🔗"}
                              </span>
                              {aff && (
                                <span className="truncate rounded bg-muted px-1 text-xs text-muted-foreground">
                                  {aff.name}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {items.length === 0 && (
                        <p className="py-3 text-center text-xs text-muted-foreground">empty</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-8">
          {/* Contacts */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contacts
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
                  {data.contacts.map((c) => {
                    const aff = c.affiliateId
                      ? data.affiliates.find((a) => a.id === c.affiliateId)
                      : null;
                    return (
                      <tr key={c.id} className="bg-card/30 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {c.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {aff?.name ?? <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${CONTACT_STATUS_STYLES[c.status] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                          {c.notes ?? <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
