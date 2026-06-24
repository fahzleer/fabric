import { Either, pipe } from "effect";
import { MLError } from "./ml.errors";

export interface MMMSpend {
  readonly meta?: number[];
  readonly google?: number[];
  readonly tiktok?: number[];
  readonly line_oa?: number[];
  readonly shopee?: number[];
  readonly email?: number[];
  readonly sms?: number[];
  readonly [channel: string]: number[] | undefined;
}

export interface MMMResult {
  readonly attribution: Record<string, number>;
  readonly roi: Record<string, number>;
  readonly model_r2: number;
  readonly budget_recommendation: Record<string, number>;
  readonly insights: string[];
  readonly active_channels: string[];
}

type Vec = number[];
type Matrix = number[][];

// ── Matrix primitives ────────────────────────────────────────────────────────

const at = (A: Matrix, i: number, j: number): number => A[i]?.[j] ?? 0;
const vec = (v: Vec, i: number): number => v[i] ?? 0;

const transpose = (A: Matrix): Matrix => (A[0] ?? []).map((_, j) => A.map((row) => row[j] ?? 0));

const matMul = (A: Matrix, B: Matrix): Matrix =>
  A.map((row) => (B[0] ?? []).map((_, j) => row.reduce((s, v, k) => s + v * at(B, k, j), 0)));

const matVecMul = (A: Matrix, v: Vec): Vec =>
  A.map((row) => row.reduce((s, a, j) => s + a * vec(v, j), 0));

const addScaledIdentity = (A: Matrix, alpha: number): Matrix =>
  A.map((row, i) => row.map((v, j) => (i === j ? v + alpha : v)));

const pivotRow = (M: Matrix, col: number, n: number): number => {
  let max = col;
  for (let row = col + 1; row < n; row++) {
    if (Math.abs(at(M, row, col)) > Math.abs(at(M, max, col))) max = row;
  }
  return max;
};

const eliminateRow = (M: Matrix, col: number, row: number, n: number, pivot: number): void => {
  const f = at(M, row, col) / pivot;
  const mRow = M[row];
  if (!mRow) return;
  for (let k = col; k <= n; k++) mRow[k] = (mRow[k] ?? 0) - f * at(M, col, k);
};

// Gauss-Jordan with partial pivoting — safe for k ≤ 7
const solve = (A: Matrix, b: Vec): Vec => {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, vec(b, i)]);

  for (let col = 0; col < n; col++) {
    const maxRow = pivotRow(M, col, n);
    [M[col], M[maxRow]] = [M[maxRow] ?? [], M[col] ?? []];

    const pivot = at(M, col, col);
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = 0; row < n; row++) {
      if (row !== col) eliminateRow(M, col, row, n, pivot);
    }
  }

  return Array.from({ length: n }, (_, i) => at(M, i, n) / at(M, i, i));
};

// β = (X'X + αI)^{-1} X'y
const ridgeSolve = (X: Matrix, y: Vec, alpha = 0.1): Vec => {
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const A = addScaledIdentity(XtX, alpha);
  const Xty = matVecMul(Xt, y);
  return solve(A, Xty);
};

// ── Signal transforms ────────────────────────────────────────────────────────

const DECAY: Record<string, number> = {
  meta: 0.5,
  google: 0.25,
  tiktok: 0.35,
  line_oa: 0.6,
  shopee: 0.2,
  email: 0.4,
  sms: 0.3,
};

const adstock = (spend: Vec, decay: number): Vec =>
  spend.reduce<Vec>((acc, val) => {
    acc.push(val + decay * (acc.at(-1) ?? 0));
    return acc;
  }, []);

const normalize = (v: Vec): Vec => {
  const mx = Math.max(...v);
  return mx > 0 ? v.map((x) => x / mx) : v;
};

const hillSaturation = (v: Vec, halfMax = 0.5, slope = 2): Vec =>
  v.map((x) => {
    const xs = Math.max(x, 0) ** slope;
    const ks = halfMax ** slope;
    return xs / (xs + ks + 1e-12);
  });

const transformChannel = (channel: string, spend: Vec): Vec =>
  pipe(spend, (s) => adstock(s, DECAY[channel] ?? 0.4), normalize, hillSaturation);

// ── Pipeline steps ───────────────────────────────────────────────────────────

interface ValidatedInput {
  readonly channels: string[];
  readonly transformed: Vec[];
  readonly rawSpend: Record<string, Vec>;
  readonly sales: Vec;
}

