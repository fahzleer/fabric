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
import type { Database } from "firebase-admin/database";
import { firebaseQuery } from "../../shared/abort/abort-context";

export type AffiliateData = {
  affiliates: Affiliate[];
  links: AffiliateLink[];
  earnings: AffiliateEarning[];
  payouts: AffiliatePayout[];
  pipeline: ContentPipelineItem[];
  contacts: AffiliateContact[];
};

const SEED: AffiliateData = {
  affiliates: [
    {
      id: "aff-1",
      name: "1M Club",
      commissionRatePct: 50,
      description: "Content creation and post-scheduling tools for creators.",
      isActive: true,
      createdAt: "2023-01-01",
    },
    {
      id: "aff-2",
      name: "Late Advantage",
      commissionRatePct: 30,
      description: "Trading and business management toolkit.",
      isActive: true,
      createdAt: "2023-01-01",
    },
    {
      id: "aff-3",
      name: "Notion",
      commissionRatePct: 50,
      description: "All-in-one workspace for notes, projects, and wikis.",
      isActive: true,
      createdAt: "2023-02-01",
    },
    {
      id: "aff-4",
      name: "Typdream",
      commissionRatePct: 50,
      description: "No-code website builder for creators and entrepreneurs.",
      isActive: true,
      createdAt: "2023-02-01",
    },
    {
      id: "aff-5",
      name: "Senla",
      commissionRatePct: 50,
      description: "Email marketing and automation platform.",
      isActive: true,
      createdAt: "2023-03-01",
    },
    {
      id: "aff-6",
      name: "Hyperlay",
      commissionRatePct: 50,
      description: "Productivity suite for teams and freelancers.",
      isActive: true,
      createdAt: "2023-03-01",
    },
    {
      id: "aff-7",
      name: "Mailvite",
      commissionRatePct: 50,
      description: "Email newsletter and event invitation platform.",
      isActive: true,
      createdAt: "2023-04-01",
    },
  ],
  links: [
    {
      id: "lnk-1",
      affiliateId: "aff-1",
      platform: "youtube" as Platform,
      url: "https://1mclub.io/ref/fabric",
      createdAt: "2023-01-15",
    },
    {
      id: "lnk-2",
      affiliateId: "aff-1",
      platform: "tiktok" as Platform,
      url: "https://1mclub.io/ref/fabric-tt",
      createdAt: "2023-01-15",
    },
    {
      id: "lnk-3",
      affiliateId: "aff-2",
      platform: "youtube" as Platform,
      url: "https://lateadvantage.com/r/fabric",
      createdAt: "2023-02-01",
    },
    {
      id: "lnk-4",
      affiliateId: "aff-2",
      platform: "instagram" as Platform,
      url: "https://lateadvantage.com/r/fab-ig",
      createdAt: "2023-02-01",
    },
    {
      id: "lnk-5",
      affiliateId: "aff-3",
      platform: "youtube" as Platform,
      url: "https://notion.so/fabric",
      createdAt: "2023-02-15",
    },
    {
      id: "lnk-6",
      affiliateId: "aff-4",
      platform: "tiktok" as Platform,
      url: "https://typdream.com/r/fabric",
      createdAt: "2023-03-01",
    },
    {
      id: "lnk-7",
      affiliateId: "aff-5",
      platform: "youtube" as Platform,
      url: "https://senla.io/ref/fabric",
      createdAt: "2023-03-15",
    },
    {
      id: "lnk-8",
      affiliateId: "aff-6",
      platform: "linkedin" as Platform,
      url: "https://hyperlay.com/ref/fabric",
      createdAt: "2023-04-01",
    },
    {
      id: "lnk-9",
      affiliateId: "aff-7",
      platform: "facebook" as Platform,
      url: "https://mailvite.com/r/fabric",
      createdAt: "2023-04-15",
    },
  ],
  earnings: [
    {
      id: "earn-1",
      affiliateId: "aff-1",
      month: "2023-09",
      amountCents: 150000,
      currency: "THB",
      recordedAt: "2023-09-30",
    },
    {
      id: "earn-2",
      affiliateId: "aff-2",
      month: "2023-09",
      amountCents: 200000,
      currency: "THB",
      recordedAt: "2023-09-30",
    },
    {
      id: "earn-3",
      affiliateId: "aff-3",
      month: "2023-09",
      amountCents: 50000,
      currency: "THB",
      recordedAt: "2023-09-30",
    },
    {
      id: "earn-4",
      affiliateId: "aff-4",
      month: "2023-09",
      amountCents: 150000,
      currency: "THB",
      recordedAt: "2023-09-30",
    },
    {
      id: "earn-5",
      affiliateId: "aff-5",
      month: "2023-10",
      amountCents: 51800,
      currency: "THB",
      recordedAt: "2023-10-31",
    },
    {
      id: "earn-6",
      affiliateId: "aff-1",
      month: "2023-10",
      amountCents: 63600,
      currency: "THB",
      recordedAt: "2023-10-31",
    },
  ],
  payouts: [
    {
      id: "pay-1",
      affiliateId: "aff-1",
      month: "2023-09",
      amountCents: 150000,
      currency: "THB",
      paidAt: "2023-09-30",
    },
    {
      id: "pay-2",
      affiliateId: "aff-5",
      month: "2023-09",
      amountCents: 92300,
      currency: "THB",
      paidAt: "2023-09-30",
    },
    {
      id: "pay-3",
      affiliateId: "aff-2",
      month: "2023-09",
      amountCents: 300000,
      currency: "THB",
      paidAt: "2023-09-30",
    },
    {
      id: "pay-4",
      affiliateId: "aff-3",
      month: "2023-09",
      amountCents: 233500,
      currency: "THB",
      paidAt: "2023-09-30",
    },
    {
      id: "pay-5",
      affiliateId: "aff-5",
      month: "2023-10",
      amountCents: 51800,
      currency: "THB",
      paidAt: "2023-10-31",
    },
  ],
  pipeline: [
    {
      id: "c-01",
      affiliateId: "aff-1",
      title: "1M Club Review",
      platform: "youtube" as Platform,
      status: "draft" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-01",
      updatedAt: "2023-10-01",
    },
    {
      id: "c-02",
      affiliateId: null,
      title: "Video Template",
      platform: "tiktok" as Platform,
      status: "draft" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-02",
      updatedAt: "2023-10-02",
    },
    {
      id: "c-03",
      affiliateId: null,
      title: "Patalaz Fam by NFG",
      platform: "instagram" as Platform,
      status: "draft" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-03",
      updatedAt: "2023-10-03",
    },
    {
      id: "c-04",
      affiliateId: null,
      title: "Metta Pyramid Template",
      platform: "youtube" as Platform,
      status: "creating" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-04",
      updatedAt: "2023-10-05",
    },
    {
      id: "c-05",
      affiliateId: null,
      title: "Patalaz Fam by NFG",
      platform: "tiktok" as Platform,
      status: "creating" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-05",
      updatedAt: "2023-10-06",
    },
    {
      id: "c-06",
      affiliateId: null,
      title: "Empty Template",
      platform: "youtube" as Platform,
      status: "editing" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-01",
      updatedAt: "2023-10-07",
    },
    {
      id: "c-07",
      affiliateId: null,
      title: "Standard Template",
      platform: "tiktok" as Platform,
      status: "editing" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-01",
      updatedAt: "2023-10-07",
    },
    {
      id: "c-08",
      affiliateId: null,
      title: "Metta Pyramid Template",
      platform: "instagram" as Platform,
      status: "editing" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-04",
      updatedAt: "2023-10-08",
    },
    {
      id: "c-09",
      affiliateId: "aff-4",
      title: "Typdream Walkthrough",
      platform: "youtube" as Platform,
      status: "editing" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: null,
      createdAt: "2023-10-06",
      updatedAt: "2023-10-09",
    },
    {
      id: "c-10",
      affiliateId: null,
      title: "Standard Template",
      platform: "youtube" as Platform,
      status: "ready_to_post" as ContentPipelineStatus,
      scheduledAt: "2023-11-01",
      publishedAt: null,
      createdAt: "2023-10-01",
      updatedAt: "2023-10-10",
    },
    {
      id: "c-11",
      affiliateId: "aff-2",
      title: "Late Advantage Tutorial",
      platform: "youtube" as Platform,
      status: "ready_to_post" as ContentPipelineStatus,
      scheduledAt: "2023-11-03",
      publishedAt: null,
      createdAt: "2023-10-02",
      updatedAt: "2023-10-10",
    },
    {
      id: "c-12",
      affiliateId: null,
      title: "Patalaz Fam by NFG",
      platform: "facebook" as Platform,
      status: "ready_to_post" as ContentPipelineStatus,
      scheduledAt: "2023-11-05",
      publishedAt: null,
      createdAt: "2023-10-03",
      updatedAt: "2023-10-11",
    },
    {
      id: "c-13",
      affiliateId: "aff-5",
      title: "Senla Email Marketing Tips",
      platform: "linkedin" as Platform,
      status: "ready_to_post" as ContentPipelineStatus,
      scheduledAt: "2023-11-06",
      publishedAt: null,
      createdAt: "2023-10-04",
      updatedAt: "2023-10-11",
    },
    {
      id: "c-14",
      affiliateId: "aff-1",
      title: "1M Club Unboxing",
      platform: "youtube" as Platform,
      status: "published" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: "2023-09-15",
      createdAt: "2023-09-01",
      updatedAt: "2023-09-15",
    },
    {
      id: "c-15",
      affiliateId: "aff-3",
      title: "Notion for Creators",
      platform: "tiktok" as Platform,
      status: "published" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: "2023-09-20",
      createdAt: "2023-09-05",
      updatedAt: "2023-09-20",
    },
    {
      id: "c-16",
      affiliateId: "aff-2",
      title: "Late Advantage: 30d Results",
      platform: "youtube" as Platform,
      status: "published" as ContentPipelineStatus,
      scheduledAt: null,
      publishedAt: "2023-10-01",
      createdAt: "2023-09-10",
      updatedAt: "2023-10-01",
    },
  ],
  contacts: [
    {
      id: "con-1",
      affiliateId: "aff-1",
      name: "Aacxilia",
      email: "aacxilia@example.com",
      status: "contacted" as ContactStatus,
      notes: "Interested in 1M Club co-promo",
      createdAt: "2023-09-01",
    },
    {
      id: "con-2",
      affiliateId: "aff-2",
      name: "Atiyah",
      email: "atiyah@example.com",
      status: "responded" as ContactStatus,
      notes: "Awaiting content brief approval",
      createdAt: "2023-09-05",
    },
    {
      id: "con-3",
      affiliateId: "aff-3",
      name: "Gonzales Isabella",
      email: "isabella@example.com",
      status: "contacted" as ContactStatus,
      notes: "Notion campus ambassador lead",
      createdAt: "2023-09-08",
    },
    {
      id: "con-4",
      affiliateId: "aff-5",
      name: "Kikoro Vince",
      email: "vince@example.com",
      status: "converted" as ContactStatus,
      notes: "Signed Senla partnership deal",
      createdAt: "2023-08-20",
    },
    {
      id: "con-5",
      affiliateId: "aff-4",
      name: "Reyes Lucas",
      email: "lucas@example.com",
      status: "pending" as ContactStatus,
      notes: null,
      createdAt: "2023-10-01",
    },
    {
      id: "con-6",
      affiliateId: "aff-4",
      name: "Reyes Sofia",
      email: "sofia@example.com",
      status: "contacted" as ContactStatus,
      notes: "Typdream brand fit review",
      createdAt: "2023-10-02",
    },
  ],
};

function listToRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function recordToList<T>(rec: Record<string, T> | null | undefined): T[] {
  if (!rec) return [];
  return Object.values(rec);
}

export class FirebaseAffiliateRepository {
  constructor(private readonly db: Database) {}

  async getData(): Promise<AffiliateData> {
    try {
      const snap = await firebaseQuery(this.db.ref("affiliate_data").once("value"));

      if (!snap.exists()) {
        await this.seed();
        return SEED;
      }

      const raw = snap.val() as {
        affiliates?: Record<string, Affiliate>;
        links?: Record<string, AffiliateLink>;
        earnings?: Record<string, AffiliateEarning>;
        payouts?: Record<string, AffiliatePayout>;
        pipeline?: Record<string, ContentPipelineItem>;
        contacts?: Record<string, AffiliateContact>;
      };

      return {
        affiliates: recordToList(raw.affiliates),
        links: recordToList(raw.links),
        earnings: recordToList(raw.earnings),
        payouts: recordToList(raw.payouts),
        pipeline: recordToList(raw.pipeline),
        contacts: recordToList(raw.contacts),
      };
    } catch {
      return SEED;
    }
  }

  private async seed(): Promise<void> {
    await this.db.ref("affiliate_data").set({
      affiliates: listToRecord(SEED.affiliates),
      links: listToRecord(SEED.links),
      earnings: listToRecord(SEED.earnings),
      payouts: listToRecord(SEED.payouts),
      pipeline: listToRecord(SEED.pipeline),
      contacts: listToRecord(SEED.contacts),
    });
  }
}
