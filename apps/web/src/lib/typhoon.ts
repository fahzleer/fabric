/**
 * Typhoon LLM client — OpenAI-compatible chat completions.
 *
 * Server-only: this module reads `OPENAI_API_KEY` from the environment and must
 * never be imported into a client component. Its only consumers are `"use server"`
 * actions, so the key is never bundled to the browser.
 *
 * Config (set in apps/web/.env.local, which is gitignored):
 *   OPENAI_API_KEY   — Typhoon API key (required)
 *   OPENAI_BASE_URL  — defaults to https://api.opentyphoon.ai/v1
 *   OPENAI_MODEL     — defaults to typhoon-v2.5-30b-a3b-instruct
 */

import { Err, Ok, type Result, isErr } from "@fabric/types";
import { DEFAULT_GUARDRAILS, type GuardrailRule, applyGuardrails } from "./guardrail";

const DEFAULT_BASE_URL = "https://api.opentyphoon.ai/v1";
const DEFAULT_MODEL = "typhoon-v2.5-30b-a3b-instruct";
const REQUEST_TIMEOUT_MS = 30_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type TyphoonResult = Result<string, string>;

type ChatCompletionResponse = {
  choices?: { message?: { content?: string } }[];
};

function describeHttpError(status: number): string {
  if (status === 429) return "ใช้งาน AI ถี่เกินไป (rate limit) — รอสักครู่แล้วลองใหม่";
  if (status === 401 || status === 403) return "API key ของ Typhoon ไม่ถูกต้องหรือหมดสิทธิ์ใช้งาน";
  return `เรียก AI ไม่สำเร็จ (HTTP ${status})`;
}

export async function typhoonChat(
  messages: ChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    /** Output guardrail rules. Defaults to the shared safety set; pass `[]` to disable. */
    guardrails?: readonly GuardrailRule[];
  } = {}
): Promise<TyphoonResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Err("ยังไม่ได้ตั้งค่า AI (OPENAI_API_KEY ว่าง)");
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 512,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return Err(describeHttpError(res.status));
    }

    const data = (await res.json()) as ChatCompletionResponse;
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return Err("AI ไม่ได้ส่งข้อความกลับมา ลองใหม่อีกครั้ง");
    }

    // Guardrail: deterministic check on what the model may print before it
    // reaches the caller. `reject` rules fail the response; `redact` rules scrub.
    const guarded = applyGuardrails(text, opts.guardrails ?? DEFAULT_GUARDRAILS);
    if (isErr(guarded)) {
      return Err(guarded.error.reason);
    }
    return Ok(guarded.value.text);
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      return Err("AI ใช้เวลานานเกินไป (timeout) ลองใหม่อีกครั้ง");
    }
    return Err("เชื่อมต่อ AI ไม่สำเร็จ ลองใหม่อีกครั้ง");
  } finally {
    clearTimeout(timer);
  }
}
