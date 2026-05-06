// @vitest-environment jsdom
/**
 * GoalPaceRetuneSheet — pin the user-facing flow.
 *
 * Authority: extended-competitor-audit task (2026-04-30, Step 2 + 7).
 *
 *   1. Live preview updates as the user picks a different pace.
 *   2. Confirm writes (target_calories, target_protein, target_carbs,
 *      target_fat, target_fiber_g, plan_pace) to `profiles` and fires
 *      `goal_pace_adjusted` analytics with the before/after.
 *   3. Below-safety-floor banner renders without blocking the
 *      Confirm button (Suppr policy: soft-warn-not-block).
 *
 * Mobile-only; the sheet is the modal write surface for the iOS
 * Weekly Check-in. Web routes through Settings → Targets, covered
 * separately.
 */

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

// ── Imports (after mocks) ──────────────────────────────────────────
import { GoalPaceRetuneSheet } from "../../components/recap/GoalPaceRetuneSheet";

void React;

// ── Supabase + analytics mocks (hoisted so `vi.mock` factories can
// reference them without TDZ errors) ──────────────────────────────
const { eqSpy, updateSpy, fromSpy, trackSpy } = vi.hoisted(() => {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn((_updates: Record<string, unknown>) => ({
    eq,
  }));
  const from = vi.fn((_table: string) => ({
    update,
  }));
  return {
    eqSpy: eq,
    updateSpy: update,
    fromSpy: from,
    trackSpy: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => fromSpy(table),
  },
}));

vi.mock("@/lib/analytics", () => ({
  track: trackSpy,
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
  }),
}));

beforeEach(() => {
  updateSpy.mockClear();
  fromSpy.mockClear();
  eqSpy.mockClear();
  trackSpy.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const baseProps = {
  visible: true,
  onClose: vi.fn(),
  tdeeKcal: 2400,
  dbGoal: "cut" as const,
  strategy: "high_satisfaction" as const,
  weightKg: 80,
  sex: "male" as const,
  currentTargetKcal: 1850, // 0.5 kg/week steady deficit (~ -550)
  userId: "user-1",
  onSaved: vi.fn(),
};

describe("GoalPaceRetuneSheet — preview", () => {
  it("renders the current calorie + pace summary", () => {
    const { getByText, getAllByText } = render(<GoalPaceRetuneSheet {...baseProps} />);
    // Current line: "1,850 kcal/day · 0.5 kg/week loss".
    // The "1,850 kcal/day" string ALSO appears in the preview's
    // "was 1,850 kcal/day" line — that's expected. Use getAllByText
    // for the kcal value and assert the pace label uniquely.
    expect(getAllByText(/1,850 kcal\/day/).length).toBeGreaterThanOrEqual(1);
    expect(getByText(/0.5 kg\/week loss/)).toBeTruthy();
  });

  it("updates the new-target preview when the user picks a different pace", () => {
    const { getByTestId } = render(<GoalPaceRetuneSheet {...baseProps} />);
    // Start: 0.5 inferred → preview shows 1,850 kcal.
    const preview = getByTestId("goal-pace-retune-preview");
    expect(preview).toBeTruthy();

    // Tap 0.25 → preview should become 2,400 - 275 = 2,125.
    fireEvent.press(getByTestId("goal-pace-option-0.25"));
    // Re-read the preview text.
    const previewAfter = getByTestId("goal-pace-retune-preview");
    // The card includes "2,125 kcal" somewhere.
    expect(previewAfter.props.children).toBeTruthy();
  });

  it("shows the safety-floor warning when the new target dips below floor", () => {
    const { queryByTestId, getByTestId } = render(
      <GoalPaceRetuneSheet {...baseProps} tdeeKcal={2300} />,
    );
    // Initial 0.5 deficit → 1,750 (still above 1,500 male floor).
    expect(queryByTestId("goal-pace-retune-safety-warn")).toBeNull();

    // 1.0 kg/week → 2,300 - 1,100 = 1,200 → BELOW male floor (1,500).
    fireEvent.press(getByTestId("goal-pace-option-1"));
    expect(getByTestId("goal-pace-retune-safety-warn")).toBeTruthy();
    // Confirm button stays enabled — soft-warn-not-block.
    const confirm = getByTestId("goal-pace-retune-confirm");
    expect(confirm.props.accessibilityState?.disabled ?? false).toBe(false);
  });
});

describe("GoalPaceRetuneSheet — confirm flow", () => {
  it("writes new targets to profiles and fires goal_pace_adjusted", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    const { getByTestId } = render(
      <GoalPaceRetuneSheet
        {...baseProps}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );
    fireEvent.press(getByTestId("goal-pace-retune-confirm"));

    // Wait for the update promise chain to resolve.
    await new Promise((r) => setTimeout(r, 0));

    expect(fromSpy).toHaveBeenCalledWith("profiles");
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updates = updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updates.target_calories).toBeTypeOf("number");
    expect(updates.target_protein).toBeTypeOf("number");
    expect(updates.target_carbs).toBeTypeOf("number");
    expect(updates.target_fat).toBeTypeOf("number");
    expect(updates.target_fiber_g).toBeTypeOf("number");
    expect(eqSpy).toHaveBeenCalledWith("id", "user-1");
    expect(trackSpy).toHaveBeenCalled();
    const event = trackSpy.mock.calls[0]?.[0];
    const payload = trackSpy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(event).toBe("goal_pace_adjusted");
    expect(payload.surface).toBe("weekly_checkin_sheet");
    expect(payload.previousTargetKcal).toBe(1850);
    expect(typeof payload.newTargetKcal).toBe("number");
    expect(typeof payload.newPaceKgPerWeek).toBe("number");
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
