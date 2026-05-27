// @vitest-environment jsdom
/**
 * TodayHero status pills (mobile) — ENG-753.
 *
 * Mobile mirror of `tests/unit/todayStatusPills.test.tsx` (web). Pins
 * the flag-gated "On track" + "Adaptive TDEE learning · N of 7 days"
 * pills below the ring so visibility logic — flag-off, per-pill
 * conditions — can't drift from web.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayHero, type TodayHeroProps } from "../../components/today/TodayHero";
import { isFeatureEnabled } from "@/lib/analytics";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

function baseProps(overrides: Partial<TodayHeroProps> = {}): TodayHeroProps {
  return {
    consumed: 1500,
    goal: 2000,
    proteinPct: 0.5,
    carbsPct: 0.5,
    fatPct: 0.5,
    expanded: false,
    onToggleExpanded: () => undefined,
    displayMode: "remaining",
    onToggleDisplayMode: () => undefined,
    textColor: "#fff",
    textSecondaryColor: "#aaa",
    textTertiaryColor: "#888",
    cardBackgroundColor: "#111",
    borderColor: "#222",
    trackColor: "#333",
    ...overrides,
  };
}

describe("ENG-753 — TodayHero status pills (mobile)", () => {
  beforeEach(() => {
    flagFn.mockReset();
  });

  it("renders no pills when the flag is off", () => {
    flagFn.mockReturnValue(false);
    const { queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />,
    );
    expect(queryByTestId("today-status-pills")).toBeNull();
  });

  it("renders the On track pill when flag on and isOnTrack", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId, queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: true, tdeeLearnDays: 0 })} />,
    );
    expect(getByTestId("today-pill-on-track")).toBeTruthy();
    expect(queryByTestId("today-pill-tdee-learning")).toBeNull();
  });

  it("renders the TDEE learning pill with the day count", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId, getByText, queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: false, tdeeLearnDays: 4 })} />,
    );
    expect(getByTestId("today-pill-tdee-learning")).toBeTruthy();
    expect(getByText("Adaptive TDEE learning · 4 of 7 days")).toBeTruthy();
    expect(queryByTestId("today-pill-on-track")).toBeNull();
  });

  it("renders both pills together", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />,
    );
    expect(getByTestId("today-pill-on-track")).toBeTruthy();
    expect(getByTestId("today-pill-tdee-learning")).toBeTruthy();
  });

  it("renders nothing when neither pill is eligible", () => {
    flagFn.mockReturnValue(true);
    const { queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: false, tdeeLearnDays: 0 })} />,
    );
    expect(queryByTestId("today-status-pills")).toBeNull();
  });
});
