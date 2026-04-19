/**
 * `safeBack` unit contract (F-19, 2026-04-19, TestFlight
 * `ADACe4M-PsjNMMnlAwMPPSQ`).
 *
 * The helper backs a custom `headerLeft` on `meal-nutrition.tsx` (and
 * the `use-safe-back` hook) so a screen's back affordance is never a
 * dead button when the expo-router stack has no history.
 *
 * Two paths:
 *   1. Stack has history → `router.back()` fires, `router.replace()`
 *      is NOT called.
 *   2. Stack has no history → `router.back()` is NOT called,
 *      `router.replace(fallback)` fires.
 *
 * Keeping this at the pure-function layer means the hook test and the
 * native-header test both lean on the same rules.
 */
import { describe, expect, it, vi } from "vitest";

import { safeBack, type SafeBackRouter } from "../../lib/safeBack";

function makeRouter(canGoBack: boolean): SafeBackRouter & {
  back: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
} {
  return {
    canGoBack: () => canGoBack,
    back: vi.fn(),
    replace: vi.fn(),
  };
}

describe("safeBack — never-dead back-button helper", () => {
  it("calls router.back() when the stack has history (happy path)", () => {
    const router = makeRouter(true);
    safeBack(router, "/(tabs)");
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("replaces to the fallback when the stack is empty (cold-start / deep-link path)", () => {
    const router = makeRouter(false);
    safeBack(router, "/(tabs)");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("defaults the fallback to '/' when none is provided", () => {
    const router = makeRouter(false);
    safeBack(router);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("never fires both back() and replace() in the same call", () => {
    const backable = makeRouter(true);
    safeBack(backable, "/(tabs)");
    expect(backable.back).toHaveBeenCalledTimes(1);
    expect(backable.replace).toHaveBeenCalledTimes(0);

    const notBackable = makeRouter(false);
    safeBack(notBackable, "/(tabs)");
    expect(notBackable.back).toHaveBeenCalledTimes(0);
    expect(notBackable.replace).toHaveBeenCalledTimes(1);
  });
});
