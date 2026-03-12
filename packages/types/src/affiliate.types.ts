export type ContentPipelineStatus =
  | "draft"
  | "creating"
  | "editing"
  | "ready_to_post"
  | "published";

export type Platform = "tiktok" | "youtube" | "instagram" | "facebook" | "x" | "linkedin";

export type ContactStatus = "pending" | "contacted" | "responded" | "converted";

export type Affiliate = {
  readonly id: string;
  readonly name: string;
  readonly commissionRatePct: number;
  readonly description: string;
  readonly isActive: boolean;
  readonly createdAt: string;
};

export type AffiliateLink = {
  readonly id: string;
  readonly affiliateId: string;
  readonly platform: Platform;
  readonly url: string;
  readonly createdAt: string;
};

export type AffiliateEarning = {
  readonly id: string;
  readonly affiliateId: string;
  readonly month: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly recordedAt: string;
};

export type AffiliatePayout = {
  readonly id: string;
  readonly affiliateId: string;
  readonly month: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly paidAt: string;
};

export type ContentPipelineItem = {
  readonly id: string;
  readonly affiliateId: string | null;
  readonly title: string;
  readonly platform: Platform;
  readonly status: ContentPipelineStatus;
  readonly scheduledAt: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AffiliateContact = {
  readonly id: string;
  readonly affiliateId: string | null;
  readonly name: string;
  readonly email: string | null;
  readonly status: ContactStatus;
  readonly notes: string | null;
  readonly createdAt: string;
};

export type AffiliateSummaryStats = {
  readonly allTimeRevenueCents: number;
  readonly thisYearRevenueCents: number;
  readonly thisMonthRevenueCents: number;
  readonly currency: string;
};

export type AffiliateEarningRow = {
  readonly affiliateId: string;
  readonly affiliateName: string;
  readonly commissionRatePct: number;
  readonly totalEarningsCents: number;
  readonly currency: string;
};

export type AffiliatePayoutRow = AffiliatePayout & {
  readonly affiliateName: string;
};

export const PIPELINE_COLUMNS: readonly ContentPipelineStatus[] = [
  "draft",
  "creating",
  "editing",
  "ready_to_post",
  "published",
];

export const PIPELINE_COLUMN_LABELS: Record<ContentPipelineStatus, string> = {
  draft: "In Draft",
  creating: "Creating",
  editing: "Editing",
  ready_to_post: "Ready to Post",
  published: "Published",
};
