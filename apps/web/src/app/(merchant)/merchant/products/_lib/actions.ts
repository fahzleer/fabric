"use server";

import { validateCsrfOrigin } from "@/lib/csrf";
import { CONTENT_RULES, DEFAULT_GUARDRAILS, maxLength } from "@/lib/guardrail";
import { createMerchantApi } from "@/lib/merchant-api";
import { typhoonChat } from "@/lib/typhoon";
import { Err, Ok, type Result, isErr, isSome } from "@fabric/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Server-side cost guard for the Typhoon actions.
 *
 * Typhoon's free tier is rate-limited (HTTP 429). Without a guard, a merchant
 * who double-clicks "เขียนด้วย AI" on both the description and the tagline in
 * quick succession would fire two LLM calls within ~200ms and trip the limit.
 * The bucket permits 1 call per action per 3 seconds, scoped to the current
 * process. State is in-memory (resets on dev restart) — that is intentional.
 * Per-merchant accounting, if needed later, belongs in RTDB, not here.
 */
type Bucket = { last: number };
const buckets = new Map<string, Bucket>();
const RATE_LIMIT_MS = 3_000;

function allowLlmCall(actionKey: string): boolean {
  const now = Date.now();
  const entry = buckets.get(actionKey);
  if (entry && now - entry.last < RATE_LIMIT_MS) {
    return false;
  }
  buckets.set(actionKey, { last: now });
  return true;
}

function parseStock(formData: FormData): Record<string, number> {
  const stock: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^stock\[(\w+)\]$/.exec(key);
    if (match?.[1]) {
      const qty = Number.parseInt(value as string, 10);
      if (!Number.isNaN(qty) && qty > 0) stock[match[1]] = qty;
    }
  }
  return stock;
}

function parseImages(formData: FormData) {
  const raw = String(formData.get("images") ?? "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as { url: string; alt: string; isPrimary: boolean; order: number }[];
  } catch {
    return [];
  }
}

function mapCreateProductError(error: string): string {
  if (error.includes("SubscriptionInactive"))
    return "Your plan is inactive. Please activate billing first.";
  if (error.includes("PlanLimitExceeded"))
    return "Product limit reached. Please upgrade your plan.";
  if (error.includes("MerchantNotFound"))
    return "Merchant profile not found. Please complete onboarding.";
  return error;
}

type UpdatePayload = {
  name?: string;
  description?: string;
  tagline?: string;
  price?: number;
  priceCurrency?: string;
  category?: string;
  genre?: string;
  status?: string;
  stock?: Record<string, number>;
  images?: { url: string; alt: string; isPrimary: boolean; order: number }[];
};

function buildUpdatePayload(fields: {
  name: string | undefined;
  description: string | undefined;
  tagline: string | undefined;
  price: number | undefined;
  currency: string | undefined;
  category: string | undefined;
  genre: string | undefined;
  status: string | undefined;
  stock: Record<string, number>;
  images: { url: string; alt: string; isPrimary: boolean; order: number }[];
}): UpdatePayload {
  const payload: UpdatePayload = {};
  if (fields.name) payload.name = fields.name;
  if (fields.description !== undefined) payload.description = fields.description;
  if (fields.tagline !== undefined) payload.tagline = fields.tagline;
  if (fields.price) payload.price = fields.price;
  if (fields.currency) payload.priceCurrency = fields.currency;
  if (fields.category) payload.category = fields.category;
  if (fields.genre) payload.genre = fields.genre;
  if (fields.status) payload.status = fields.status;
  if (Object.keys(fields.stock).length > 0) payload.stock = fields.stock;
  if (fields.images.length > 0) payload.images = fields.images;
  return payload;
}

const CATEGORY_LABELS: Record<string, string> = {
  basic: "เสื้อผ้าพื้นฐาน",
  premium: "สินค้าพรีเมียม",
  limited_edition: "รุ่นลิมิเต็ด (ผลิตจำนวนจำกัด)",
  custom: "สินค้าสั่งทำพิเศษ",
};

export type GenerateDescriptionResult = Result<string, string>;

/**
 * AI-assisted product description (Typhoon, Thai-first).
 * Merchant-triggered, returns a draft for the merchant to review and edit before
 * saving — the generated text never reaches a customer unreviewed.
 */
