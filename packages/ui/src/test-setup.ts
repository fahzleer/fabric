import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

Element.prototype.scrollIntoView = () => undefined;

// jsdom doesn't implement ResizeObserver — @xyflow/react (WorkflowCanvas)
// requires it to measure its container. No-op is sufficient for tests,
// which don't depend on real resize measurements.
class ResizeObserverMock {
  observe() {
    // no-op
  }
  unobserve() {
    // no-op
  }
  disconnect() {
    // no-op
  }
}
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
    ResizeObserverMock;
}
