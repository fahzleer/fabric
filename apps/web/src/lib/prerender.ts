import type { ReactNode } from "react";
import { prerender } from "react-dom/static.edge";

export type PrerenderShell = Awaited<ReturnType<typeof prerender>>;
type PrerenderOptions = Parameters<typeof prerender>[1];

export function prerenderShell(
  element: ReactNode,
  options?: Omit<NonNullable<PrerenderOptions>, "signal">
): Promise<PrerenderShell> {
  const controller = new AbortController();
  return schedulePrerender(
    () => prerender(element, { ...options, signal: controller.signal }),
    controller,
    setImmediate
  );
}

export function schedulePrerender(
  renderFn: () => Promise<PrerenderShell>,
  controller: Pick<AbortController, "abort">,
  schedule: (callback: () => void) => unknown
): Promise<PrerenderShell> {
  return new Promise<PrerenderShell>((resolve, reject) => {
    let pending: Promise<PrerenderShell> | undefined;

    schedule(() => {
      try {
        pending = renderFn();
      } catch (err) {
        reject(err as Error);
      }
    });

    schedule(() => {
      controller.abort();
      if (pending !== undefined) {
        pending.then(resolve, reject);
      } else {
        reject(new Error("prerender did not start before abort"));
      }
    });
  });
}
