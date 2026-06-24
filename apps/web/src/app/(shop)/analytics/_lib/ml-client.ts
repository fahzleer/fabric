const ML_API = process.env.NEXT_PUBLIC_ML_API_URL ?? "http://localhost:3010";

export interface MMMSpend {
  meta?: number[];
  google?: number[];
  tiktok?: number[];
  line_oa?: number[];
  shopee?: number[];
  email?: number[];
  sms?: number[];
}

export interface MMMResult {
  attribution: Record<string, number>;
  roi: Record<string, number>;
  model_r2: number;
  budget_recommendation: Record<string, number>;
  insights: string[];
  active_channels: string[];
}

export interface ABTestResult {
  is_significant: boolean;
  p_value: number;
  uplift_percent: number;
  confidence_interval: [number, number];
  control_rate: number;
  variant_rate: number;
  required_sample_size: number;
  recommendation: string;
}

export async function runMMM(spend: MMMSpend, sales: number[]): Promise<MMMResult> {
  const res = await fetch(`${ML_API}/api/ml/mmm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spend, sales }),
  });
  if (!res.ok) throw new Error(`MMM failed: ${res.status}`);
  return res.json() as Promise<MMMResult>;
}

export async function runABTest(params: {
  control_conversions: number;
  control_visitors: number;
  variant_conversions: number;
  variant_visitors: number;
  confidence_level?: number;
}): Promise<ABTestResult> {
  return fetch(`${ML_API}/api/ml/ab-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then((r) => {
    if (!r.ok) throw new Error(`AB test failed: ${r.status}`);
    return r.json();
  });
}
