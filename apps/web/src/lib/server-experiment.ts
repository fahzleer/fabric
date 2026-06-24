import { cookies } from "next/headers";

export const TITLE_TAG_EXPERIMENT = "title_tag_products";
export const ANCHOR_TEXT_EXPERIMENT = "anchor_text_products";

const VARIANTS = {
  [TITLE_TAG_EXPERIMENT]: {
    control: "สินค้าทั้งหมด",
    variant: "ซื้อเสื้อ Premium คุณภาพดี ส่งทั่วไทย",
  },
  [ANCHOR_TEXT_EXPERIMENT]: {
    control: "descriptive",
    variant: "action",
  },
} as const;

type ExperimentId = keyof typeof VARIANTS;
type Variant = "control" | "variant";

export async function getServerVariant(experimentId: ExperimentId): Promise<Variant> {
  const store = await cookies();
  const value = store.get(`exp_${experimentId}`)?.value;
  return value === "variant" ? "variant" : "control";
}

export function getVariantTitle(experimentId: ExperimentId, variant: Variant): string {
  return VARIANTS[experimentId][variant];
}
