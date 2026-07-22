// @vitest-environment jsdom
/**
 * `NutritionDetailEmptyState` (mobile) — ENG-825 shared empty / error /
 * nothing-here structure for the two sibling nutrition-detail screens
 * (`macro-detail`, `meal-nutrition`). Replaces the two hand-rolled,
 * divergent empty/error states (different icon sets, different CTA
 * colours, one floating in a sea of whitespace).
 *
 * Pins the flag-gated visual behaviour so a regression breaks the test:
 *   - the body always wraps in an elevated card (modern radius + shadow via
 *     `useCardElevation`) — `design_system_elevation` collapsed (ENG-1651),
 *     it was permanently ON; there is no more flat, card-less layout.
 *   - `design_system_colours` ON  → the CTA fills BLUE (`Accent.primary`,
 *     the single commit-action colour); OFF → the caller's legacy fill
 *     (e.g. the saturated macro hue passed via `ctaColorLegacy`).
 *   - the CTA fires `onPress`, and is omitted entirely when no `ctaLabel`.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { Salad } from "lucide-react-native";

import { NutritionDetailEmptyState } from "../../components/nutrition/NutritionDetailEmptyState";
import { Accent } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(async () => undefined),
  impactAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

/** Flatten an RN style prop (array | object) into one object. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flatten(s) }), {});
  }
  return (style as Record<string, unknown>) ?? {};
}

const MACRO_HUE = "#C8794E"; // a macro colour (Sloe carbs — clay)

beforeEach(() => {
  flagFn.mockReset();
  flagFn.mockReturnValue(false);
});

describe("NutritionDetailEmptyState (mobile)", () => {
  it("renders title, subtitle and CTA label", () => {
    const { getByText } = render(
      <NutritionDetailEmptyState
        icon={Salad}
        title="No meals logged yet"
        subtitle="Log a meal to see your carbs broken down here."
        ctaLabel="Log a meal"
        onPress={() => undefined}
      />,
    );
    expect(getByText("No meals logged yet")).toBeTruthy();
    expect(getByText("Log a meal to see your carbs broken down here.")).toBeTruthy();
    expect(getByText("Log a meal")).toBeTruthy();
  });

  it("fires onPress when the CTA is pressed", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(
      <NutritionDetailEmptyState
        icon={Salad}
        title="No meals logged yet"
        ctaLabel="Log a meal"
        ctaA11yLabel="Log a meal on Today"
        onPress={onPress}
      />,
    );
    fireEvent.press(getByLabelText("Log a meal on Today"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("omits the CTA entirely when no ctaLabel is given", () => {
    const { queryByRole } = render(
      <NutritionDetailEmptyState icon={Salad} title="Nothing here" />,
    );
    expect(queryByRole("button")).toBeNull();
  });

  it("colours mapping — flag OFF uses the legacy macro hue, flag ON uses BLUE", () => {
    // design_system_colours OFF → legacy saturated-macro fill.
    flagFn.mockImplementation((f: string) => false);
    const off = render(
      <NutritionDetailEmptyState
        icon={Salad}
        title="No meals logged yet"
        ctaLabel="Log a meal"
        ctaColorLegacy={MACRO_HUE}
        onPress={() => undefined}
      />,
    );
    const offBtn = off.getByLabelText("Log a meal");
    expect(flatten(offBtn.props.style).backgroundColor).toBe(MACRO_HUE);

    // design_system_colours ON → BLUE commit colour regardless of legacy hue.
    flagFn.mockImplementation((f: string) => f === "design_system_colours");
    const on = render(
      <NutritionDetailEmptyState
        icon={Salad}
        title="No meals logged yet"
        ctaLabel="Log a meal"
        ctaColorLegacy={MACRO_HUE}
        onPress={() => undefined}
      />,
    );
    const onBtn = on.getByLabelText("Log a meal");
    expect(flatten(onBtn.props.style).backgroundColor).toBe(Accent.primary);
  });

  it("structure — always wraps the body in an elevated card (modern radius)", () => {
    const { getByTestId } = render(
      <NutritionDetailEmptyState
        testID="empty-card"
        icon={Salad}
        title="No meals logged yet"
      />,
    );
    const style = flatten(getByTestId("empty-card").props.style);
    // Radius.xl (12) — the modern corner the lane calls for; unconditional
    // since `design_system_elevation` collapsed (ENG-1651).
    expect(style.borderRadius).toBe(12);
  });
});
