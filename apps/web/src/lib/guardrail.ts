/**
 * Output guardrail — deterministic rules for what an LLM may and may not print.
 *
 * This is a pure, regex-only pass over the model's output string. No second LLM
 * call, no tokens, no network: a `reject` rule fails the whole response (the match
 * must never appear), a `redact` rule scrubs the match in place and lets the rest
 * of the answer through. Every Typhoon response flows through `applyGuardrails`
 * in `typhoon.ts`, so secrets/PII can't leak regardless of which prompt produced
 * the text.
 *
 * Thai-first: redaction placeholders and reject reasons are written in Thai to
 * match the rest of the merchant-facing copy.
 */

import { Err, Ok, type Result } from "@fabric/types";

export type GuardrailAction =
  | { readonly kind: "reject"; readonly reason: string }
  | { readonly kind: "redact"; readonly replacement: string };

export type GuardrailRule = {
  /** Stable id, surfaced in reports and reject errors for debugging. */
  readonly id: string;
  /** Must carry the global (`/g`) flag — we scan every match, not just the first. */
  readonly pattern: RegExp;
  readonly action: GuardrailAction;
  /**
   * Optional second check to cut false positives (e.g. Luhn for card numbers).
   * Receives each raw match; return `false` to treat the match as a non-hit.
   */
  readonly validate?: (match: string) => boolean;
};

export type GuardrailViolation = {
  readonly ruleId: string;
  readonly reason: string;
};

export type GuardrailReport = {
  /** Output after every `redact` rule has been applied. */
  readonly text: string;
  /** Per-rule redaction counts, in the order rules fired. Empty when nothing matched. */
  readonly redactions: readonly { readonly ruleId: string; readonly count: number }[];
};

export type GuardrailResult = Result<GuardrailReport, GuardrailViolation>;

export const reject = (reason: string): GuardrailAction => ({ kind: "reject", reason });

export const redact = (replacement: string): GuardrailAction => ({
  kind: "redact",
  replacement,
});

/**
 * Luhn check — keeps the broad 13–19 digit card pattern from redacting arbitrary
 * long numbers (order ids, totals) that happen to be the right length.
 */
function luhnValid(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * The reusable safety set applied to every Typhoon call. Secrets are `reject`
 * (they must never appear — fail loud), PII is `redact` (scrub it, keep the
 * useful answer). Reject rules are evaluated before any redaction.
 */
export const DEFAULT_GUARDRAILS: readonly GuardrailRule[] = [
  {
    id: "api-key",
    pattern: /\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}\b/g,
    action: reject("ตรวจพบ API key/secret ในคำตอบของ AI — ปฏิเสธการแสดงผล"),
  },
  {
    id: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/gi,
    action: reject("ตรวจพบ token ในคำตอบของ AI — ปฏิเสธการแสดงผล"),
  },
  {
    id: "aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    action: reject("ตรวจพบ AWS access key ในคำตอบของ AI — ปฏิเสธการแสดงผล"),
  },
  {
    id: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    action: redact("[อีเมล]"),
  },
  {
    id: "thai-national-id",
    pattern: /\b\d[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d\b/g,
    action: redact("[เลขบัตรประชาชน]"),
    validate: (m) => m.replace(/\D/g, "").length === 13,
  },
  {
    id: "credit-card",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    action: redact("[เลขบัตร]"),
    validate: luhnValid,
  },
  {
    id: "thai-phone",
    pattern: /(?:\+66|0)\d{1,2}[-\s]?\d{3}[-\s]?\d{4}\b/g,
    action: redact("[เบอร์โทร]"),
    validate: (m) => {
      const len = m.replace(/\D/g, "").length;
      return len >= 9 && len <= 11;
    },
  },
];

/**
 * Content-format rules — enforce the style constraints that system prompts
 * request (no emoji, no bullet points, no leading quotes, max length). These
 * are `reject` rules: a violation means the model ignored an explicit
 * instruction and the whole response should be retried, not silently mangled.
 *
 * Compose with `DEFAULT_GUARDRAILS` when calling `typhoonChat`:
 *   guardrails: [...DEFAULT_GUARDRAILS, CONTENT_RULES.noEmoji, maxLength(80)]
 */
export const CONTENT_RULES = {
  noEmoji: {
    id: "no-emoji",
    pattern: /\p{Extended_Pictographic}/gu,
    action: reject("AI ส่งข้อความที่มี emoji — ลองใหม่อีกครั้ง"),
  } satisfies GuardrailRule,

  noBulletPoints: {
    id: "no-bullets",
    pattern: /^\s*[-•*·]\s+|^\s*\d+[.)]\s+/gm,
    action: reject("AI ส่งข้อความที่มี bullet point — ลองใหม่อีกครั้ง"),
  } satisfies GuardrailRule,

  noLeadingQuote: {
    id: "no-leading-quote",
    pattern: /^["""''«»]/g,
    action: reject("AI ส่งข้อความที่ขึ้นต้นด้วยเครื่องหมายคำพูด — ลองใหม่อีกครั้ง"),
  } satisfies GuardrailRule,
} as const;

/** Rejects any response whose trimmed length exceeds `n` characters. */
export function maxLength(n: number): GuardrailRule {
  return {
    id: `max-${n}`,
    // Matches only when the string contains n+1 or more characters.
    pattern: new RegExp(`[\\s\\S]{${n + 1},}`, "gs"),
    action: reject(`AI ส่งข้อความที่ยาวเกิน ${n} ตัวอักษร — ลองใหม่อีกครั้ง`),
  };
}

function ruleMatches(text: string, rule: GuardrailRule): boolean {
  // matchAll clones the regex's lastIndex internally, so sharing module-level
  // patterns across calls is safe (no stateful /g bug).
  for (const [match] of text.matchAll(rule.pattern)) {
    if (!rule.validate || rule.validate(match)) return true;
  }
  return false;
}

/**
 * Run `output` through the rules. Returns `Err` on the first `reject` hit;
 * otherwise `Ok` with the redacted text and a per-rule hit count.
 */
export function applyGuardrails(
  output: string,
  rules: readonly GuardrailRule[] = DEFAULT_GUARDRAILS
): GuardrailResult {
  for (const rule of rules) {
    if (rule.action.kind === "reject" && ruleMatches(output, rule)) {
      return Err({ ruleId: rule.id, reason: rule.action.reason });
    }
  }

  let text = output;
  const redactions: { ruleId: string; count: number }[] = [];
  for (const rule of rules) {
    if (rule.action.kind !== "redact") continue;
    const { replacement } = rule.action;
    let count = 0;
    text = text.replace(rule.pattern, (match) => {
      if (rule.validate && !rule.validate(match)) return match;
      count += 1;
      return replacement;
    });
    if (count > 0) redactions.push({ ruleId: rule.id, count });
  }

  return Ok({ text, redactions });
}
