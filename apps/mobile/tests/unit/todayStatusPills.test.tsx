// @vitest-environment jsdom
/**
 * TodayHero status pills (mobile) — ENG-753.
 *
 * Mobile mirror of `tests/unit/todayStatusPills.test.tsx` (web). Pins
 * the flag-gated "On track" pill below the ring so visibility logic —
 * flag-off, per-pill conditions — can't drift from web.
 *
 * Sloe redesign (2026-06-08): the "Adaptive TDEE learning · N of 7 days"
 * line was removed from the Today hero to match Figma `654:2`. These tests
 * now GUARD that the TDEE line never re-appears on Today, while "On track"
 * still works. The `tdeeLearnDays` prop is retained for call-site stability.
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

  it("NEVER renders the Adaptive TDEE learning line on Today (Figma 654:2)", () => {
    // Even with the flag on and tdeeLearnDays > 0, the TDEE line must not
    // appear — it was removed from Today. Re-adding it should break this test.
    flagFn.mockReturnValue(true);
    const { queryByTestId, queryByText } = render(
      <TodayHero {...baseProps({ isOnTrack: false, tdeeLearnDays: 4 })} />,
    );
    expect(queryByTestId("today-pill-tdee-learning")).toBeNull();
    expect(queryByText("Adaptive TDEE learning · 4 of 7 days")).toBeNull();
    // With only the (removed) TDEE pill eligible and On track false, the whole
    // pills row collapses to nothing.
    expect(queryByTestId("today-status-pills")).toBeNull();
  });

  it("keeps the On track pill even when tdeeLearnDays is set (no TDEE line beside it)", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId, queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: true, tdeeLearnDays: 6 })} />,
    );
    expect(getByTestId("today-pill-on-track")).toBeTruthy();
    expect(queryByTestId("today-pill-tdee-learning")).toBeNull();
  });

  it("renders nothing when not on track", () => {
    flagFn.mockReturnValue(true);
    const { queryByTestId } = render(
      <TodayHero {...baseProps({ isOnTrack: false, tdeeLearnDays: 0 })} />,
    );
    expect(queryByTestId("today-status-pills")).toBeNull();
  });
});
