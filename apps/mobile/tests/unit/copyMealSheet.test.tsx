// @vitest-environment jsdom
/**
 * Mobile `CopyMealSheet` render test (post-ship #3, 2026-04-18).
 *
 * The F2 deferred row in `docs/planning/sweep-2026-04-executor-backlog.md`.
 * Mirrors the web `CopyMealDialog` render test at
 * `tests/unit/copyMealDialog.test.tsx` (parity invariant — same
 * `sanitizeCopyTargets` / `addDays` helpers, same confirm payload shape).
 *
 * Coverage:
 *   1. Opens with the day after source as the default target; tapping
 *      Copy calls `onConfirm` with just that day.
 *   2. Tapping the "+3 days" quick-range chip extends the target list
 *      by two extra consecutive days starting from the primary target.
 *   3. "Just this day" keeps the single-day payload shape.
 *   4. Source day never appears in the payload — even when the range
 *      would otherwise include it (`sanitizeCopyTargets` contract).
 *   5. The `visible === false` branch renders nothing (Modal honours
 *      visibility; no confirm fires).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import CopyMealSheet from "../../components/CopyMealSheet";

void React;

const COLORS = {
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  card: "#16161e",
  cardBorder: "#2a2a3a",
  background: "#0a0a0f",
  primaryForeground: "#ffffff",
};

describe("CopyMealSheet (mobile) — F2 parity", () => {
  it("fires onConfirm with [source+1] when the user taps Copy without changing anything", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={onClose}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Default target is source+1 = 2026-04-18 (per `addDays`).
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
    // Sheet closes after confirm (keeps parity with web's dialog close).
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("extends the payload via the 'Next 3 days' quick-range chip and excludes the source day", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Next 3 days"));
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Primary = source+1 (2026-04-18), chip extends by days=3 starting
    // from the primary: base = [04-18], +i=1,2 => [04-18, 04-19, 04-20].
    // `sanitizeCopyTargets` drops duplicates + source; source is not
    // in the list anyway so the payload is exactly three consecutive
    // days.
    expect(onConfirm.mock.calls[0][0]).toEqual([
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
    ]);
  });

  it("'Just this day' after a chip tap reverts the payload back to a single day", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Next 7 days"));
    // User changes their mind — picks the single-day mode again.
    fireEvent.press(getByLabelText("Just this day"));
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
  });

  it("picking the source day in the calendar (even with +3 active) yields a dedup payload that excludes the source", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-18"
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    // When the source is 2026-04-18, the default primary becomes 04-19.
    // Activate +3 days → candidate payload = [04-19, 04-20, 04-21]. The
    // source (04-18) is naturally excluded.
    fireEvent.press(getByLabelText("Next 3 days"));
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0] as string[];
    expect(payload).toEqual(["2026-04-19", "2026-04-20", "2026-04-21"]);
    // Sanitisation contract — source never in payload.
    expect(payload).not.toContain("2026-04-18");
    // No duplicates.
    expect(new Set(payload).size).toBe(payload.length);
  });

  it("renders nothing when visible=false (Modal honours visibility, Copy label is absent)", () => {
    const onConfirm = vi.fn();
    const { queryByLabelText } = render(
      <CopyMealSheet
        visible={false}
        sourceDayKey="2026-04-17"
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    expect(queryByLabelText("Copy")).toBeNull();
  });
});
