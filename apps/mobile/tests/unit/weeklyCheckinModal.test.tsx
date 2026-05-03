// @vitest-environment jsdom
/**
 * WeeklyCheckinModal — render + interaction pins (mobile).
 *
 * The modal is the user-facing surface of the weekly TDEE check-in
 * ritual (PR claude/weekly-checkin-ritual-v2, 2026-05-02 — rebuild of
 * #26). Gating + content build are unit-covered in
 * `tests/unit/weeklyCheckin.test.ts` (root tests dir) — these tests
 * pin the rendered output:
 *
 *   1. Headline + why-line render verbatim from the content payload.
 *   2. The "from → to" target row uses the suggested target as the
 *      bold value with the previous target struck-through next to it.
 *   3. Both CTAs (Accept / Keep current) call their respective
 *      handlers exactly once on press.
 *   4. The weight-delta row is suppressed when null (we never
 *      fabricate "+0.0 kg").
 *   5. Tabular-nums style is applied to the suggested target value
 *      (regression guard for kerning drift between web + mobile).
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { WeeklyCheckinModal } from "../../components/today/WeeklyCheckinModal";
import type { WeeklyCheckinContent } from "../../lib/weeklyCheckin";

void React;

const BASE_COLORS = {
  cardColor: "#fff",
  textColor: "#000",
  textSecondaryColor: "#555",
  borderColor: "#e0e0e0",
};

function makeContent(
  overrides: Partial<WeeklyCheckinContent> = {},
): WeeklyCheckinContent {
  return {
    tdeeDeltaKcal: 200,
    suggestedTargetKcal: 2000,
    headline: "Your weekly check-in is ready",
    whyLine: "Your real burn is +200 kcal higher than the formula.",
    avgThisWeekLabel: "1,750 kcal/day",
    weightDeltaLabel: "−0.4 kg",
    ...overrides,
  };
}

describe("WeeklyCheckinModal", () => {
  it("renders the headline + why line from content", () => {
    const { getByText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("Your weekly check-in is ready")).toBeTruthy();
    expect(getByText(/higher than the formula/)).toBeTruthy();
  });

  it("renders avg-this-week, weight delta, and TDEE delta rows", () => {
    const { getByText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText("Avg this week")).toBeTruthy();
    expect(getByText("1,750 kcal/day")).toBeTruthy();
    expect(getByText("Weight delta")).toBeTruthy();
    expect(getByText("−0.4 kg")).toBeTruthy();
    expect(getByText("TDEE delta")).toBeTruthy();
    expect(getByText("+200 kcal")).toBeTruthy();
  });

  it("suppresses the weight-delta row when label is null", () => {
    const { queryByText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent({ weightDeltaLabel: null })}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(queryByText("Weight delta")).toBeNull();
  });

  it("renders previous target struck-through alongside the bold suggested target", () => {
    const { getByText, getByLabelText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    // Previous (struck-through)
    expect(getByText("1,800")).toBeTruthy();
    // Suggested (bold + tabular nums + accessibility label)
    const suggested = getByLabelText("Suggested 2000 kilocalories per day");
    expect(suggested).toBeTruthy();
    expect(suggested.props.children).toBe("2,000");
    const styleArr = Array.isArray(suggested.props.style)
      ? suggested.props.style
      : [suggested.props.style];
    const tabularStyle = styleArr.find(
      (s: unknown): s is { fontVariant?: string[] } =>
        Boolean(s) &&
        typeof s === "object" &&
        Array.isArray((s as { fontVariant?: unknown }).fontVariant),
    );
    expect(tabularStyle?.fontVariant).toContain("tabular-nums");
  });

  it("calls onAccept exactly once when the primary CTA is pressed", () => {
    const onAccept = vi.fn();
    const { getByLabelText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={onAccept}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Accept new target"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when 'Keep current' is pressed", () => {
    const onDismiss = vi.fn();
    const { getByLabelText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={onDismiss}
        {...BASE_COLORS}
      />,
    );
    fireEvent.press(getByLabelText("Keep current target"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when content is null (defensive guard)", () => {
    const { toJSON } = render(
      <WeeklyCheckinModal
        visible
        content={null}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
