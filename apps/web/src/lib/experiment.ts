"use client";

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL ?? "http://localhost:3010";
const EXP_KEY = "fabric_experiments";

type Variant = "control" | "variant";

interface ExperimentResult {
  variant: Variant;
  isSignificant: boolean;
  pValue: number;
  upliftPercent: number;
}

function loadAssignments(): Record<string, Variant> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(EXP_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveAssignments(assignments: Record<string, Variant>): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(EXP_KEY, JSON.stringify(assignments));
}

export function getVariant(experimentId: string): Variant {
  const assignments = loadAssignments();
  if (assignments[experimentId]) return assignments[experimentId];
  const variant: Variant = Math.random() < 0.5 ? "control" : "variant";
  saveAssignments({ ...assignments, [experimentId]: variant });
  return variant;
}

export async function recordConversion(
  experimentId: string,
  controlConversions: number,
  controlVisitors: number,
  variantConversions: number,
  variantVisitors: number
): Promise<ExperimentResult | null> {
  try {
    const res = await fetch(`${ML_API}/api/ml/ab-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_conversions: controlConversions,
        control_visitors: controlVisitors,
        variant_conversions: variantConversions,
        variant_visitors: variantVisitors,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      is_significant: boolean;
      p_value: number;
      uplift_percent: number;
    };
    const variant = getVariant(experimentId);
    return {
      variant,
      isSignificant: data.is_significant,
      pValue: data.p_value,
      upliftPercent: data.uplift_percent,
    };
  } catch {
    return null;
  }
}

export function useExperiment(experimentId: string): Variant {
  return getVariant(experimentId);
}
