import { AsyncLocalStorage } from "node:async_hooks";

interface CorrelationIds {
  readonly requestId: string;
  readonly traceId: string;
}

const correlationStorage = new AsyncLocalStorage<CorrelationIds>();

export function runWithCorrelation<T>(ids: CorrelationIds, fn: () => Promise<T>): Promise<T> {
  return correlationStorage.run(ids, fn);
}

export function getCorrelationIds(): CorrelationIds | undefined {
  return correlationStorage.getStore();
}
