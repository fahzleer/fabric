import { describe, expect, test } from "bun:test";
import { isErr, isOk } from "@fabric/types";
import {
  CONTENT_RULES,
  type GuardrailRule,
  applyGuardrails,
  maxLength,
  redact,
  reject,
} from "./guardrail";

describe("applyGuardrails — reject rules", () => {
  test("rejects an OpenAI-style secret key", () => {
    const result = applyGuardrails("คีย์คือ sk-abcdefghijklmnop1234 อย่าบอกใคร");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("api-key");
  });

  test("rejects a bearer token", () => {
    const result = applyGuardrails("ใช้ header Authorization: Bearer abcdef0123456789ABCDEF.token");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("bearer-token");
  });

  test("rejects an AWS access key", () => {
    const result = applyGuardrails("key: AKIAIOSFODNN7EXAMPLE");
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("aws-access-key");
  });

  test("reject reason is surfaced verbatim", () => {
    const result = applyGuardrails("sk-abcdefghijklmnop1234");
    if (isErr(result)) expect(result.error.reason).toContain("API key");
  });
});

describe("applyGuardrails — redact rules", () => {
  test("redacts an email but keeps the surrounding text", () => {
    const result = applyGuardrails("ติดต่อร้านที่ shop@example.com ได้เลยครับ");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.text).toBe("ติดต่อร้านที่ [อีเมล] ได้เลยครับ");
      expect(result.value.redactions).toContainEqual({ ruleId: "email", count: 1 });
    }
  });

  test("redacts a Thai national id (13 digits)", () => {
    const result = applyGuardrails("เลขบัตร 1-2345-67890-12-3 ของลูกค้า");
    if (isOk(result)) expect(result.value.text).toContain("[เลขบัตรประชาชน]");
  });

  test("redacts a Luhn-valid credit card", () => {
    const result = applyGuardrails("จ่ายด้วยบัตร 4242 4242 4242 4242 นะ");
    if (isOk(result)) expect(result.value.text).toContain("[เลขบัตร]");
  });

  test("redacts a Thai phone number", () => {
    const result = applyGuardrails("โทร 081-234-5678 มาได้");
    if (isOk(result)) expect(result.value.text).toContain("[เบอร์โทร]");
  });

  test("counts multiple hits of the same rule", () => {
    const result = applyGuardrails("a@x.com และ b@y.com");
    if (isOk(result)) {
      expect(result.value.text).toBe("[อีเมล] และ [อีเมล]");
      expect(result.value.redactions).toContainEqual({ ruleId: "email", count: 2 });
    }
  });
});

describe("applyGuardrails — false-positive guards", () => {
  test("a baht total is not mistaken for a credit card", () => {
    const clean = "ยอดขายรวม 819,700 บาท จาก 5 ออเดอร์";
    const result = applyGuardrails(clean);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.text).toBe(clean);
      expect(result.value.redactions).toHaveLength(0);
    }
  });

  test("a Luhn-invalid 16-digit number is left alone", () => {
    const clean = "เลขออเดอร์ 1234567812345678";
    const result = applyGuardrails(clean);
    if (isOk(result)) expect(result.value.text).toBe(clean);
  });

  test("ordinary prose passes through untouched", () => {
    const clean = "ร้านของคุณมียอดขายเติบโตดี ควรเพิ่มสต็อกสินค้าขายดี";
    const result = applyGuardrails(clean);
    if (isOk(result)) {
      expect(result.value.text).toBe(clean);
      expect(result.value.redactions).toHaveLength(0);
    }
  });
});

describe("CONTENT_RULES.noEmoji", () => {
  test("rejects a response containing an emoji", () => {
    const result = applyGuardrails("สินค้าสวย 🎉 มาก", [CONTENT_RULES.noEmoji]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("no-emoji");
  });

  test("passes clean Thai prose", () => {
    const result = applyGuardrails("ผ้าคอตตอนนุ่มสบาย ใส่ได้ทุกโอกาส", [CONTENT_RULES.noEmoji]);
    expect(isOk(result)).toBe(true);
  });
});

describe("CONTENT_RULES.noBulletPoints", () => {
  test("rejects a dash bullet at line start", () => {
    const result = applyGuardrails("รายการ:\n- ข้อหนึ่ง\n- ข้อสอง", [CONTENT_RULES.noBulletPoints]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("no-bullets");
  });

  test("rejects a numbered list", () => {
    const result = applyGuardrails("1. ข้อแรก\n2. ข้อสอง", [CONTENT_RULES.noBulletPoints]);
    expect(isErr(result)).toBe(true);
  });

  test("passes a hyphen inside prose (not a list)", () => {
    const result = applyGuardrails("ผ้า cotton-linen นุ่มสบาย", [CONTENT_RULES.noBulletPoints]);
    expect(isOk(result)).toBe(true);
  });
});

describe("CONTENT_RULES.noLeadingQuote", () => {
  test("rejects a response starting with a double-quote", () => {
    const result = applyGuardrails('"สวยงาม" — tagline', [CONTENT_RULES.noLeadingQuote]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("no-leading-quote");
  });

  test("rejects a Thai opening quotation mark", () => {
    const result = applyGuardrails("'เสื้อผ้าดี'", [CONTENT_RULES.noLeadingQuote]);
    expect(isErr(result)).toBe(true);
  });

  test("passes prose that starts with Thai text", () => {
    const result = applyGuardrails("เสื้อผ้าแฟชั่นคุณภาพ", [CONTENT_RULES.noLeadingQuote]);
    expect(isOk(result)).toBe(true);
  });
});

describe("maxLength", () => {
  test("rejects a response that exceeds the limit", () => {
    const long = "ก".repeat(81);
    const result = applyGuardrails(long, [maxLength(80)]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("max-80");
  });

  test("accepts a response exactly at the limit", () => {
    const exact = "ก".repeat(80);
    const result = applyGuardrails(exact, [maxLength(80)]);
    expect(isOk(result)).toBe(true);
  });

  test("accepts a response under the limit", () => {
    const short = "สั้น";
    const result = applyGuardrails(short, [maxLength(80)]);
    expect(isOk(result)).toBe(true);
  });
});

describe("applyGuardrails — stateless across calls", () => {
  test("shared /g patterns do not leak lastIndex between calls", () => {
    const input = "ติดต่อ a@x.com";
    const first = applyGuardrails(input);
    const second = applyGuardrails(input);
    if (isOk(first) && isOk(second)) {
      expect(first.value.text).toBe(second.value.text);
    }
  });
});

describe("applyGuardrails — custom rules", () => {
  const noBullets: GuardrailRule = {
    id: "no-bullets",
    pattern: /^[\s]*[-*]\s+/gm,
    action: redact(""),
  };

  test("custom redact rule strips markdown bullets", () => {
    const result = applyGuardrails("- ข้อหนึ่ง\n- ข้อสอง", [noBullets]);
    if (isOk(result)) expect(result.value.text).toBe("ข้อหนึ่ง\nข้อสอง");
  });

  test("empty ruleset is a passthrough", () => {
    const input = "sk-abcdefghijklmnop1234 shop@example.com";
    const result = applyGuardrails(input, []);
    if (isOk(result)) {
      expect(result.value.text).toBe(input);
      expect(result.value.redactions).toHaveLength(0);
    }
  });

  test("custom reject rule fires", () => {
    const banWord: GuardrailRule = {
      id: "ban-word",
      pattern: /ห้าม/g,
      action: reject("เจอคำต้องห้าม"),
    };
    const result = applyGuardrails("คำนี้ห้ามพูด", [banWord]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) expect(result.error.ruleId).toBe("ban-word");
  });
});
