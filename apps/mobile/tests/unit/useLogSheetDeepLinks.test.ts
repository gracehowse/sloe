/** @vitest-environment jsdom */
/**
 * useLogSheetDeepLinks — behavioural tests (audit 2026-06-12, P2 #5).
 *
 * Replaces the theatrical source-grep dismissal pins that only caught
 * line-deletion. These mount the hook with `renderHook` and a controllable
 * `useFocusEffect` mock so we can prove the actual logic:
 *
 *   (a) ?openLog=1 opens the sheet AND clears the consumed params
 *   (b) a `date` param WITHOUT openLog dismisses the sheet
 *   (c) an `editMealId` param WITHOUT openLog dismisses the sheet
 *   (d) the tab-blur cleanup callback dismisses the sheet
 *   (e) ?openLog=1 + ?date together does NOT dismiss (open wins)
 *
 * `useFocusEffect` (from `@react-navigation/native`, matching the hook's
 * import) is mocked to run the focus callback on mount and to register its
 * returned cleanup so a test can fire the blur. The plain `useEffect`
 * dismissal path runs through React's real effect scheduler.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-native";

// Captured cleanups returned by focus callbacks, so a test can simulate
// tab blur by invoking them.
let focusCleanups: Array<() => void>;

vi.mock("@react-navigation/native", () => ({
  // Run the focus callback synchronously on mount (mirrors a screen
  // gaining focus), and stash any returned cleanup so a test can fire
  // the blur explicitly.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => {
      const cleanup = cb();
      if (typeof cleanup === "function") {
        focusCleanups.push(cleanup);
      }
      // We deliberately do NOT return the cleanup to React here: real
      // `useFocusEffect` fires cleanup on blur, which the test drives via
      // `blur()` below, not on unmount.
    }, [cb]);
  },
}));

import {
  useLogSheetDeepLinks,
  type LogSheetDeepLinkParams,
} from "../../hooks/useLogSheetDeepLinks";

function setup(params: LogSheetDeepLinkParams) {
  const setFabSheetOpen = vi.fn();
  const setActiveMealSlot = vi.fn();
  const clearOpenLogParams = vi.fn();
  const view = renderHook(() =>
    useLogSheetDeepLinks({
      params,
      setFabSheetOpen,
      setActiveMealSlot,
      clearOpenLogParams,
    }),
  );
  return { setFabSheetOpen, setActiveMealSlot, clearOpenLogParams, view };
}

/** Simulate tab blur by firing every captured focus cleanup. */
function blur() {
  act(() => {
    focusCleanups.forEach((c) => c());
  });
}

describe("useLogSheetDeepLinks", () => {
  beforeEach(() => {
    focusCleanups = [];
  });

  it("(a) ?openLog=1 opens the sheet and clears the consumed params", () => {
    const { setFabSheetOpen, setActiveMealSlot, clearOpenLogParams } = setup({
      openLog: "1",
      _t: "1700000000000",
    });

    // Opener fired on focus: slot reset to time-of-day, sheet opened,
    // params cleared (so back-nav doesn't re-open).
    expect(setActiveMealSlot).toHaveBeenCalledTimes(1);
    expect(setFabSheetOpen).toHaveBeenCalledWith(true);
    expect(clearOpenLogParams).toHaveBeenCalledTimes(1);
    // The opener must never dismiss the sheet it just opened.
    expect(setFabSheetOpen).not.toHaveBeenCalledWith(false);
  });

  it("(b) a `date` param WITHOUT openLog dismisses the sheet", () => {
    const { setFabSheetOpen, clearOpenLogParams, setActiveMealSlot } = setup({
      date: "2026-06-12",
    });

    expect(setFabSheetOpen).toHaveBeenCalledWith(false);
    // No open path fired — this is a pure dismissal.
    expect(setFabSheetOpen).not.toHaveBeenCalledWith(true);
    expect(clearOpenLogParams).not.toHaveBeenCalled();
    expect(setActiveMealSlot).not.toHaveBeenCalled();
  });

  it("(c) an `editMealId` param WITHOUT openLog dismisses the sheet", () => {
    const { setFabSheetOpen } = setup({ editMealId: "meal-abc" });

    expect(setFabSheetOpen).toHaveBeenCalledWith(false);
    expect(setFabSheetOpen).not.toHaveBeenCalledWith(true);
  });

  it("(d) the tab-blur cleanup dismisses the sheet", () => {
    // No params: nothing dismisses on mount. The dismissal comes from blur.
    const { setFabSheetOpen } = setup({});
    expect(setFabSheetOpen).not.toHaveBeenCalled();

    blur();

    expect(setFabSheetOpen).toHaveBeenCalledWith(false);
    expect(setFabSheetOpen).toHaveBeenCalledTimes(1);
  });

  it("(e) ?openLog=1 + ?date together does NOT dismiss — open wins", () => {
    const { setFabSheetOpen, clearOpenLogParams } = setup({
      openLog: "1",
      date: "2026-06-12",
      _t: "1700000000001",
    });

    // The dismissal effect early-returns on openLog === "1", so the only
    // setFabSheetOpen call is the open (true) — never a dismiss (false).
    expect(setFabSheetOpen).toHaveBeenCalledWith(true);
    expect(setFabSheetOpen).not.toHaveBeenCalledWith(false);
    expect(clearOpenLogParams).toHaveBeenCalledTimes(1);
  });

  it("an unrelated param (no date / editMealId / openLog) neither opens nor dismisses", () => {
    // Guards against an over-eager dismissal: a bare `_t` cache-buster with
    // no actionable param must leave the sheet state untouched.
    const { setFabSheetOpen, clearOpenLogParams } = setup({ _t: "1700000000002" });

    expect(setFabSheetOpen).not.toHaveBeenCalled();
    expect(clearOpenLogParams).not.toHaveBeenCalled();
  });

  it("a malformed `date` (not YYYY-MM-DD) does NOT dismiss", () => {
    // The dismissal is gated on the same strict date regex the screen uses,
    // so junk like `?date=garbage` must not blank the sheet.
    const { setFabSheetOpen } = setup({ date: "not-a-date" });

    expect(setFabSheetOpen).not.toHaveBeenCalled();
  });
});
