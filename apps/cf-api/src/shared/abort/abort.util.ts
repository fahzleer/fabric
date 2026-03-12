export function composeSignals(
  requestSignal: AbortSignal | null | undefined,
  timeoutMs: number
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!requestSignal) return timeout;

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([requestSignal, timeout]);
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (requestSignal.aborted || timeout.aborted) {
    controller.abort();
    return controller.signal;
  }

  requestSignal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });

  return controller.signal;
}

export function withAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
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
