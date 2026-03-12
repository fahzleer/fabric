import { headers } from "next/headers";

const ALLOWED_ORIGINS = new Set(
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

export async function validateCsrfOrigin(): Promise<void> {
  const hdrs = await headers();
  const origin = hdrs.get("origin");
  if (origin === null || !ALLOWED_ORIGINS.has(origin)) {
    throw new Error("CSRF validation failed: invalid origin");
  }
}