export async function generateProductDescriptionAction(input: {
  name: string;
  category: string;
  price: number;
  currency: string;
}): Promise<GenerateDescriptionResult> {
  try {
    await validateCsrfOrigin();
  } catch {
    return Err("คำขอไม่ถูกต้อง");
  }

  if (!allowLlmCall("description")) {
    return Err("กดถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const name = input.name.trim();
  if (!name) return Err("กรุณากรอกชื่อสินค้าก่อน");

  const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
  const priceText =
    Number.isFinite(input.price) && input.price > 0
      ? `${input.price.toLocaleString("th-TH")} ${input.currency}`
      : "ไม่ระบุ";

  return typhoonChat(
    [
      {
        role: "system",
        content: `บทบาท: นักเขียนคำโฆษณาสินค้าแฟชั่น
ผลลัพธ์: คำบรรยายภาษาไทย 2 ประโยค เน้นจุดเด่นและอารมณ์ของสินค้า
ห้าม: ราคา, bullet, emoji, เครื่องหมายคำพูดนำ, คำนำ, หัวข้อ`,
      },
      {
        role: "user",
        content: `ชื่อสินค้า: ${name}\nหมวดหมู่: ${categoryLabel}\nราคา: ${priceText}\n\nเขียนคำบรรยายสินค้าชิ้นนี้`,
      },
    ],
    {
      temperature: 0.8,
      maxTokens: 300,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noBulletPoints,
        CONTENT_RULES.noLeadingQuote,
        maxLength(350),
      ],
    }
  );
}

export type GenerateAltTextResult = Result<string, string>;

/**
 * AI-assisted image alt text (Typhoon, Thai-first). Improves accessibility and SEO
 * for product images. Merchant-triggered, returned as a draft for the merchant to
 * review and edit before saving.
 */
export async function generateImageAltTextAction(input: {
  name: string;
  category: string;
}): Promise<GenerateAltTextResult> {
  try {
    await validateCsrfOrigin();
  } catch {
    return Err("คำขอไม่ถูกต้อง");
  }

  if (!allowLlmCall("altText")) {
    return Err("กดถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const name = input.name.trim();
  if (!name) return Err("กรุณากรอกชื่อสินค้าก่อน");

  const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;

  return typhoonChat(
    [
      {
        role: "system",
        content: `บทบาท: ผู้เชี่ยวชาญ SEO และ accessibility
ผลลัพธ์: alt text ภาษาไทย 1 ประโยค ไม่เกิน 80 ตัวอักษร บรรยายลักษณะสินค้าในภาพ
ห้าม: ขึ้นต้นด้วย "รูป" หรือ "ภาพ", ราคา, emoji`,
      },
      {
        role: "user",
        content: `ชื่อสินค้า: ${name}\nหมวดหมู่: ${categoryLabel}\n\nเขียน alt text สำหรับรูปสินค้านี้`,
      },
    ],
    {
      temperature: 0.6,
      maxTokens: 100,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noLeadingQuote,
        maxLength(100),
      ],
    }
  );
}

export type GenerateTaglineResult = Result<string, string>;

export type GenerateContentResult = Result<
  { tagline: string; description: string; altText: string },
  string
>;

/**
 * AI-assisted product content bundle (Typhoon, Thai-first).
 *
 * Generates the tagline, description, and image alt text in a single LLM call
 * instead of three separate round-trips. This is the fastest path for merchants
 * who want a complete draft in one click.
 *
 * Response is parsed from a structured format:
 *   TAGLINE: ...
 *   DESCRIPTION: ...
 *   ALT_TEXT: ...
 */
export async function generateProductContentAction(input: {
  name: string;
  category: string;
  price: number;
  currency: string;
}): Promise<GenerateContentResult> {
  try {
    await validateCsrfOrigin();
  } catch {
    return Err("คำขอไม่ถูกต้อง");
  }

  if (!allowLlmCall("content")) {
    return Err("กดถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const name = input.name.trim();
  if (!name) return Err("กรุณากรอกชื่อสินค้าก่อน");

  const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
  const priceText =
    Number.isFinite(input.price) && input.price > 0
      ? `${input.price.toLocaleString("th-TH")} ${input.currency}`
      : "ไม่ระบุ";

  const result = await typhoonChat(
    [
      {
        role: "system",
        content: `บทบาท: นักเขียนคำโฆษณาสินค้าแฟชั่น
ผลลัพธ์: ตอบในรูปแบบนี้เท่านั้น

TAGLINE: [1 ประโยค ไม่เกิน 80 ตัวอักษร เน้นอารมณ์ของสินค้า]
DESCRIPTION: [2 ประโยค กระชับ ชวนซื้อ เน้นจุดเด่น]
ALT_TEXT: [1 ประโยค ไม่เกิน 80 ตัวอักษร บรรยายลักษณะในภาพ]

ห้าม: ราคา, bullet, emoji, เครื่องหมายคำพูดนำ, หัวข้อเพิ่มเติม`,
      },
      {
        role: "user",
        content: `ชื่อสินค้า: ${name}\nหมวดหมู่: ${categoryLabel}\nราคา: ${priceText}\n\nเขียนเนื้อหาสินค้าชิ้นนี้ทั้งหมด`,
      },
    ],
    {
      temperature: 0.75,
      maxTokens: 400,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noBulletPoints,
        CONTENT_RULES.noLeadingQuote,
        maxLength(500),
      ],
    }
  );

  if (isErr(result)) return result;

  function extractSection(text: string, label: string): string {
    const regex = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z_]+:|$)`, "i");
    return text.match(regex)?.[1]?.trim() ?? "";
  }

  const tagline = extractSection(result.value, "TAGLINE");
  const description = extractSection(result.value, "DESCRIPTION");
  const altText = extractSection(result.value, "ALT_TEXT");

  if ([tagline, description, altText].every((s) => !s)) {
    return Err("AI ส่งรูปแบบข้อความไม่ถูกต้อง ลองใหม่อีกครั้ง");
  }

  return Ok({ tagline, description, altText });
}

/**
 * AI-assisted product tagline (Typhoon, Thai-first). One short sentence shown
 * under the product name on storefront cards and the product detail page.
 *
 * Same trust model as the description generator: merchant-triggered, returns a
 * draft for the merchant to review and edit, never auto-saves, never reaches
 * a customer unreviewed.
 *
 * Tagline constraints (enforced in the system prompt + by the temperature):
 *   - Thai only
 *   - ≤ 80 chars (storefront card uses line-clamp-1)
 *   - No price numbers, no bullet points, no emoji
 *   - No leading quote marks
 */
export async function generateProductTaglineAction(input: {
  name: string;
  category: string;
  description?: string;
}): Promise<GenerateTaglineResult> {
  try {
    await validateCsrfOrigin();
  } catch {
    return Err("คำขอไม่ถูกต้อง");
  }

  if (!allowLlmCall("tagline")) {
    return Err("กดถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }

  const name = input.name.trim();
  if (!name) return Err("กรุณากรอกชื่อสินค้าก่อน");

  const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
  const descriptionHint = input.description?.trim()
    ? `\nคำบรรยายเดิม (ใช้เป็นแนวทาง ไม่ต้องคัดลอก): ${input.description.trim().slice(0, 200)}`
    : "";

  return typhoonChat(
    [
      {
        role: "system",
        content: `บทบาท: นักเขียนคำโฆษณาสินค้าแฟชั่น
ผลลัพธ์: tagline ภาษาไทย 1 ประโยค ไม่เกิน 80 ตัวอักษร เน้นอารมณ์ของสินค้า
ห้าม: ราคา, bullet, emoji, เครื่องหมายคำพูดนำ, คำนำ, หัวข้อ`,
      },
      {
        role: "user",
        content: `ชื่อสินค้า: ${name}\nหมวดหมู่: ${categoryLabel}${descriptionHint}\n\nเขียน tagline สั้นๆ สำหรับสินค้าชิ้นนี้`,
      },
    ],
    {
      temperature: 0.7,
      maxTokens: 120,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noBulletPoints,
        CONTENT_RULES.noLeadingQuote,
        maxLength(80),
      ],
    }
  );
}

const VALID_GENRES = new Set(["emo", "deathcore", "punk", "metal", "hardcore"]);

function parseProductFormFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "0");
  const currency = String(formData.get("priceCurrency") ?? "THB").trim() || "THB";
  const category = String(formData.get("category") ?? "basic").trim();
  const genreRaw = String(formData.get("genre") ?? "").trim();
  const genre = VALID_GENRES.has(genreRaw) ? genreRaw : undefined;
  const stock = parseStock(formData);
  const images = parseImages(formData);
  const price = Number.parseFloat(priceStr);
  return { name, description, tagline, price, currency, category, genre, stock, images };
}

function placeholderImages(name: string) {
  return [{ url: "https://placehold.co/400x400", alt: name, isPrimary: true, order: 0 }];
}

export async function createProductAction(formData: FormData) {
  await validateCsrfOrigin();

  const { name, description, tagline, price, currency, category, genre, stock, images } =
    parseProductFormFields(formData);

  if (!name || price <= 0 || Number.isNaN(price)) {
    redirect(`/merchant/products/new?error=${encodeURIComponent("Name and price are required.")}`);
  }

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/products/new?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.createProduct({
    name,
    ...(description ? { description } : {}),
    ...(tagline ? { tagline } : {}),
    price,
    ...(currency !== "THB" ? { priceCurrency: currency } : {}),
    category,
    ...(genre ? { genre } : {}),
    stock,
    images: images.length > 0 ? images : placeholderImages(name),
  });

  if (isErr(result)) {
    const msg = mapCreateProductError(result.error);
    redirect(`/merchant/products/new?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/merchant/products");
  redirect("/merchant/products?success=Product+created");
}

function parseUpdateFormFields(formData: FormData) {
  const priceStr = formData.get("price");
  const genreRaw = String(formData.get("genre") ?? "").trim();
  return buildUpdatePayload({
    name: String(formData.get("name") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    tagline: String(formData.get("tagline") ?? "").trim() || undefined,
    price: priceStr ? Number.parseFloat(String(priceStr)) : undefined,
    currency: String(formData.get("priceCurrency") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? "").trim() || undefined,
    genre: VALID_GENRES.has(genreRaw) ? genreRaw : undefined,
    status: String(formData.get("status") ?? "").trim() || undefined,
    stock: parseStock(formData),
    images: parseImages(formData),
  });
}

export async function updateProductAction(productId: string, formData: FormData) {
  await validateCsrfOrigin();
  const payload = parseUpdateFormFields(formData);

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    redirect(
      `/merchant/products/${productId}/edit?error=${encodeURIComponent("Session expired. Please log in again.")}`
    );
  }
  const api = maybeApi.value;

  const result = await api.updateProduct(productId, payload);

  if (isErr(result)) {
    redirect(`/merchant/products/${productId}/edit?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/merchant/products");
  redirect("/merchant/products?success=Changes+saved");
}
