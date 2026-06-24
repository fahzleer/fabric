export interface FunnelStage {
  stage: string;
  users: number;
}

export interface FunnelStep {
  stage: string;
  users: number;
  conversionFromPrev: number | null; // % relative to previous stage
  conversionFromTop: number; // % relative to first stage
  dropOff: number; // absolute users lost from prev stage
  dropOffPct: number | null; // % dropped from prev stage
}

export interface FunnelResult {
  steps: FunnelStep[];
  overallConversion: number;
  biggestDropStage: string;
}

export function computeFunnel(stages: FunnelStage[]): FunnelResult {
  const first = stages[0];
  if (!first) throw new Error("No stages provided");

  const top = first.users;
  const last = stages[stages.length - 1] ?? first;

  const steps: FunnelStep[] = stages.map((s, i) => {
    const prevStage = i === 0 ? null : stages[i - 1];
    const prev = prevStage?.users ?? null;
    const conversionFromPrev = prev === null ? null : Math.round((s.users / prev) * 1000) / 10;
    const conversionFromTop = Math.round((s.users / top) * 1000) / 10;
    const dropOff = prev === null ? 0 : prev - s.users;
    const dropOffPct = prev === null ? null : Math.round(((prev - s.users) / prev) * 1000) / 10;

    return {
      stage: s.stage,
      users: s.users,
      conversionFromPrev,
      conversionFromTop,
      dropOff,
      dropOffPct,
    };
  });

  const overallConversion = Math.round((last.users / top) * 1000) / 10;

  const afterFirst = steps.slice(1);
  const biggestDropStep = afterFirst.reduce<FunnelStep | undefined>(
    (max, s) => (max === undefined || s.dropOff > max.dropOff ? s : max),
    undefined
  );

  return { steps, overallConversion, biggestDropStage: biggestDropStep?.stage ?? "" };
}
