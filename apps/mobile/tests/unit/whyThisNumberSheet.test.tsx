// @vitest-environment jsdom
/**
 * WhyThisNumberSheet (mobile) — pin the "why is my target X kcal?"
 * sheet rendering + Adjust target CTA.
 *
 * Coverage:
 *  - Headline reflects the target.
 *  - 3 breakdown rows render with the canonical labels (TDEE / Goal /
 *    Result) using the shared `buildWhyThisNumber` helper.
 *  - "Adjust target" CTA closes the sheet AND fires the host handler
 *    (host typically routes to the weekly check-in).
 *  - When `onPressAdjustTarget` is omitted, the CTA is suppressed.
 *  - Early-estimate qualifier renders when loggingDays < 14.
 *
 * Web parity pinned by `tests/unit/whyThisNumberDialog.test.tsx`.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { WhyThisNumberSheet } from "../../components/today/WhyThisNumberSheet";

void React;

const BASE_PROPS = {
  visible: true,
  onClose: vi.fn(),
  targetCalories: 1800,
  maintenanceTdee: 2150,
  confidence: "medium" as const,
  loggingDays: 21,
  goal: "lose" as const,
  paceKgPerWeek: -0.5,
  backgroundColor: "#000",
  cardColor: "#111",
  cardBorderColor: "#222",
  textColor: "#fff",
  textSecondaryColor: "#aaa",
  textTertiaryColor: "#888",
};

describe("WhyThisNumberSheet", () => {
  it("renders the target headline", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-this-number-target-headline").props.children).toBe(
      "Today's target: 1,800 kcal",
    );
  });

  it("renders three breakdown rows in canonical order", () => {
    const { getByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(getByTestId("why-this-number-line-tdee")).toBeTruthy();
    expect(getByTestId("why-this-number-line-goal")).toBeTruthy();
    expect(getByTestId("why-this-number-line-result")).toBeTruthy();
  });

  it("does not render when visible=false", () => {
    const { queryByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} visible={false} />,
    );
    // Modal swallows children when not visible.
    expect(queryByTestId("why-this-number-target-headline")).toBeNull();
  });

  it("renders 'Adjust target' CTA when onPressAdjustTarget is provided", () => {
    const onPressAdjustTarget = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet {...BASE_PROPS} onPressAdjustTarget={onPressAdjustTarget} />,
    );
    expect(getByTestId("why-this-number-adjust-target")).toBeTruthy();
  });

  it("hides 'Adjust target' CTA when onPressAdjustTarget is omitted", () => {
    const { queryByTestId } = render(<WhyThisNumberSheet {...BASE_PROPS} />);
    expect(queryByTestId("why-this-number-adjust-target")).toBeNull();
  });

  it("Adjust target tap closes sheet AND fires handler", () => {
    const onClose = vi.fn();
    const onPressAdjustTarget = vi.fn();
    const { getByTestId } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        onClose={onClose}
        onPressAdjustTarget={onPressAdjustTarget}
      />,
    );
    fireEvent.press(getByTestId("why-this-number-adjust-target"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPressAdjustTarget).toHaveBeenCalledTimes(1);
  });

  it("renders early-estimate qualifier when loggingDays < 14", () => {
    const { getByText } = render(
      <WhyThisNumberSheet {...BASE_PROPS} loggingDays={5} />,
    );
    expect(getByText(/Early estimate/)).toBeTruthy();
  });

  it("renders calibrating copy when no maintenance estimate exists", () => {
    const { getByText } = render(
      <WhyThisNumberSheet
        {...BASE_PROPS}
        maintenanceTdee={null}
        confidence={null}
        loggingDays={3}
      />,
    );
    expect(getByText("calibrating — keep logging")).toBeTruthy();
  });
});