const filterActiveChannels = ({
  spend,
  sales,
}: {
  spend: MMMSpend;
  sales: Vec;
}): Either.Either<ValidatedInput, MLError> => {
  const active = Object.entries(spend).filter(
    ([, vals]) =>
      Array.isArray(vals) && vals.length === sales.length && vals.reduce((s, v) => s + v, 0) > 0
  ) as [string, Vec][];

  if (active.length === 0) return Either.left(MLError.noActiveChannels());

  const channels = active.map(([ch]) => ch).sort();
  const transformed = channels.map((ch) =>
    transformChannel(ch, active.find(([c]) => c === ch)?.[1] ?? [])
  );
  const rawSpend = Object.fromEntries(active);

  return Either.right({ channels, transformed, rawSpend, sales });
};

const fitRidge = (input: ValidatedInput): Either.Either<MMMResult, MLError> => {
  const { channels, transformed, rawSpend, sales } = input;
  const n = sales.length;

  // Build X matrix: rows = time periods, cols = channels
  const X: Matrix = Array.from({ length: n }, (_, t) =>
    channels.map((_, k) => transformed[k]?.[t] ?? 0)
  );

  const rawCoeffs = ridgeSolve(X, sales);
  const coeffs = rawCoeffs.map((c) => Math.max(c, 0)); // enforce non-negativity

  const chTotals = channels.map((_, k) =>
    (transformed[k] ?? []).reduce((s, x) => s + x * (coeffs[k] ?? 0), 0)
  );
  const grandTotal = Math.max(
    chTotals.reduce((s, t) => s + t, 0),
    1e-10
  );
  const meanSales = sales.reduce((s, v) => s + v, 0) / n;

  const attribution = Object.fromEntries(
    channels.map((ch, k) => [ch, Math.round(((chTotals[k] ?? 0) / grandTotal) * 10000) / 100])
  );

  const roi = Object.fromEntries(
    channels.map((ch, k) => {
      const spendSum = (rawSpend[ch] ?? []).reduce((s, v) => s + v, 0);
      const modelledRev = ((chTotals[k] ?? 0) / grandTotal) * meanSales * n;
      return [ch, spendSum > 0 ? Math.round((modelledRev / spendSum) * 1000) / 1000 : 0];
    })
  );

  const totalBudget = channels.reduce(
    (s, ch) => s + (rawSpend[ch] ?? []).reduce((a, v) => a + v, 0),
    0
  );
  const totalRoiWeight = Math.max(
    channels.reduce((s, ch) => s + Math.max(roi[ch] ?? 0, 0), 0),
    1e-10
  );

  const budget_recommendation = Object.fromEntries(
    channels.map((ch) => {
      const w = Math.max(roi[ch] ?? 0, 0);
      return [ch, Math.round((w / totalRoiWeight) * totalBudget * 100) / 100];
    })
  );

  const yPred = X.map((row) => row.reduce((s, x, k) => s + x * (coeffs[k] ?? 0), 0));
  const meanY = sales.reduce((s, v) => s + v, 0) / n;
  const ssRes = sales.reduce((s, y, i) => s + (y - (yPred[i] ?? 0)) ** 2, 0);
  const ssTot = sales.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const model_r2 = Math.round((ssTot === 0 ? 1 : 1 - ssRes / ssTot) * 10000) / 10000;

  const top = channels.reduce((a, ch) => ((attribution[ch] ?? 0) > (attribution[a] ?? 0) ? ch : a));
  const best = channels.reduce((a, ch) => ((roi[ch] ?? 0) > (roi[a] ?? 0) ? ch : a));

  const label = (ch: string) => ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const insights: string[] = [
    `${label(top)} is your top revenue driver at ${attribution[top]}% attribution`,
    `${label(best)} delivers the best ROI at ${roi[best]}x return`,
  ];

  const underinvested = channels.find(
    (ch) => ch !== best && (attribution[ch] ?? 0) < 15 && (roi[ch] ?? 0) >= (roi[best] ?? 0) * 0.7
  );

  if (underinvested) {
    insights.push(
      `Increase ${label(underinvested)} budget — high ROI (${roi[underinvested]}x) but only ${attribution[underinvested]}% of spend`
    );
  }

  return Either.right({
    attribution,
    roi,
    model_r2,
    budget_recommendation,
    insights,
    active_channels: channels,
  });
};

export const fitMMM = (spend: MMMSpend, sales: Vec): Either.Either<MMMResult, MLError> =>
  pipe(
    Either.right({ spend, sales }),
    Either.flatMap(filterActiveChannels),
    Either.flatMap(fitRidge)
  );
