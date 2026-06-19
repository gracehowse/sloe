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
    floorAppliedKcal: null,
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

  it("renders avg-this-week, weight delta, and estimated-burn-change rows", () => {
    // P1 (customer-lens 2026-05-11): "TDEE delta" → "Estimated burn
    // change". The MFP-refugee cohort doesn't know "TDEE"; the new
    // label matches the plain-English whyLine above
    // ("Your real burn is +X higher than the formula").
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
    expect(getByText("Avg logged daily")).toBeTruthy();
    expect(getByText("1,750 kcal/day")).toBeTruthy();
    expect(getByText("Weight delta")).toBeTruthy();
    expect(getByText("−0.4 kg")).toBeTruthy();
    expect(getByText("Estimated burn change")).toBeTruthy();
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

  it("shows the 1,200 kcal floor explainer when floorAppliedKcal is set", () => {
    // build-47 follow-up — Grace `APPzhqLXgb64_9reZ44rGk4`:
    // "If my tdee is lower why is my target higher?" — when the math
    // would land below the safety floor we clamp up. The modal must
    // explain that, otherwise the suggestion looks self-contradictory.
    const { getByText, queryByText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent({
          suggestedTargetKcal: 1200,
          floorAppliedKcal: 1093,
        })}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByText(/math would land at/i)).toBeTruthy();
    expect(getByText("1,093 kcal/day")).toBeTruthy();
    expect(getByText("1,200 kcal/day")).toBeTruthy();
    // Sanity: explainer must NOT render on the default (no-floor) content.
    const { queryByText: qNoFloor } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent()}
        currentTargetKcal={1800}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(qNoFloor(/math would land at/i)).toBeNull();
    void queryByText;
  });

  it("ENG-1111 — renders the measured-driven raised target above the current under-logged target", () => {
    // When the measured branch wins, `buildWeeklyCheckinContent` produces a
    // suggested target computed against measured expenditure (~1,900) — higher
    // than the user's collapsed under-logged target (1,329). The modal must
    // surface that higher number as the bold suggestion, not anchor to intake.
    const { getByLabelText, getByText } = render(
      <WeeklyCheckinModal
        visible
        content={makeContent({
          tdeeDeltaKcal: 150,
          suggestedTargetKcal: 1479,
          whyLine: "Your real burn is +150 kcal higher than the formula.",
        })}
        currentTargetKcal={1329}
        onAccept={() => {}}
        onDismiss={() => {}}
        {...BASE_COLORS}
      />,
    );
    expect(getByLabelText("Suggested 1479 kilocalories per day").props.children).toBe(
      "1,479",
    );
    // Previous (under-logged) target rendered struck-through alongside.
    expect(getByText("1,329")).toBeTruthy();
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
