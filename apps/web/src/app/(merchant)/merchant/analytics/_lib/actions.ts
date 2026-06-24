"use server";

import { CONTENT_RULES, DEFAULT_GUARDRAILS, maxLength } from "@/lib/guardrail";
import { createMerchantApi } from "@/lib/merchant-api";
import { typhoonChat } from "@/lib/typhoon";
import { Err, type Result, isErr, isSome } from "@fabric/types";

export type SalesInsightResult = Result<string, string>;

// Per-process throttle: one analysis per 3s. Typhoon's free tier is rate-limited;
// a merchant mashing the button would otherwise trip HTTP 429.
let lastCall = 0;
const RATE_LIMIT_MS = 3_000;

/**
 * AI sales insight (Typhoon, Thai-first). Server-authoritative: it re-fetches the
 * merchant's real analytics server-side and feeds only those numbers to the model,
 * so the client cannot inject fabricated figures. Read-only — nothing is persisted.
 */
export async function generateSalesInsightAction(): Promise<SalesInsightResult> {
  const now = Date.now();
  if (now - lastCall < RATE_LIMIT_MS) {
    return Err("กดถี่เกินไป — รอสักครู่แล้วลองใหม่");
  }
  lastCall = now;

  const maybeApi = await createMerchantApi();
  if (!isSome(maybeApi)) {
    return Err("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
  }

  const result = await maybeApi.value.getAnalytics();
  if (isErr(result)) {
    return Err(result.error);
  }

  const { totalRevenueCents, completedOrderCount, productCount, plan } = result.value;

  if (completedOrderCount === 0) {
    return Err("ยังไม่มีออเดอร์สำเร็จ — AI จะวิเคราะห์ได้เมื่อมียอดขายแล้ว");
  }

  const revenueBaht = Math.round(totalRevenueCents / 100);
  const avgOrderBaht =
    completedOrderCount > 0 ? Math.round(totalRevenueCents / completedOrderCount / 100) : 0;

  return typhoonChat(
    [
      {
        role: "system",
        content: `คุณเป็นที่ปรึกษาธุรกิจอีคอมเมิร์ซ ตอบเป็นภาษาไทยในรูปแบบนี้เท่านั้น:

ภาพรวม
[1 ประโยคสั้น ใช้ตัวเลขจริง ไม่เริ่มด้วย "แสดงว่า" หรือ "สะท้อน"]

สิ่งที่ควรทำ
[1 ประโยคสั้น แนะนำการกระทำที่ทำได้เลย]

กฎเหล็ก: ห้ามเพิ่มหัวข้ออื่น ห้าม emoji ห้าม bullet ห้ามแต่งตัวเลข ห้ามเกิน 40 คำ

ตัวอย่างที่ดี:
ภาพรวม
มีออเดอร์สำเร็จ 1 รายการ มูลค่า 1,600 บาท สินค้า 3 ชิ้น
สิ่งที่ควรทำ
เพิ่มสินค้าให้ครบ 10 รายการเพื่อดึงลูกค้ากลุ่มใหม่`,
      },
      {
        role: "user",
        content: `ข้อมูลร้านค้า:\n- รายได้รวม: ${revenueBaht.toLocaleString("th-TH")} บาท\n- ออเดอร์สำเร็จ: ${completedOrderCount.toLocaleString("th-TH")} รายการ\n- มูลค่าเฉลี่ยต่อออเดอร์: ${avgOrderBaht.toLocaleString("th-TH")} บาท\n- สินค้าในร้าน: ${productCount.toLocaleString("th-TH")} รายการ\n- แพ็กเกจ: ${plan}`,
      },
    ],
    {
      temperature: 0.3,
      maxTokens: 120,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noLeadingQuote,
        CONTENT_RULES.noBulletPoints,
        maxLength(180),
      ],
    }
  );
}
