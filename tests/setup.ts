import "@testing-library/jest-dom/vitest";
import { loadRepoEnvLocal } from "../scripts/load-repo-env-local.mjs";

loadRepoEnvLocal();

/**
 * jsdom doesn't implement `HTMLCanvasElement.prototype.getContext` and
 * logs a "not implemented" warning whenever a component touches it
 * (e.g. `RulerSlider`). The component itself wraps the call in
 * try/catch so behaviour is correct, but the warning still leaks into
 * test output and can mask real failures. Stub it once here.
 */
if (
  typeof HTMLCanvasElement !== "undefined" &&
  typeof HTMLCanvasElement.prototype.getContext === "function"
) {
  HTMLCanvasElement.prototype.getContext = (() => null) as any;
}

/**
 * jsdom doesn't implement `ResizeObserver`, which several Today
 * components instantiate on mount (the ring display toggle / responsive
 * chart wrappers). Real browsers provide it; stub a no-op so renders
 * don't throw "ResizeObserver is not defined" in tests.
 */
if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

