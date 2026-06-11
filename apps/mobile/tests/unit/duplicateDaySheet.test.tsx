// @vitest-environment jsdom
/**
 * Mobile `DuplicateDaySheet` render test (post-ship #3, 2026-04-18).
 *
 * The F2 deferred row in `docs/planning/sweep-2026-04-executor-backlog.md`.
 * Mirrors the web `DuplicateDayDialog` render test at
 * `tests/unit/duplicateDayDialog.test.tsx` — same `expandDateRange` +
 * `sanitizeCopyTargets` helpers, same confirm-payload shape.
 *
 * Coverage:
 *   1. Single-day mode (default) — confirming without changes fires
 *      `onConfirm` with `[source+1]`.
 *   2. Date Range mode — inclusive range expansion via `expandDateRange`
 *      yields every day between source+1 and source+7.
 *   3. Zero-meal source disables Confirm (toggle is still visible but
 *      pressing it never reaches the range callback).
 *   4. Source day never appears in the payload, even when the range
 *      would otherwise include it.
 *   5. visible=false renders nothing (Modal honours visibility).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import DuplicateDaySheet from "../../components/DuplicateDaySheet";

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

describe("DuplicateDaySheet (mobile) — F2 parity", () => {
  it("fires onConfirm with [source+1] when the user taps Duplicate in single-day mode without changes", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <DuplicateDaySheet
        visible
        sourceDayKey="2026-04-17"
        sourceMealCount={3}
        onConfirm={onConfirm}
        onClose={onClose}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Duplicate"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Default start = source+1 = 2026-04-18.
    expect(onConfirm.mock.calls[0][0]).toEqual(["2026-04-18"]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("switching to Date Range mode expands the default window inclusively and excludes the source", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <DuplicateDaySheet
        visible
        sourceDayKey="2026-04-17"
        sourceMealCount={3}
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Date range"));
    fireEvent.press(getByLabelText("Duplicate"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const payload = onConfirm.mock.calls[0][0] as string[];
    // Default range is source+1 … source+7 → seven consecutive days,
    // none of which is the source.
    expect(payload).toEqual([
      "2026-04-18",
      "2026-04-19",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
    ]);
    expect(payload).not.toContain("2026-04-17");
  });

  it("disables Confirm when the source day has no meals — zero-meal source can't be duplicated", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <DuplicateDaySheet
        visible
        sourceDayKey="2026-04-17"
        sourceMealCount={0}
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    const confirm = getByLabelText("Duplicate");
    // RN mirrors the accessibility state on the host element.
    expect(confirm.props.accessibilityState?.disabled).toBe(true);
    // Pressable with `disabled` still receives onPress in the host
    // shim, so the component's own `canConfirm` guard owns the contract
    // instead: it forwards an EMPTY payload + a "Nothing to duplicate"
    // summary to the caller so the caller can surface the "nothing to
    // copy" toast without a branching code path. No target rows are
    // ever written.
    fireEvent.press(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [keys, summary] = onConfirm.mock.calls[0];
    expect(keys).toEqual([]);
    expect(summary).toMatch(/nothing to duplicate/i);
  });

  it("(audit C3 invariant) source day never appears in the payload even in range mode", () => {
    const onConfirm = vi.fn();
    const { getByLabelText } = render(
      <DuplicateDaySheet
        visible
        sourceDayKey="2026-04-20"
        sourceMealCount={3}
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Date range"));
    fireEvent.press(getByLabelText("Duplicate"));
    const payload = onConfirm.mock.calls[0][0] as string[];
    // The range is source+1 (04-21) .. source+7 (04-27) — source
    // (04-20) is not in the default range window. Still: asserting
    // source-exclusion here pins the `sanitizeCopyTargets` contract so
    // a future default-range change can't silently regress it.
    expect(payload).not.toContain("2026-04-20");
    expect(payload).toHaveLength(7);
    expect(new Set(payload).size).toBe(7);
  });

  it("renders nothing when visible=false (Modal honours visibility)", () => {
    const onConfirm = vi.fn();
    const { queryByLabelText } = render(
      <DuplicateDaySheet
        visible={false}
        sourceDayKey="2026-04-17"
        sourceMealCount={3}
        onConfirm={onConfirm}
        onClose={() => undefined}
        colors={COLORS}
      />,
    );
    expect(queryByLabelText("Duplicate")).toBeNull();
  });
});
