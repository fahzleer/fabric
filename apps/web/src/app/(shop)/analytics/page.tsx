import type { Metadata } from "next";
import { ABTestCalculator } from "./_components/ab-test-calculator";
import { AttributionModeler } from "./_components/attribution-modeler";
import { ChurnDashboard } from "./_components/churn-dashboard";
import { CLVAnalyzer } from "./_components/clv-analyzer";
import { CohortGrid } from "./_components/cohort-grid";
import { FunnelAnalyzer } from "./_components/funnel-analyzer";
import { MMMAnalyzer } from "./_components/mmm-analyzer";
import { PriceElasticityAnalyzer } from "./_components/price-elasticity-analyzer";
import { RFMSegmentation } from "./_components/rfm-segmentation";

export const metadata: Metadata = {
  title: "Marketing Analytics — Fabric",
  description:
    "Marketing Science platform: MMM, CLV, RFM, Churn, Attribution, Price Elasticity, Cohort, Funnel, A/B Test",
};

const TABS = [
  { id: "mmm", label: "Mix Model", group: "Demand" },
  { id: "elasticity", label: "Price", group: "Demand" },
  { id: "clv", label: "CLV", group: "Customer" },
  { id: "rfm", label: "RFM", group: "Customer" },
  { id: "churn", label: "Churn", group: "Customer" },
  { id: "cohort", label: "Cohort", group: "Customer" },
  { id: "attribution", label: "Attribution", group: "Channel" },
  { id: "funnel", label: "Funnel", group: "Channel" },
  { id: "ab", label: "A/B Test", group: "Channel" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VALID_TAB_IDS = new Set(TABS.map((t) => t.id));

function isValidTab(v: string | undefined): v is TabId {
  return VALID_TAB_IDS.has(v as TabId);
}

const TAB_DESCRIPTIONS: Record<TabId, string> = {
  mmm: "Decompose revenue by channel with Adstock + Hill saturation Ridge regression",
  elasticity: "Log-log OLS price elasticity of demand — find the revenue-maximising price",
  clv: "Predicted 12-month Customer Lifetime Value using simplified BG/NBD model",
  rfm: "Recency · Frequency · Monetary quintile scoring and automatic segment classification",
  churn: "Logistic churn-risk scoring — identify customers likely to stop buying",
  cohort: "Monthly purchase cohort retention matrix",
  attribution: "5 attribution models: Last-click, First-click, Linear, Time-decay, Shapley value",
  funnel: "Conversion funnel with per-stage drop-off analysis",
  ab: "Two-proportion chi-square A/B test with confidence interval and sample size guidance",
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: TabId = isValidTab(tab) ? tab : "mmm";

  const groups = Array.from(new Set(TABS.map((t) => t.group)));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Science</h1>
              <p className="mt-1 text-sm text-gray-500">
                TypeScript · scikit-learn (Python MMM) · statistical models · Celery async
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>

          {/* Description of active tab */}
          <p className="mt-3 text-sm text-info bg-info-subtle border border-info rounded-lg px-4 py-2">
            {TAB_DESCRIPTIONS[activeTab]}
          </p>

          {/* Grouped tabs */}
          <nav className="mt-4 space-y-1">
            {groups.map((group) => (
              <div key={group} className="flex flex-wrap items-center gap-1">
                <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {group}
                </span>
                {TABS.filter((t) => t.group === group).map(({ id, label }) => (
                  <a
                    key={id}
                    href={`/analytics?tab=${id}`}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === id
                        ? "bg-info text-white shadow-sm"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {activeTab === "mmm" && <MMMAnalyzer />}
        {activeTab === "ab" && <ABTestCalculator />}
        {activeTab === "clv" && <CLVAnalyzer />}
        {activeTab === "rfm" && <RFMSegmentation />}
        {activeTab === "churn" && <ChurnDashboard />}
        {activeTab === "attribution" && <AttributionModeler />}
        {activeTab === "elasticity" && <PriceElasticityAnalyzer />}
        {activeTab === "cohort" && <CohortGrid />}
        {activeTab === "funnel" && <FunnelAnalyzer />}
      </div>
    </div>
  );
}
