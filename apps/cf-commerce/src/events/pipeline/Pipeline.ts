import { type DomainEvent, eventType } from "../domain/Event.ts";

export type Stage = (
  ev: DomainEvent
) => { ok: true; value: DomainEvent } | { ok: false; error: string };

export interface Pipeline {
  readonly stages: ReadonlyArray<Stage>;
}

export const build = (
  validateStage: Stage,
  dedupStage: Stage,
  handleStage: Stage,
  notifyStage: Stage
): Pipeline => ({ stages: [validateStage, dedupStage, handleStage, notifyStage] });

export const run = (
  pipeline: Pipeline,
  ev: DomainEvent
): { ok: true; value: DomainEvent } | { ok: false; error: string } => {
  let current = ev;
  for (const stage of pipeline.stages) {
    const result = stage(current);
    if (!result.ok) return result;
    current = result.value;
  }
  return { ok: true, value: current };
};

export const logged =
  (label: string, stage: Stage): Stage =>
  (ev: DomainEvent) => {
    const etype = eventType(ev);
    const res = stage(ev);
    const _log = res.ok ? `${label} [${etype}] ok` : `${label} [${etype}] err=${res.error}`;
    return res;
  };

export const retried =
  (stage: Stage): Stage =>
  (ev: DomainEvent) => {
    const res = stage(ev);
    return res.ok ? res : stage(ev);
  };

export const timed =
  (_label: string, stage: Stage): Stage =>
  (ev: DomainEvent) =>
    stage(ev);

export const validationStage: Stage = (ev) => {
  if (!ev.meta.eventId) return { ok: false, error: "event_id is required" };
  if (!ev.meta.aggregateId) return { ok: false, error: "aggregate_id is required" };
  return { ok: true, value: ev };
};

export const dedupStage: Stage = (ev) => ({ ok: true, value: ev });

export const passthroughStage: Stage = (ev) => ({ ok: true, value: ev });

export const processEvent = (
  ev: DomainEvent
): { ok: true; value: DomainEvent } | { ok: false; error: string } => {
  const pipeline = build(
    logged("validate", validationStage),
    logged("dedup", dedupStage),
    logged("handle", retried(passthroughStage)),
    logged("notify", timed("notify", passthroughStage))
  );
  return run(pipeline, ev);
};
