import { AsyncLocalStorage } from "node:async_hooks";

const requestStorage = new AsyncLocalStorage<AbortSignal>();

export function runWithRequestSignal<T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> {
  return requestStorage.run(signal, fn);
}

export function getRequestSignal(): AbortSignal | undefined {
  return requestStorage.getStore();
}

export function firebaseQuery<T>(promise: Promise<T>): Promise<T> {
  const signal = requestStorage.getStore();
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException("Request aborted", "AbortError"));

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Request aborted", "AbortError")),
        { once: true }
      );
    }),
  ]);
}
