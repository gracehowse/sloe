import "@testing-library/jest-dom/vitest";

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

