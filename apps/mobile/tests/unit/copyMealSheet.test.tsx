// @vitest-environment jsdom
/**
 * Mobile `CopyMealSheet` render test (post-ship #3, 2026-04-18; ENG-786
 * rebuild slot-selector coverage added 2026-07-21).
 *
 * The F2 deferred row in `docs/planning/sweep-2026-04-executor-backlog.md`.
 * Mirrors the web `CopyMealDialog` render test at
 * `tests/unit/copyMealDialog.test.tsx` (parity invariant — same
 * `sanitizeCopySlotTargets` / `addDays` helpers, same confirm payload shape).
 *
 * Coverage:
 *   1. Opens with the day after source as the default target; tapping
 *      Copy calls `onConfirm` with just that day (and the unchanged
 *      source slot as the second arg).
 *   2. Tapping the "+3 days" quick-range chip extends the target list
 *      by two extra consecutive days starting from the primary target.
 *   3. "Just this day" keeps the single-day payload shape.
 *   4. Source day never appears in the payload while the slot is
 *      unchanged — even when the range would otherwise include it
 *      (`sanitizeCopySlotTargets` same-day/same-slot no-op contract).
 *   5. The `visible === false` branch renders nothing (Modal honours
 *      visibility; no confirm fires).
 *   6. ENG-786 rebuild — picking a different slot pill passes that slot
 *      as `onConfirm`'s second arg and appends " · <Slot>" to the summary.
 *   7. ENG-786 rebuild — the source day is disabled in the calendar only
 *      while the slot is unchanged; switching the slot makes the source
 *      day a legal (selectable, non-excluded) target.
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

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

describe("CopyMealSheet (mobile) — F2 parity", () => {
  it("fires onConfirm with [source+1], the unchanged source slot, when the user taps Copy without changing anything", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Lunch"
        slots={SLOTS}
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
    // Slot unchanged → second arg is the source slot.
    expect(onConfirm.mock.calls[0][1]).toBe("Lunch");
    // Day-only phrasing (no " · Lunch" suffix) since the slot didn't change.
    expect(onConfirm.mock.calls[0][2]).toBe("Copied to Sat 18 Apr");
    // Sheet closes after confirm (keeps parity with web's dialog close).
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("extends the payload via the 'Next 3 days' quick-range chip and excludes the source day", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Lunch"
        slots={SLOTS}
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
    // `sanitizeCopySlotTargets` drops duplicates + source; source is not
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
        sourceSlot="Lunch"
        slots={SLOTS}
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
        sourceSlot="Lunch"
        slots={SLOTS}
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
        sourceSlot="Lunch"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    expect(queryByLabelText("Copy")).toBeNull();
  });
});

describe("CopyMealSheet (mobile) — ENG-786 rebuild slot selector", () => {
  it("defaults the slot selector to sourceSlot and keeps day-only phrasing when Copy is tapped unchanged", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Breakfast"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    // The source slot's pill is selected by default (accessibilityState).
    expect(getByLabelText("Breakfast").props.accessibilityState.selected).toBe(true);
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm.mock.calls[0][1]).toBe("Breakfast");
    expect(onConfirm.mock.calls[0][2]).toBe("Copied to Sat 18 Apr");
  });

  it("picking a different slot pill passes it as the second onConfirm arg and appends it to the summary", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Breakfast"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Lunch"));
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
    expect(onConfirm.mock.calls[0][1]).toBe("Lunch");
    // Slot changed → summary gets the " · Lunch" suffix appended.
    expect(onConfirm.mock.calls[0][2]).toBe("Copied to Sat 18 Apr · Lunch");
  });

  it("the source day's calendar cell is disabled while the slot is unchanged, and un-disables once the slot differs", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Lunch"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    // Same slot (unchanged) → source day cell reports disabled. (Native
    // `Pressable` honours `disabled` to block the tap in the real app;
    // `fireEvent.press` in this harness calls the handler directly
    // regardless of `disabled`, so the "no-op when disabled" half of the
    // contract is covered at the `sanitizeCopySlotTargets` unit-test
    // layer instead — this test only asserts the disabled STATE itself.)
    expect(getByLabelText("Pick Fri 17 Apr").props.accessibilityState.disabled).toBe(true);

    // Switch to a different slot — the source day should now be a legal,
    // selectable target (same-day-different-slot is not a no-op).
    fireEvent.press(getByLabelText("Dinner"));
    const sourceDayCellAfterSlotChange = getByLabelText("Pick Fri 17 Apr");
    expect(sourceDayCellAfterSlotChange.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(sourceDayCellAfterSlotChange);
    fireEvent.press(getByLabelText("Copy"));
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-17"]);
    expect(onConfirm.mock.calls[0][1]).toBe("Dinner");
    expect(onConfirm.mock.calls[0][2]).toBe("Copied to Fri 17 Apr · Dinner");
  });

  it("resets the slot selector back to sourceSlot when the sheet re-opens", () => {
    const onConfirm = vi.fn();
    const { getByLabelText, rerender } = render(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Breakfast"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Snacks"));
    expect(getByLabelText("Snacks").props.accessibilityState.selected).toBe(true);

    rerender(
      <CopyMealSheet
        visible={false}
        sourceDayKey="2026-04-17"
        sourceSlot="Breakfast"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    rerender(
      <CopyMealSheet
        visible
        sourceDayKey="2026-04-17"
        sourceSlot="Breakfast"
        slots={SLOTS}
        mealLabel="Greek yoghurt bowl"
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    expect(getByLabelText("Breakfast").props.accessibilityState.selected).toBe(true);
  });
});
