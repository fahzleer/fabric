import { Either, pipe } from "effect";
import { MLError } from "./ml.errors";

export interface ABTestParams {
  readonly control_conversions: number;
  readonly control_visitors: number;
  readonly variant_conversions: number;
  readonly variant_visitors: number;
  readonly confidence_level?: number;
}

export interface ABTestResult {
  readonly is_significant: boolean;
  readonly p_value: number;
  readonly uplift_percent: number;
  readonly confidence_interval: [number, number];
  readonly control_rate: number;
  readonly variant_rate: number;
  readonly required_sample_size: number;
  readonly recommendation: string;
}

const Z_SCORES: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 };

// Abramowitz & Stegun 7.1.26 — max error 1.5e-7
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = poly * Math.exp(-x * x);
  return x >= 0 ? result : 2 - result;
}

// Beasley-Springer-Moro rational approximation of inverse normal CDF
function quantileNormal(p: number): number {
  if (p <= 0.5) return -quantileNormal(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const num = a.reduce((s, ai, i) => s + ai * t ** i, 0);
  const den = 1 + b.reduce((s, bi, i) => s + bi * t ** (i + 1), 0);
  return t - num / den;
}

function requiredSampleSize(pBaseline: number, alpha: number): number {
  const pAlt = pBaseline * 1.05;
  const pBar = (pBaseline + pAlt) / 2;
  const zAlpha = Z_SCORES[1 - alpha / 2] ?? 1.96;
  const zPower = quantileNormal(0.8);
  const num =
    (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
      zPower * Math.sqrt(pBaseline * (1 - pBaseline) + pAlt * (1 - pAlt))) **
    2;
  return Math.max(Math.ceil(num / Math.max((pAlt - pBaseline) ** 2, 1e-10)), 100);
}

const validateInputs = (p: ABTestParams): Either.Either<ABTestParams, MLError> =>
  p.control_visitors <= 0 || p.variant_visitors <= 0
    ? Either.left(MLError.invalidInput("control_visitors and variant_visitors must be > 0"))
    : Either.right(p);

const computeStats = (p: ABTestParams): Either.Either<ABTestResult, MLError> => {
  const {
    control_conversions: cc,
    control_visitors: cv,
    variant_conversions: vc,
    variant_visitors: vv,
  } = p;
  const confidence = p.confidence_level ?? 0.95;

  const pC = cc / cv;
  const pV = vc / vv;
  const n = cv + vv;

  const convTotal = cc + vc;
  const nonTotal = cv - cc + (vv - vc);

  const eCC = (convTotal * cv) / n;
  const eVC = (convTotal * vv) / n;
  const eCNC = (nonTotal * cv) / n;
  const eVNC = (nonTotal * vv) / n;

  const chi2 =
    (cc - eCC) ** 2 / Math.max(eCC, 1e-10) +
    (vc - eVC) ** 2 / Math.max(eVC, 1e-10) +
    (cv - cc - eCNC) ** 2 / Math.max(eCNC, 1e-10) +
    (vv - vc - eVNC) ** 2 / Math.max(eVNC, 1e-10);

  const pValue = erfc(Math.sqrt(chi2 / 2));
  const alpha = 1 - confidence;
  const isSignificant = pValue < alpha;
  const uplift = ((pV - pC) / Math.max(pC, 1e-10)) * 100;

  const z = Z_SCORES[confidence] ?? 1.96;
  const se = Math.sqrt((pV * (1 - pV)) / Math.max(vv, 1) + (pC * (1 - pC)) / Math.max(cv, 1));
  const diff = pV - pC;
  const ci: [number, number] = [
    Math.round((diff - z * se) * 10000) / 100,
    Math.round((diff + z * se) * 10000) / 100,
  ];

  const pRound = Math.round(pValue * 1e6) / 1e6;
  const upliftRound = Math.round(uplift * 100) / 100;
  const nReq = requiredSampleSize(pC, alpha);

  const recommendation =
    isSignificant && uplift > 0
      ? `Ship the variant — ${Math.round(uplift * 10) / 10}% uplift is statistically significant (p=${pRound})`
      : isSignificant
        ? `Keep control — variant underperforms by ${Math.round(Math.abs(uplift) * 10) / 10}% (p=${pRound})`
        : `Not yet significant (p=${pRound}, α=${Math.round(alpha * 100) / 100}). Need ~${nReq} visitors per variant for 80% power.`;

  return Either.right({
    is_significant: isSignificant,
    p_value: pRound,
    uplift_percent: upliftRound,
    confidence_interval: ci,
    control_rate: Math.round(pC * 1e6) / 1e4,
    variant_rate: Math.round(pV * 1e6) / 1e4,
    required_sample_size: nReq,
    recommendation,
  });
};

export const analyzeABTest = (params: ABTestParams): Either.Either<ABTestResult, MLError> =>
  pipe(Either.right(params), Either.flatMap(validateInputs), Either.flatMap(computeStats));
