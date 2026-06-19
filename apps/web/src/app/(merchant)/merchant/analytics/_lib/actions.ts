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
        content:
          "คุณเป็นที่ปรึกษาธุรกิจอีคอมเมิร์ซ วิเคราะห์ตัวเลขยอดขายของร้านค้าแล้วสรุปเป็นภาษาไทยที่เข้าใจง่าย กระชับ 2-3 ประโยค จากนั้นให้คำแนะนำที่ลงมือทำได้จริง 1 ข้อ ใช้ตัวเลขจากข้อมูลที่ให้เท่านั้น ห้ามแต่งตัวเลขขึ้นเอง ห้ามใช้ bullet point ห้ามใช้ emoji ตอบเป็นย่อหน้าเดียว",
      },
      {
        role: "user",
        content: `ข้อมูลร้านค้า:\n- รายได้รวมจากออเดอร์ที่สำเร็จ: ${revenueBaht.toLocaleString("th-TH")} บาท\n- จำนวนออเดอร์ที่สำเร็จ: ${completedOrderCount.toLocaleString("th-TH")} ออเดอร์\n- มูลค่าเฉลี่ยต่อออเดอร์: ${avgOrderBaht.toLocaleString("th-TH")} บาท\n- จำนวนสินค้าที่ลงขายในร้าน: ${productCount.toLocaleString("th-TH")} รายการ\n- แพ็กเกจที่ใช้: ${plan}\n\nช่วยวิเคราะห์ภาพรวมและแนะนำสิ่งที่ควรทำต่อ`,
      },
    ],
    {
      temperature: 0.7,
      maxTokens: 350,
      guardrails: [
        ...DEFAULT_GUARDRAILS,
        CONTENT_RULES.noEmoji,
        CONTENT_RULES.noBulletPoints,
        CONTENT_RULES.noLeadingQuote,
        maxLength(450),
      ],
    }
  );
}
