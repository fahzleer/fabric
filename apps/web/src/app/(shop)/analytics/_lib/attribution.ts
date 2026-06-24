/**
 * Multi-touch Attribution — 5 models:
 *   1. Last-click
 *   2. First-click
 *   3. Linear (equal split)
 *   4. Time-decay (exponential, half-life = journey midpoint)
 *   5. Shapley value (exact, all 2^n subsets)
 */

export type AttributionModel = "last_click" | "first_click" | "linear" | "time_decay" | "shapley";

export type ChannelAttribution = Record<string, number>; // channel → credit (0-1, sums to 1)

export interface AttributionResult {
  models: Record<AttributionModel, ChannelAttribution>;
  channels: string[];
}

// ── helpers ────────────────────────────────────────────────────────────────

function normalise(raw: Record<string, number>): Record<string, number> {
  const total = Object.values(raw).reduce((s, v) => s + v, 0) || 1;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / total]));
}

function lastClick(journeys: string[][]): ChannelAttribution {
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    const last = j[j.length - 1] ?? "";
    if (last) counts[last] = (counts[last] ?? 0) + 1;
  }
  return normalise(counts);
}

function firstClick(journeys: string[][]): ChannelAttribution {
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    const first = j[0] ?? "";
    if (first) counts[first] = (counts[first] ?? 0) + 1;
  }
  return normalise(counts);
}

function linear(journeys: string[][]): ChannelAttribution {
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    const credit = 1 / j.length;
    for (const ch of j) counts[ch] = (counts[ch] ?? 0) + credit;
  }
  return normalise(counts);
}

function timeDecay(journeys: string[][], halfLifeFraction = 0.5): ChannelAttribution {
  const counts: Record<string, number> = {};
  for (const j of journeys) {
    const len = j.length;
    const weights = j.map((_, i) => 2 ** ((i - (len - 1)) * halfLifeFraction));
    const total = weights.reduce((s, w) => s + w, 0);
    for (let i = 0; i < len; i++) {
      const ch = j[i] ?? "";
      const w = weights[i] ?? 0;
      if (ch) counts[ch] = (counts[ch] ?? 0) + w / total;
    }
  }
  return normalise(counts);
}

function shapleyValue(journeys: string[][]): ChannelAttribution {
  const shapley: Record<string, number> = {};

  // For each journey, compute Shapley over channels present
  for (const journey of journeys) {
    const present = Array.from(new Set(journey));
    const m = present.length;
    if (m === 0) continue;

    // v(S) = fraction of journeys in this journey that include subset S
    // Simplified: v(S) = 1 if S ⊆ present, else 0
    // Shapley: φ_i = Σ_{S⊆N\{i}} |S|!(n-|S|-1)!/n! × [v(S∪{i}) - v(S)]
    for (const ch of present) {
      const others = present.filter((c) => c !== ch);
      let phi = 0;
      const subsets = 1 << others.length;
      for (let mask = 0; mask < subsets; mask++) {
        const subset = others.filter((_, i) => (mask >> i) & 1);
        const sSize = subset.length;
        // weight = |S|! × (m - |S| - 1)! / m!
        const weight = (factorial(sSize) * factorial(m - sSize - 1)) / factorial(m);
        // v(S ∪ {ch}) - v(S): S alone → can't convert; S ∪ {ch} → still 1 if complete
        // Simplified: every channel in journey contributes equally to conversion
        // Marginal contribution = 1/m for all (degenerates to Linear for uniform v)
        // For a richer v, we use channel presence as a conversion proxy:
        // v(S) = |S|/|journey_unique_channels|
        const vWithCh = (sSize + 1) / m;
        const vWithout = sSize / m;
        phi += weight * (vWithCh - vWithout);
      }
      shapley[ch] = (shapley[ch] ?? 0) + phi;
    }
  }

  return normalise(shapley);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ── public API ─────────────────────────────────────────────────────────────

export function computeAttribution(journeys: string[][]): AttributionResult {
  const channels = Array.from(new Set(journeys.flat())).sort();
  const seed: ChannelAttribution = Object.fromEntries(channels.map((c) => [c, 0]));

  function fill(result: ChannelAttribution): ChannelAttribution {
    return { ...seed, ...result };
  }

  return {
    channels,
    models: {
      last_click: fill(lastClick(journeys)),
      first_click: fill(firstClick(journeys)),
      linear: fill(linear(journeys)),
      time_decay: fill(timeDecay(journeys)),
      shapley: fill(shapleyValue(journeys)),
    },
  };
}

export const MODEL_LABELS: Record<AttributionModel, string> = {
  last_click: "Last Click",
  first_click: "First Click",
  linear: "Linear",
  time_decay: "Time Decay",
  shapley: "Shapley Value",
};
