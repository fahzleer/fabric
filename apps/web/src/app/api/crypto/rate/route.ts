import { NextResponse } from "next/server";

const FALLBACK_RATE = 35;

export const revalidate = 120;

export async function GET() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=thb",
      { next: { revalidate: 120 } }
    );
    if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);

    const data = (await res.json()) as { "usd-coin"?: { thb?: number } };
    const rate = data["usd-coin"]?.thb ?? FALLBACK_RATE;

    return NextResponse.json({ thbPerUsdc: rate });
  } catch {
    return NextResponse.json({ thbPerUsdc: FALLBACK_RATE });
  }
}
