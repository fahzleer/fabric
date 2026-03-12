/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import { schedulePrerender } from "./prerender";

const makeShell = (): { prelude: ReadableStream; postponed: null } => ({
  prelude: new ReadableStream(),
  postponed: null,
});

const makeController = (abortFn: () => void = () => undefined): Pick<AbortController, "abort"> => ({
  abort: abortFn,
});

const makeSyncScheduler = (): {
  schedule: (fn: () => void) => void;
  flush: () => void;
} => {
  const tasks: Array<() => void> = [];
  return {
    schedule: (fn) => {
      tasks.push(fn);
    },
    flush: () => {
      for (const t of tasks) t();
    },
  };
};

describe("schedulePrerender", () => {
  test("resolves with the PrerenderShell returned by renderFn", async () => {
    const shell = makeShell();
    const renderFn = mock(() => Promise.resolve(shell));
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(renderFn, makeController(), schedule);
    flush();
    expect(await promise).toBe(shell);
  });

  test("renderFn is called in tick 1 and abort() in tick 2", async () => {
    const callOrder: string[] = [];
    const renderFn = mock(() => {
      callOrder.push("render");
      return Promise.resolve(makeShell());
    });
    const controller = makeController(() => callOrder.push("abort"));
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(renderFn, controller, schedule);
    expect(callOrder).toEqual([]);
    flush();
    await promise;
    expect(callOrder).toEqual(["render", "abort"]);
  });

  test("abort() is called before the returned Promise settles", async () => {
    const callOrder: string[] = [];
    let resolveRender!: (v: ReturnType<typeof makeShell>) => void;
    const renderPromise = new Promise<ReturnType<typeof makeShell>>((res) => {
      resolveRender = (v) => {
        callOrder.push("render resolved");
        res(v);
      };
    });
    const renderFn = mock(() => renderPromise);
    const controller = makeController(() => callOrder.push("abort"));
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(renderFn, controller, schedule);
    flush();
    resolveRender(makeShell());
    await promise;
    expect(callOrder).toEqual(["abort", "render resolved"]);
  });

  test("no work is done before schedule callbacks are invoked", async () => {
    const renderFn = mock(() => Promise.resolve(makeShell()));
    const { schedule } = makeSyncScheduler();
    schedulePrerender(renderFn, makeController(), schedule);
    expect(renderFn).toHaveBeenCalledTimes(0);
  });

  test("rejects when renderFn throws synchronously", async () => {
    const renderFn = mock(() => {
      throw new Error("sync render error");
    });
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(
      renderFn as unknown as () => Promise<ReturnType<typeof makeShell>>,
      makeController(),
      schedule
    );
    flush();
    await expect(promise).rejects.toThrow("sync render error");
  });

  test("rejects when renderFn Promise rejects", async () => {
    const renderFn = mock(() => Promise.reject(new Error("async render error")));
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(renderFn, makeController(), schedule);
    flush();
    await expect(promise).rejects.toThrow("async render error");
  });

  test("resolves with postponed state when present", async () => {
    const postponed = { state: "opaque-postponed-blob" };
    const shell = { prelude: new ReadableStream(), postponed };
    const renderFn = mock(() => Promise.resolve(shell as unknown as ReturnType<typeof makeShell>));
    const { schedule, flush } = makeSyncScheduler();
    const promise = schedulePrerender(renderFn, makeController(), schedule);
    flush();
    const result = await promise;
    expect(result).toBe(shell as unknown as ReturnType<typeof makeShell>);
    expect((result as unknown as typeof shell).postponed).toBe(postponed);
  });
});
